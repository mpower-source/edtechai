import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const emailRequestSchema = z.object({
  to: z.string().email("Invalid email address").max(255, "Email too long"),
  type: z.enum(["welcome", "enrollment", "lesson_available", "community_post", "completion"]),
  data: z.object({
    name: z.string().max(200).optional(),
    platformUrl: z.string().url().max(500).optional(),
    courseName: z.string().max(200).optional(),
    startDate: z.string().max(100).optional(),
    courseUrl: z.string().url().max(500).optional(),
    lessonTitle: z.string().max(200).optional(),
    lessonDescription: z.string().max(1000).optional(),
    lessonUrl: z.string().url().max(500).optional(),
    spaceName: z.string().max(200).optional(),
    authorName: z.string().max(200).optional(),
    content: z.string().max(5000).optional(),
    postUrl: z.string().url().max(500).optional(),
    certificateUrl: z.string().url().max(500).optional(),
  }).passthrough()
});

// Sanitize HTML to prevent XSS in emails
const sanitizeHtml = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

const getEmailContent = (type: string, data: any) => {
  // Sanitize all user-provided data
  const safeName = sanitizeHtml(data.name || '');
  const safeCourseName = sanitizeHtml(data.courseName || '');
  const safeLessonTitle = sanitizeHtml(data.lessonTitle || '');
  const safeLessonDescription = sanitizeHtml(data.lessonDescription || '');
  const safeSpaceName = sanitizeHtml(data.spaceName || '');
  const safeAuthorName = sanitizeHtml(data.authorName || '');
  const safeContent = sanitizeHtml(data.content || '');
  const safeStartDate = sanitizeHtml(data.startDate || '');

  switch (type) {
    case "welcome":
      return {
        subject: "Welcome to Our EdTech Platform! 🎓",
        html: `
          <h1>Welcome, ${safeName}!</h1>
          <p>We're excited to have you join our learning community.</p>
          <p>Start exploring courses and begin your learning journey today!</p>
          <p><a href="${data.platformUrl}">Go to Dashboard</a></p>
        `
      };
    
    case "enrollment":
      return {
        subject: `You're enrolled in ${safeCourseName}! 🎉`,
        html: `
          <h1>Enrollment Confirmed!</h1>
          <p>You've successfully enrolled in <strong>${safeCourseName}</strong>.</p>
          <p>Course starts: ${safeStartDate || "Access available now"}</p>
          <p><a href="${data.courseUrl}">Start Learning</a></p>
        `
      };
    
    case "lesson_available":
      return {
        subject: `New Lesson Available: ${safeLessonTitle} 📚`,
        html: `
          <h1>New Lesson Ready!</h1>
          <p>A new lesson is now available in <strong>${safeCourseName}</strong>:</p>
          <h2>${safeLessonTitle}</h2>
          <p>${safeLessonDescription}</p>
          <p><a href="${data.lessonUrl}">View Lesson</a></p>
        `
      };
    
    case "community_post":
      return {
        subject: `New activity in ${safeSpaceName} 💬`,
        html: `
          <h1>New Community Activity</h1>
          <p><strong>${safeAuthorName}</strong> posted in ${safeSpaceName}:</p>
          <blockquote>${safeContent.substring(0, 200)}...</blockquote>
          <p><a href="${data.postUrl}">View Post</a></p>
        `
      };
    
    case "completion":
      return {
        subject: `Congratulations! You completed ${safeCourseName} 🎊`,
        html: `
          <h1>Course Completed!</h1>
          <p>Congratulations on completing <strong>${safeCourseName}</strong>!</p>
          <p>You've earned your certificate of completion.</p>
          <p><a href="${data.certificateUrl}">Download Certificate</a></p>
        `
      };
    
    default:
      return {
        subject: "Notification from EdTech Platform",
        html: "<p>You have a new notification.</p>"
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = emailRequestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.errors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const { to, type, data } = validationResult.data;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { subject, html } = getEmailContent(type, data);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EdTech Platform <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", response.status, error);
      throw new Error("Failed to send email");
    }

    const result = await response.json();
    console.log("Email sent successfully:", result.id);

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
