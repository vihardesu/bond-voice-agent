import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Singleton remote agent row for the frozen Daphne v2 Level 4 harness. */
export const level4Agents = sqliteTable("level4_agents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique().default("daphne_v2"),
  displayName: text("display_name").notNull(),
  elevenLabsAgentId: text("elevenlabs_agent_id").notNull(),
  exaWebSearchToolId: text("exa_web_search_tool_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export const level4Sessions = sqliteTable("level4_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: integer("agent_id")
    .notNull()
    .references(() => level4Agents.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  status: text("status", { enum: ["active", "ended"] })
    .notNull()
    .default("active"),
  memoryBank: text("memory_bank").notNull().default(""),
  elevenLabsAgentId: text("elevenlabs_agent_id").notNull(),
  elevenLabsConversationId: text("elevenlabs_conversation_id"),
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

export type Level4Agent = typeof level4Agents.$inferSelect;
export type NewLevel4Agent = typeof level4Agents.$inferInsert;
export type Level4Session = typeof level4Sessions.$inferSelect;
export type NewLevel4Session = typeof level4Sessions.$inferInsert;
