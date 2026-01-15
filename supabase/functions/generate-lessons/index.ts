import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const generateLessonsSchema = z.object({
  courseTitle: z
    .string()
    .min(1, "Course title is required")
    .max(200, "Course title too long"),
  courseDescription: z
    .string()
    .max(2000, "Course description too long")
    .optional(),
  courseId: z.string().uuid("Invalid course ID format"),
});

// AI output validation (keep this small and strict to avoid invalid JSON)
const aiLessonSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  lesson_type: z.enum(["text", "video", "quiz", "assignment"]).default("text"),
  duration_minutes: z.coerce.number().int().min(1).max(600).default(30),
});

const aiLessonsResponseSchema = z.object({
  lessons: z.array(aiLessonSchema).min(3).max(12),
});

function extractJsonCandidate(text: string) {
  // Remove common markdown code fences if present
  const cleaned = text
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  const starts = [firstBrace, firstBracket].filter((i) => i >= 0);
  if (starts.length === 0) return cleaned;

  const start = Math.min(...starts);
  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");
  const end = Math.max(lastBrace, lastBracket);

  if (end > start) return cleaned.slice(start, end + 1);
  return cleaned.slice(start);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Create client with user's JWT to verify identity and ownership
    const userSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is authenticated
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = generateLessonsSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { courseTitle, courseDescription, courseId } = validationResult.data;

    // Verify course ownership before proceeding
    const { data: course, error: courseError } = await userSupabase
      .from('courses')
      .select('creator_id')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: 'Course not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (course.creator_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to modify this course' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const systemPrompt = `You are an expert course designer.

Return ONLY valid JSON (no markdown, no code fences, no commentary) matching this shape:

{
  "lessons": [
    {
      "title": string,
      "description": string,
      "lesson_type": "text" | "video" | "quiz" | "assignment",
      "duration_minutes": number
    }
  ]
}

Rules:
- Generate 5-8 lessons.
- Titles: <= 120 characters.
- Descriptions: 1-2 sentences, plain text.
- duration_minutes: integer 5-60.
- Include a mix of lesson_type values across lessons.
- Ensure the JSON is strictly valid. Use double quotes for keys/strings and escape newlines as \\n inside strings.`;

    const userPrompt = `Course Title: ${courseTitle}
${courseDescription ? `Course Description: ${courseDescription}` : ""}

Generate the lesson list.`;

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
            model: "google/gemini-3-flash-preview",
            temperature: 0.2,
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
    const content = data.choices?.[0]?.message?.content ?? "";
    console.log("Received AI response");

    const jsonCandidate = extractJsonCandidate(content);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonCandidate);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      console.error("AI raw (truncated):", content.slice(0, 2000));
      return new Response(
        JSON.stringify({
          error: "Failed to parse lesson data",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const normalized = Array.isArray(parsedJson)
      ? { lessons: parsedJson }
      : (parsedJson as Record<string, unknown>);

    const lessonsParse = aiLessonsResponseSchema.safeParse(normalized);
    if (!lessonsParse.success) {
      console.error("AI lesson schema validation failed:", lessonsParse.error);
      return new Response(
        JSON.stringify({ error: "Invalid lesson data format" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const lessonsData = lessonsParse.data.lessons;

    // Use service role key for the insert (after ownership is verified)
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const lessonsToInsert = lessonsData.map((lesson, index) => ({
      course_id: courseId,
      title: String(lesson.title || "").substring(0, 500),
      description: String(lesson.description || "").substring(0, 2000),
      lesson_type: ["text", "video", "quiz", "assignment"].includes(lesson.lesson_type)
        ? lesson.lesson_type
        : "text",
      duration_minutes: Math.min(
        Math.max(Number(lesson.duration_minutes) || 30, 1),
        600
      ),
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
      JSON.stringify({ error: "An error occurred generating lessons" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
