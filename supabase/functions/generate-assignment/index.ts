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

    console.log("Generating assignment for:", lessonTitle);

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
            content: `You are an expert educational assignment designer. Generate practical, hands-on assignments that apply learned concepts to real-world scenarios.`
          },
          {
            role: "user",
            content: `Create a comprehensive assignment for the lesson: "${lessonTitle}"
            
${lessonDescription ? `Lesson Description: ${lessonDescription}` : ''}
Course Context: ${courseContext || "General course"}

Please provide:
1. Assignment Overview and Objectives
   - What students will accomplish
   - Skills they will demonstrate
   
2. Assignment Instructions
   - Step-by-step tasks to complete
   - Requirements and specifications
   - Resources needed
   
3. Detailed Tasks/Questions (5-7 tasks)
   - Mix of theoretical and practical tasks
   - Real-world application scenarios
   - Problem-solving challenges
   
4. Submission Guidelines
   - Format requirements
   - What to include
   - Due date suggestions
   
5. Grading Rubric
   - Criteria for evaluation
   - Point distribution
   - Examples of excellent, good, and needs improvement work
   
6. Tips for Success and Common Pitfalls to Avoid

Make the assignment practical, engaging, and directly applicable to real-world scenarios.`
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

    console.log("Assignment generated successfully");

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in generate-assignment:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate assignment" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
