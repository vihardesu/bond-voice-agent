import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import {
  COMMUNICATION_STYLES,
  EXPLANATION_LEVELS,
  INTERRUPTION_MODES,
  LLM_OPTIONS,
  PERSONA_PRESETS,
  PROMPT_PROFILES,
  RESOLUTION_BIASES,
  SAFETY_POSTURES,
  TTS_MODELS,
  TURN_EAGERNESS_OPTIONS,
  VARIANT_LABELS,
  VOICE_PRESETS,
} from "./settings.js";

export const level3Agents = sqliteTable("level3_agents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  displayName: text("display_name").notNull(),
  variantLabel: text("variant_label", { enum: VARIANT_LABELS })
    .notNull()
    .default("alpha"),
  elevenLabsAgentId: text("elevenlabs_agent_id").notNull(),
  communicationStyle: text("communication_style", {
    enum: COMMUNICATION_STYLES,
  })
    .notNull()
    .default("balanced"),
  explanationLevel: text("explanation_level", { enum: EXPLANATION_LEVELS })
    .notNull()
    .default("balanced"),
  safetyPosture: text("safety_posture", { enum: SAFETY_POSTURES })
    .notNull()
    .default("balanced"),
  resolutionBias: text("resolution_bias", { enum: RESOLUTION_BIASES })
    .notNull()
    .default("fewest_steps"),
  turnEagerness: text("turn_eagerness", { enum: TURN_EAGERNESS_OPTIONS })
    .notNull()
    .default("normal"),
  voicePreset: text("voice_preset", { enum: VOICE_PRESETS })
    .notNull()
    .default("sarah"),
  ttsModel: text("tts_model", { enum: TTS_MODELS })
    .notNull()
    .default("eleven_flash_v2"),
  llm: text("llm", { enum: LLM_OPTIONS }).notNull().default("gemini-2.5-flash"),
  interruptionMode: text("interruption_mode", { enum: INTERRUPTION_MODES })
    .notNull()
    .default("ignore_backchannels"),
  personaPreset: text("persona_preset", { enum: PERSONA_PRESETS })
    .notNull()
    .default("mira"),
  promptProfile: text("prompt_profile", { enum: PROMPT_PROFILES })
    .notNull()
    .default("warm_empathetic"),
  enabledTools: text("enabled_tools").notNull().default("[]"),
  systemPrompt: text("system_prompt").notNull().default(""),
  firstMessage: text("first_message").notNull().default(""),
  asrKeywords: text("asr_keywords").notNull().default("[]"),
  interruptionIgnoreTerms: text("interruption_ignore_terms").notNull().default("[]"),
  extraGuardrailPrompt: text("extra_guardrail_prompt").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export const level3Sessions = sqliteTable("level3_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: integer("agent_id")
    .notNull()
    .references(() => level3Agents.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  status: text("status", { enum: ["active", "ended"] })
    .notNull()
    .default("active"),
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

export type Level3Agent = typeof level3Agents.$inferSelect;
export type NewLevel3Agent = typeof level3Agents.$inferInsert;
export type Level3Session = typeof level3Sessions.$inferSelect;
export type NewLevel3Session = typeof level3Sessions.$inferInsert;
