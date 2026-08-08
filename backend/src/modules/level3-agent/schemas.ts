import { z } from "@hono/zod-openapi";

import {
  COMMUNICATION_STYLES,
  EXPLANATION_LEVELS,
  INTERRUPTION_MODES,
  LLM_OPTIONS,
  PERSONA_PRESETS,
  PROMPT_PROFILES,
  RESOLUTION_BIASES,
  SAFETY_POSTURES,
  TOOL_OPTIONS,
  TTS_MODELS,
  TURN_EAGERNESS_OPTIONS,
  VARIANT_LABELS,
  VOICE_PRESETS,
} from "./settings.js";

export const CommunicationStyleSchema = z.enum(COMMUNICATION_STYLES);
export const ExplanationLevelSchema = z.enum(EXPLANATION_LEVELS);
export const SafetyPostureSchema = z.enum(SAFETY_POSTURES);
export const ResolutionBiasSchema = z.enum(RESOLUTION_BIASES);
export const TurnEagernessSchema = z.enum(TURN_EAGERNESS_OPTIONS);
export const VoicePresetSchema = z.enum(VOICE_PRESETS);
export const TtsModelSchema = z.enum(TTS_MODELS);
export const LlmOptionSchema = z.enum(LLM_OPTIONS);
export const InterruptionModeSchema = z.enum(INTERRUPTION_MODES);
export const PersonaPresetSchema = z.enum(PERSONA_PRESETS);
export const PromptProfileSchema = z.enum(PROMPT_PROFILES);
export const ToolOptionSchema = z.enum(TOOL_OPTIONS);
export const VariantLabelSchema = z.enum(VARIANT_LABELS);

export const Level3AgentSettingsSchema = z
  .object({
    variantLabel: VariantLabelSchema.default("alpha"),
    communicationStyle: CommunicationStyleSchema.default("balanced"),
    explanationLevel: ExplanationLevelSchema.default("balanced"),
    safetyPosture: SafetyPostureSchema.default("balanced"),
    resolutionBias: ResolutionBiasSchema.default("fewest_steps"),
    turnEagerness: TurnEagernessSchema.default("normal"),
    voicePreset: VoicePresetSchema.default("sarah"),
    ttsModel: TtsModelSchema.default("eleven_flash_v2"),
    llm: LlmOptionSchema.default("gemini-2.5-flash"),
    interruptionMode: InterruptionModeSchema.default("ignore_backchannels"),
    personaPreset: PersonaPresetSchema.default("mira"),
    promptProfile: PromptProfileSchema.default("warm_empathetic"),
    enabledTools: z
      .array(ToolOptionSchema)
      .min(1)
      .default([...TOOL_OPTIONS]),
  })
  .openapi("Level3AgentSettings");

export const CreateLevel3AgentSchema = Level3AgentSettingsSchema.openapi(
  "CreateLevel3Agent",
);

export const UpdateLevel3AgentSchema = Level3AgentSettingsSchema.partial().openapi(
  "UpdateLevel3Agent",
);

export const Level3AgentSchema = z
  .object({
    id: z.number().int(),
    displayName: z.string(),
    elevenLabsAgentId: z.string(),
    variantLabel: VariantLabelSchema,
    communicationStyle: CommunicationStyleSchema,
    explanationLevel: ExplanationLevelSchema,
    safetyPosture: SafetyPostureSchema,
    resolutionBias: ResolutionBiasSchema,
    turnEagerness: TurnEagernessSchema,
    voicePreset: VoicePresetSchema,
    ttsModel: TtsModelSchema,
    llm: LlmOptionSchema,
    interruptionMode: InterruptionModeSchema,
    personaPreset: PersonaPresetSchema,
    promptProfile: PromptProfileSchema,
    enabledTools: z.array(ToolOptionSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Level3Agent");

export const TranscriptEntrySchema = z
  .object({
    role: z.enum(["user", "agent"]),
    text: z.string(),
    at: z.string().datetime(),
  })
  .openapi("Level3TranscriptEntry");

export const ClinicalContextSchema = z
  .object({
    symptom: z.string().optional(),
    duration: z.string().optional(),
    history: z.string().optional(),
    currentMedications: z.string().optional(),
    unknowns: z.string().optional(),
    notes: z.string().optional(),
  })
  .openapi("Level3ClinicalContext");

export const ResolutionSchema = z
  .object({
    type: z.enum([
      "self_care_watch",
      "scheduled_follow_up",
      "pharmacy_request",
      "human_handoff",
      "emergency_care",
      "other",
    ]),
    summary: z.string(),
    confirmationId: z.string().optional(),
    reassurance: z.string().optional(),
    handoffReason: z.string().optional(),
    pharmacy: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi("Level3Resolution");

export const ObservabilityEventSchema = z
  .object({
    at: z.string().datetime(),
    type: z.enum([
      "status",
      "transcript",
      "ping",
      "vad",
      "interruption",
      "tool_request",
      "tool_response",
      "watch",
      "guardrail",
      "error",
      "metric",
      "mode",
    ]),
    message: z.string(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi("Level3ObservabilityEvent");

export const MetricsSchema = z
  .object({
    avgLatencyMs: z.number().nullable().optional(),
    latestLatencyMs: z.number().nullable().optional(),
    latencySampleCount: z.number().optional(),
    turnCount: z.number().optional(),
    toolCallCount: z.number().optional(),
    watchEventCount: z.number().optional(),
    interruptionCount: z.number().optional(),
    avgVadScore: z.number().nullable().optional(),
    elevenLabsCostCredits: z.number().nullable().optional(),
    elevenLabsCostUsd: z.number().nullable().optional(),
    callDurationSecs: z.number().nullable().optional(),
    charging: z.unknown().optional(),
    featuresUsage: z.unknown().optional(),
    terminationReason: z.string().nullable().optional(),
    analysisSummary: z.string().nullable().optional(),
    ttsModel: z.string().optional(),
    asrProvider: z.string().optional(),
    turnModel: z.string().optional(),
    llm: z.string().optional(),
    voicePreset: z.string().optional(),
  })
  .passthrough()
  .openapi("Level3Metrics");

export const Level3SessionSchema = z
  .object({
    id: z.number().int(),
    agentId: z.number().int(),
    agentDisplayName: z.string(),
    title: z.string(),
    status: z.enum(["active", "ended"]),
    elevenLabsAgentId: z.string(),
    elevenLabsConversationId: z.string().nullable(),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().nullable(),
    durationMs: z.number().int().nullable(),
    transcript: z.array(TranscriptEntrySchema),
    clinicalContext: ClinicalContextSchema,
    resolution: ResolutionSchema.nullable(),
    events: z.array(ObservabilityEventSchema),
    metrics: MetricsSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Level3Session");

export const StartLevel3SessionSchema = z
  .object({
    title: z.string().optional().default(""),
    forceSyncAgent: z.boolean().optional().default(true),
  })
  .openapi("StartLevel3Session");

export const StartLevel3SessionResponseSchema = z
  .object({
    session: Level3SessionSchema,
    conversationToken: z.string(),
    conversationId: z.string(),
    dynamicVariables: z.object({
      communication_style: z.string(),
      explanation_level: z.string(),
      safety_posture: z.string(),
      resolution_bias: z.string(),
    }),
    enabledTools: z.array(ToolOptionSchema),
  })
  .openapi("StartLevel3SessionResponse");

export const UpdateLevel3SessionSchema = z
  .object({
    title: z.string().optional(),
    status: z.enum(["active", "ended"]).optional(),
    endedAt: z.string().datetime().optional(),
    durationMs: z.number().int().nonnegative().optional(),
    transcript: z.array(TranscriptEntrySchema).optional(),
    clinicalContext: ClinicalContextSchema.optional(),
    resolution: ResolutionSchema.nullable().optional(),
    events: z.array(ObservabilityEventSchema).optional(),
    appendEvents: z.array(ObservabilityEventSchema).optional(),
    metrics: MetricsSchema.optional(),
    elevenLabsConversationId: z.string().optional(),
    syncRemoteMetrics: z.boolean().optional(),
  })
  .openapi("UpdateLevel3Session");

export const IdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/)
    .openapi({
      param: { name: "id", in: "path" },
      example: "1",
    }),
});

export const ErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi("Level3AgentApiError");

export type Level3AgentResponse = z.infer<typeof Level3AgentSchema>;
export type Level3SessionResponse = z.infer<typeof Level3SessionSchema>;
export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;
export type ClinicalContext = z.infer<typeof ClinicalContextSchema>;
export type Resolution = z.infer<typeof ResolutionSchema>;
export type ObservabilityEvent = z.infer<typeof ObservabilityEventSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type Level3AgentSettingsInput = z.infer<typeof Level3AgentSettingsSchema>;
