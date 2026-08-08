import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const speechSessions = sqliteTable("speech_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().default(""),
  status: text("status", { enum: ["active", "ended"] })
    .notNull()
    .default("active"),
  model: text("model").notNull().default("gpt-realtime-2.1"),
  voice: text("voice").notNull().default("marin"),
  startedAt: integer("started_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  durationMs: integer("duration_ms"),
  transcript: text("transcript").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export type SpeechSession = typeof speechSessions.$inferSelect;
export type NewSpeechSession = typeof speechSessions.$inferInsert;
