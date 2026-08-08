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

const StringListSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(50)
  .default([]);

export const Level4AgentSettingsSchema = z
  .object({
    variantLabel: VariantLabelSchema.default("alpha"),
    communicationStyle: CommunicationStyleSchema.default("direct"),
    explanationLevel: ExplanationLevelSchema.default("minimal"),
    safetyPosture: SafetyPostureSchema.default("balanced"),
    resolutionBias: ResolutionBiasSchema.default("fewest_steps"),
    turnEagerness: TurnEagernessSchema.default("normal"),
    voicePreset: VoicePresetSchema.default("sarah"),
    ttsModel: TtsModelSchema.default("eleven_flash_v2"),
    llm: LlmOptionSchema.default("qwen36-35b-a3b"),
    interruptionMode: InterruptionModeSchema.default("protect_tools"),
    personaPreset: PersonaPresetSchema.default("sam"),
    promptProfile: PromptProfileSchema.default("warm_empathetic"),
    enabledTools: z
      .array(ToolOptionSchema)
      .min(1)
      .default([...TOOL_OPTIONS]),
    displayName: z.string().max(120).optional().default(""),
    systemPrompt: z.string().max(20000).optional().default(""),
    firstMessage: z.string().max(1000).optional().default(""),
    asrKeywords: StringListSchema,
    interruptionIgnoreTerms: StringListSchema,
    extraGuardrailPrompt: z.string().max(2000).optional().default(""),
  })
  .openapi("Level4AgentSettings");

export const CreateLevel4AgentSchema = Level4AgentSettingsSchema.openapi(
  "CreateLevel4Agent",
);

export const UpdateLevel4AgentSchema = Level4AgentSettingsSchema.partial().openapi(
  "UpdateLevel4Agent",
);

export const Level4AgentSchema = z
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
    systemPrompt: z.string(),
    firstMessage: z.string(),
    asrKeywords: z.array(z.string()),
    interruptionIgnoreTerms: z.array(z.string()),
    extraGuardrailPrompt: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Level4Agent");

export const ComposeLevel4DefaultsResponseSchema = z
  .object({
    displayName: z.string(),
    systemPrompt: z.string(),
    firstMessage: z.string(),
    asrKeywords: z.array(z.string()),
    interruptionIgnoreTerms: z.array(z.string()),
  })
  .openapi("ComposeLevel4DefaultsResponse");

export const ErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi("Level4Error");

export const IdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/)
    .openapi({ param: { name: "id", in: "path" }, example: "1" }),
});

export const TranscriptEntrySchema = z
  .object({
    role: z.enum(["user", "agent"]),
    text: z.string(),
    at: z.string().datetime(),
  })
  .openapi("Level4TranscriptEntry");

export const ClinicalContextSchema = z
  .object({
    symptom: z.string().optional(),
    duration: z.string().optional(),
    history: z.string().optional(),
    currentMedications: z.string().optional(),
    unknowns: z.string().optional(),
    notes: z.string().optional(),
  })
  .openapi("Level4ClinicalContext");

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
  .openapi("Level4Resolution");

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
  .openapi("Level4ObservabilityEvent");

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
  .openapi("Level4Metrics");

export const Level4SessionSchema = z
  .object({
    id: z.number().int(),
    agentId: z.number().int(),
    agentDisplayName: z.string(),
    title: z.string(),
    status: z.enum(["active", "ended"]),
    memoryBank: z.string(),
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
  .openapi("Level4Session");

export const StartLevel4SessionSchema = z
  .object({
    title: z.string().max(200).optional().default(""),
    memoryBank: z.string().max(20000).optional().default(""),
    forceSyncAgent: z.boolean().optional().default(true),
  })
  .openapi("StartLevel4Session");

export const StartLevel4SessionResponseSchema = z
  .object({
    session: Level4SessionSchema,
    conversationToken: z.string(),
    conversationId: z.string(),
    dynamicVariables: z.object({
      memory_bank_summary: z.string(),
      communication_style: z.string(),
      explanation_level: z.string(),
      safety_posture: z.string(),
      resolution_bias: z.string(),
    }),
    memoryBank: z.string(),
    enabledTools: z.array(ToolOptionSchema),
  })
  .openapi("StartLevel4SessionResponse");

export const UpdateLevel4SessionSchema = z
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
  .openapi("UpdateLevel4Session");

export const WebSearchRequestSchema = z
  .object({
    query: z.string().min(1).max(500),
  })
  .openapi("Level4WebSearchRequest");

export const WebSearchResponseSchema = z
  .object({
    query: z.string(),
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      }),
    ),
  })
  .openapi("Level4WebSearchResponse");

export type ClinicalContext = z.infer<typeof ClinicalContextSchema>;
export type Resolution = z.infer<typeof ResolutionSchema>;
export type ObservabilityEvent = z.infer<typeof ObservabilityEventSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;
export type Level4AgentResponse = z.infer<typeof Level4AgentSchema>;
export type Level4SessionResponse = z.infer<typeof Level4SessionSchema>;
