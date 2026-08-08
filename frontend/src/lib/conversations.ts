import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  conversationSessions,
  transcriptMessages,
  type ConversationSession,
  type TranscriptMessage,
} from "@/db/schema";

export type TranscriptInput = {
  role: "user" | "assistant";
  content: string;
};

export type ConversationSummary = ConversationSession & {
  messageCount: number;
  preview: string | null;
};

export type ConversationDetail = ConversationSession & {
  messages: TranscriptMessage[];
};

function buildTitle(messages: TranscriptInput[], startedAt: Date): string {
  const firstUser = messages.find((message) => message.role === "user");
  if (firstUser?.content.trim()) {
    const snippet = firstUser.content.trim().replace(/\s+/g, " ");
    return snippet.length > 60 ? `${snippet.slice(0, 57)}…` : snippet;
  }
  return `Conversation · ${startedAt.toLocaleString()}`;
}

export function listConversations(): ConversationSummary[] {
  const sessions = db
    .select()
    .from(conversationSessions)
    .orderBy(desc(conversationSessions.endedAt))
    .all();

  return sessions.map((session) => {
    const messages = db
      .select()
      .from(transcriptMessages)
      .where(eq(transcriptMessages.sessionId, session.id))
      .orderBy(asc(transcriptMessages.sequence))
      .all();

    const preview = messages[0]?.content ?? null;

    return {
      ...session,
      messageCount: messages.length,
      preview,
    };
  });
}

export function getConversation(id: string): ConversationDetail | null {
  const session = db
    .select()
    .from(conversationSessions)
    .where(eq(conversationSessions.id, id))
    .get();

  if (!session) return null;

  const messages = db
    .select()
    .from(transcriptMessages)
    .where(eq(transcriptMessages.sessionId, id))
    .orderBy(asc(transcriptMessages.sequence))
    .all();

  return { ...session, messages };
}

export function createConversation(input: {
  startedAt: string | number | Date;
  endedAt: string | number | Date;
  durationMs: number;
  messages: TranscriptInput[];
}): ConversationDetail {
  const startedAt = new Date(input.startedAt);
  const endedAt = new Date(input.endedAt);
  const createdAt = new Date();
  const id = crypto.randomUUID();

  const normalizedMessages = input.messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0);

  db.insert(conversationSessions)
    .values({
      id,
      title: buildTitle(normalizedMessages, startedAt),
      durationMs: Math.max(0, Math.round(input.durationMs)),
      startedAt,
      endedAt,
      createdAt,
    })
    .run();

  if (normalizedMessages.length > 0) {
    db.insert(transcriptMessages)
      .values(
        normalizedMessages.map((message, index) => ({
          id: crypto.randomUUID(),
          sessionId: id,
          role: message.role,
          content: message.content,
          sequence: index,
          createdAt,
        })),
      )
      .run();
  }

  const created = getConversation(id);
  if (!created) {
    throw new Error("Failed to load conversation after create");
  }
  return created;
}
