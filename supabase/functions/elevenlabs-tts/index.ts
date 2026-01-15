import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Top ElevenLabs voices for student TTS
const ALLOWED_VOICES = [
  "JBFqnCBsd6RMkjVDRZzb", // George
  "EXAVITQu4vr4xnSDxMaL", // Sarah
  "onwK4e9ZLuTAKqWW03F9", // Daniel
  "XrExE9yKIg1WjnnlVkGX", // Matilda
  "pFZP5JQG7iQjIQuC4Bku", // Lily
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId = "JBFqnCBsd6RMkjVDRZzb" } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit text length to prevent abuse (roughly 2 minutes of speech)
    if (text.length > 3000) {
      return new Response(
        JSON.stringify({ error: "Text too long. Maximum 3000 characters for AI voice." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate voice ID
    if (!ALLOWED_VOICES.includes(voiceId)) {
      return new Response(
        JSON.stringify({ error: "Invalid voice selected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating TTS for student, voice:", voiceId, "text length:", text.length);

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5", // Faster model for student playback
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text().catch(() => "");
      console.error("ElevenLabs TTS failed:", ttsResponse.status, errText);
      
      if (ttsResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI voice limit reached. Please use browser voice instead." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI voice generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const base64Audio = base64Encode(audioBuffer);

    console.log("TTS audio generated successfully, size:", audioBuffer.byteLength);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        format: "mp3"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in elevenlabs-tts:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate audio" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
