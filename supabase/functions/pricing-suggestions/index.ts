import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const pricingSchema = z.object({
  courseTitle: z.string().min(1, "Course title required").max(200, "Title too long"),
  courseDescription: z.string().min(1, "Description required").max(2000, "Description too long"),
  competitorPricing: z.string().max(1000).optional()
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const debug = new URL(req.url).searchParams.get('debug') === '1' || req.headers.get('x-debug') === '1';

  try {
    // Verify JWT authentication (signing-keys compatible)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          ...(debug
            ? {
                debug: {
                  reason: !authHeader ? 'missing_authorization_header' : 'authorization_not_bearer',
                  headerKeys: Array.from(req.headers.keys()),
                },
              }
            : {}),
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      let authUserStatus: number | null = null;
      let authUserError: unknown = null;

      if (debug) {
        try {
          const authResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              Authorization: authHeader,
              apikey: supabaseAnonKey,
            },
          });
          authUserStatus = authResp.status;
          authUserError = await authResp.json().catch(() => null);
        } catch (e) {
          authUserError = e instanceof Error ? e.message : String(e);
        }
      }

      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          ...(debug
            ? {
                debug: {
                  reason: claimsError ? 'claims_error' : 'missing_sub_claim',
                  tokenLength: token.length,
                  claimsError: claimsError ? (claimsError as any).message ?? String(claimsError) : null,
                  authUserStatus,
                  authUserError,
                },
              }
            : {}),
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = pricingSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { courseTitle, courseDescription, competitorPricing } = validationResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating pricing suggestions for user:", userId);

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
            content: "You are a pricing strategy expert for online courses. Provide data-driven pricing recommendations."
          },
          {
            role: "user",
            content: `Suggest optimal pricing for this course:

Course: ${courseTitle}
Description: ${courseDescription}
${competitorPricing ? `Competitor pricing: ${competitorPricing}` : ''}

Provide:
1. Recommended price range (in THB)
2. Rationale for the pricing
3. Three pricing tiers (basic, standard, premium) if applicable
4. Positioning strategy`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        return new Response(JSON.stringify({ error: "Rate limit or payment issue" }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const suggestions = data.choices?.[0]?.message?.content;

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in pricing-suggestions:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred generating pricing suggestions" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});