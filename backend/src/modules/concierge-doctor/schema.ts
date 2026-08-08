import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const conciergeConfig = sqliteTable("concierge_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  elevenLabsAgentId: text("elevenlabs_agent_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export const conciergeSessions = sqliteTable("concierge_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().default(""),
  status: text("status", { enum: ["active", "ended"] })
    .notNull()
    .default("active"),
  elevenLabsAgentId: text("elevenlabs_agent_id").notNull(),
  elevenLabsConversationId: text("elevenlabs_conversation_id"),
  communicationStyle: text("communication_style", {
    enum: ["patient", "balanced", "direct"],
  })
    .notNull()
    .default("balanced"),
  explanationLevel: integer("explanation_level").notNull().default(50),
  startedAt: integer("started_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  durationMs: integer("duration_ms"),
  transcript: text("transcript").notNull().default("[]"),
  clinicalContext: text("clinical_context").notNull().default("{}"),
  resolution: text("resolution"),
  events: text("events").notNull().default("[]"),
  metrics: text("metrics").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export type ConciergeConfig = typeof conciergeConfig.$inferSelect;
export type NewConciergeConfig = typeof conciergeConfig.$inferInsert;
export type ConciergeSession = typeof conciergeSessions.$inferSelect;
export type NewConciergeSession = typeof conciergeSessions.$inferInsert;
