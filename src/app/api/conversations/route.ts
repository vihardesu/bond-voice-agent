import { NextResponse } from "next/server";

import { createConversation, listConversations } from "@/lib/conversations";

export const runtime = "nodejs";

export async function GET() {
  try {
    const conversations = listConversations();
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Failed to list conversations:", error);
    return NextResponse.json(
      { error: "Failed to list conversations" },
      { status: 500 },
    );
  }
}

type CreateBody = {
  startedAt?: string | number;
  endedAt?: string | number;
  durationMs?: number;
  messages?: Array<{ role?: string; content?: string }>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBody;

    const startedAt = body.startedAt;
    const endedAt = body.endedAt;
    const durationMs = body.durationMs;
    const messages = body.messages;

    if (
      startedAt == null ||
      endedAt == null ||
      typeof durationMs !== "number" ||
      !Array.isArray(messages)
    ) {
      return NextResponse.json(
        {
          error:
            "startedAt, endedAt, durationMs, and messages are required",
        },
        { status: 400 },
      );
    }

    const normalizedMessages = messages
      .filter(
        (message): message is { role: "user" | "assistant"; content: string } =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string",
      )
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    if (normalizedMessages.length === 0) {
      return NextResponse.json(
        { error: "At least one transcript message is required" },
        { status: 400 },
      );
    }

    const conversation = createConversation({
      startedAt,
      endedAt,
      durationMs,
      messages: normalizedMessages,
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 },
    );
  }
}
