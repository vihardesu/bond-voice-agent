import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const conversationSessions = sqliteTable("conversation_sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  durationMs: integer("duration_ms").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const transcriptMessages = sqliteTable("transcript_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => conversationSessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  sequence: integer("sequence").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const conversationSessionsRelations = relations(
  conversationSessions,
  ({ many }) => ({
    messages: many(transcriptMessages),
  }),
);

export const transcriptMessagesRelations = relations(
  transcriptMessages,
  ({ one }) => ({
    session: one(conversationSessions, {
      fields: [transcriptMessages.sessionId],
      references: [conversationSessions.id],
    }),
  }),
);

export type ConversationSession = typeof conversationSessions.$inferSelect;
export type NewConversationSession = typeof conversationSessions.$inferInsert;
export type TranscriptMessage = typeof transcriptMessages.$inferSelect;
export type NewTranscriptMessage = typeof transcriptMessages.$inferInsert;
