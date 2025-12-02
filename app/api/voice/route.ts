import { env } from "@/lib/env/getEnvVars";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL = "https://api.ultravox.ai/api";

// Cache voices for 1 hour
let cachedVoices: any = null;
let lastCacheTime: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export async function GET(req: NextRequest) {
  try {
    // Return cached voices if available and not expired
    const now = Date.now();
    if (cachedVoices && now - lastCacheTime < CACHE_DURATION) {
      return new NextResponse(JSON.stringify(cachedVoices), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch voices from Ultravox API
    const response = await fetch(`${BASE_URL}/voices`, {
      method: "GET",
      headers: {
        "X-API-Key": env.ULTRAVOX_API_KEY || "",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const voices = data.results.map((voice: any) => ({
      voiceId: voice.voiceId,
      name: voice.name,
      previewUrl: voice.previewUrl,
    }));

    // Cache the voices
    cachedVoices = voices;
    lastCacheTime = now;

    return new NextResponse(JSON.stringify(voices), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error fetching voices:", error);
    return new NextResponse(
      JSON.stringify({ error: error.message || "Failed to fetch voices" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Note: The POST endpoint will need to be updated once you provide the
// text-to-speech endpoint details for Ultravox API
export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json();

    if (!text || !voiceId) {
      return new NextResponse(
        JSON.stringify({ error: "Text and voiceId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // TODO: Update this section with Ultravox text-to-speech API endpoint
    // Currently keeping ElevenLabs implementation until Ultravox TTS details are provided
    throw new Error(
      "Text-to-speech endpoint needs to be updated for Ultravox API"
    );
  } catch (error: any) {
    console.error("Error generating speech:", error);
    return new NextResponse(
      JSON.stringify({ error: error.message || "Failed to generate speech" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
