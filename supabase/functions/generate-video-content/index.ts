import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lessonTitle, lessonDescription, courseContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating video content for:", lessonTitle);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert educational video script writer. Generate comprehensive video scripts with detailed narration, visual cues, and timing.`
          },
          {
            role: "user",
            content: `Create a detailed video script for the lesson: "${lessonTitle}"
            
${lessonDescription ? `Lesson Description: ${lessonDescription}` : ''}
Course Context: ${courseContext || "General course"}

Please provide:
1. Video Title and Hook (first 10 seconds)
2. Introduction (30-60 seconds)
3. Main Content Sections (with timestamps)
   - Key points to cover
   - Visual suggestions (graphics, animations, demonstrations)
   - Narration script for each section
4. Practical Examples/Demonstrations
5. Summary and Key Takeaways (30 seconds)
6. Call to Action/Next Steps

Format with clear timestamps and visual cues. Estimated total duration: 8-12 minutes.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("AI gateway error:", response.status, error);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content generated");
    }

    console.log("Video content generated successfully");

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in generate-video-content:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate video content" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
