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

    console.log("Generating quiz for:", lessonTitle);

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
            content: `You are an expert educational assessment designer. Generate comprehensive quizzes that test understanding and application of concepts.`
          },
          {
            role: "user",
            content: `Create a comprehensive quiz for the lesson: "${lessonTitle}"
            
${lessonDescription ? `Lesson Description: ${lessonDescription}` : ''}
Course Context: ${courseContext || "General course"}

Please provide:
1. Quiz Instructions (how to take the quiz, time limit if applicable)
2. 10-15 Multiple Choice Questions
   - Question text
   - 4 options (A, B, C, D)
   - Correct answer
   - Brief explanation of why the answer is correct
3. 3-5 True/False Questions with explanations
4. 2-3 Short Answer Questions with sample answers
5. Scoring rubric and passing criteria

Format each question clearly with the correct answer and explanation. Mix difficulty levels from basic recall to application and analysis.`
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

    console.log("Quiz generated successfully");

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in generate-quiz:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate quiz" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
