import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  type: "welcome" | "enrollment" | "lesson_available" | "community_post" | "completion";
  data: Record<string, any>;
}

const getEmailContent = (type: string, data: any) => {
  switch (type) {
    case "welcome":
      return {
        subject: "Welcome to Our EdTech Platform! 🎓",
        html: `
          <h1>Welcome, ${data.name}!</h1>
          <p>We're excited to have you join our learning community.</p>
          <p>Start exploring courses and begin your learning journey today!</p>
          <p><a href="${data.platformUrl}">Go to Dashboard</a></p>
        `
      };
    
    case "enrollment":
      return {
        subject: `You're enrolled in ${data.courseName}! 🎉`,
        html: `
          <h1>Enrollment Confirmed!</h1>
          <p>You've successfully enrolled in <strong>${data.courseName}</strong>.</p>
          <p>Course starts: ${data.startDate || "Access available now"}</p>
          <p><a href="${data.courseUrl}">Start Learning</a></p>
        `
      };
    
    case "lesson_available":
      return {
        subject: `New Lesson Available: ${data.lessonTitle} 📚`,
        html: `
          <h1>New Lesson Ready!</h1>
          <p>A new lesson is now available in <strong>${data.courseName}</strong>:</p>
          <h2>${data.lessonTitle}</h2>
          <p>${data.lessonDescription || ""}</p>
          <p><a href="${data.lessonUrl}">View Lesson</a></p>
        `
      };
    
    case "community_post":
      return {
        subject: `New activity in ${data.spaceName} 💬`,
        html: `
          <h1>New Community Activity</h1>
          <p><strong>${data.authorName}</strong> posted in ${data.spaceName}:</p>
          <blockquote>${data.content.substring(0, 200)}...</blockquote>
          <p><a href="${data.postUrl}">View Post</a></p>
        `
      };
    
    case "completion":
      return {
        subject: `Congratulations! You completed ${data.courseName} 🎊`,
        html: `
          <h1>Course Completed!</h1>
          <p>Congratulations on completing <strong>${data.courseName}</strong>!</p>
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
    const { to, type, data }: EmailRequest = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    if (!to || !type) {
      throw new Error("Missing required fields: to, type");
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
      throw new Error(`Failed to send email: ${error}`);
    }

    const result = await response.json();
    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
