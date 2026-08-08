import { NextResponse } from "next/server";

import { getConversation } from "@/lib/conversations";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const conversation = getConversation(id);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("Failed to get conversation:", error);
    return NextResponse.json(
      { error: "Failed to get conversation" },
      { status: 500 },
    );
  }
}
