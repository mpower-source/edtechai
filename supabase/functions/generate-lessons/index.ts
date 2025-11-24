import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseTitle, courseDescription, courseId } = await req.json();

    if (!courseTitle || !courseId) {
      return new Response(
        JSON.stringify({ error: "Course title and ID are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "AI service is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = `You are an expert course designer. Generate a comprehensive lesson plan for an online course.
Return a JSON array of lessons, where each lesson has:
- title: string (clear, engaging lesson title)
- description: string (2-3 sentences describing what students will learn)
- content: string (detailed lesson content in markdown format, minimum 500 words)
- lesson_type: "text" | "video" | "quiz" | "assignment"
- duration_minutes: number (estimated time to complete)

Generate 5-8 lessons that provide comprehensive coverage of the topic.
Include a mix of different lesson types.
Ensure content is educational, well-structured, and actionable.`;

    const userPrompt = `Course Title: ${courseTitle}
${courseDescription ? `Course Description: ${courseDescription}` : ""}

Generate a complete lesson plan with detailed content for each lesson.`;

    console.log("Calling Lovable AI for lesson generation...");
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again in a moment.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI service requires payment. Please add credits to continue.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to generate lessons" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    console.log("Received AI response");

    let lessonsData;
    try {
      const parsed = JSON.parse(content);
      lessonsData = parsed.lessons || parsed;
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return new Response(
        JSON.stringify({ error: "Failed to parse lesson data" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!Array.isArray(lessonsData)) {
      console.error("Lessons data is not an array:", lessonsData);
      return new Response(
        JSON.stringify({ error: "Invalid lesson data format" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const lessonsToInsert = lessonsData.map((lesson: any, index: number) => ({
      course_id: courseId,
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      lesson_type: lesson.lesson_type || "text",
      duration_minutes: lesson.duration_minutes || 30,
      order_index: index,
      is_free: index === 0,
    }));

    console.log(`Inserting ${lessonsToInsert.length} lessons...`);
    const { error: insertError } = await supabase
      .from("lessons")
      .insert(lessonsToInsert);

    if (insertError) {
      console.error("Error inserting lessons:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save lessons to database" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Lessons generated and saved successfully");
    return new Response(
      JSON.stringify({
        success: true,
        lessonCount: lessonsToInsert.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-lessons function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
