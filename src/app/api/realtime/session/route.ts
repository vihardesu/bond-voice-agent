import { NextResponse } from "next/server";
import { getOpenAIClient, REALTIME_MODEL } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST() {
  try {
    const openai = getOpenAIClient();

    const clientSecret = await openai.realtime.clientSecrets.create({
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions:
          "You are a helpful, friendly voice assistant. Keep replies concise and conversational. Speak naturally.",
        audio: {
          input: {
            transcription: { model: "gpt-4o-mini-transcribe" },
            turn_detection: {
              type: "server_vad",
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            voice: "marin",
          },
        },
      },
    });

    return NextResponse.json({
      value: clientSecret.value,
      expires_at: clientSecret.expires_at,
      model: REALTIME_MODEL,
    });
  } catch (error) {
    console.error("Failed to create realtime client secret:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
