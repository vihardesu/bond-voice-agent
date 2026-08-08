import { z } from "@hono/zod-openapi";

export const CommunicationStyleSchema = z
  .enum(["patient", "balanced", "direct"])
  .openapi({ example: "balanced" });

export const TranscriptEntrySchema = z
  .object({
    role: z.enum(["user", "agent"]).openapi({ example: "user" }),
    text: z.string().openapi({ example: "My throat has been sore for three days." }),
    at: z.string().datetime().openapi({ example: "2026-08-08T17:00:00.000Z" }),
  })
  .openapi("ConciergeTranscriptEntry");

export const ClinicalContextSchema = z
  .object({
    symptom: z.string().optional().openapi({ example: "sore throat" }),
    duration: z.string().optional().openapi({ example: "3 days" }),
    history: z.string().optional().openapi({ example: "seasonal allergies" }),
    currentMedications: z.string().optional().openapi({ example: "loratadine" }),
    unknowns: z.string().optional().openapi({ example: "fever status unknown" }),
    notes: z.string().optional().openapi({ example: "Caller sounds anxious" }),
  })
  .openapi("ConciergeClinicalContext");

export const ResolutionSchema = z
  .object({
    type: z
      .enum([
        "self_care_watch",
        "scheduled_follow_up",
        "pharmacy_request",
        "human_handoff",
        "emergency_care",
        "other",
      ])
      .openapi({ example: "scheduled_follow_up" }),
    summary: z.string().openapi({ example: "Nurse callback tomorrow morning" }),
    confirmationId: z.string().optional().openapi({ example: "MOCK-APPT-1234" }),
    reassurance: z.string().optional(),
    handoffReason: z.string().optional(),
    pharmacy: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi("ConciergeResolution");

export const ObservabilityEventSchema = z
  .object({
    at: z.string().datetime().openapi({ example: "2026-08-08T17:00:01.000Z" }),
    type: z
      .enum([
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
      ])
      .openapi({ example: "ping" }),
    message: z.string().openapi({ example: "Latency sample" }),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi("ConciergeObservabilityEvent");

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
  })
  .passthrough()
  .openapi("ConciergeMetrics");

export const ConciergeSessionSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    title: z.string().openapi({ example: "Sore throat follow-up" }),
    status: z.enum(["active", "ended"]).openapi({ example: "ended" }),
    elevenLabsAgentId: z.string().openapi({ example: "agent_..." }),
    elevenLabsConversationId: z.string().nullable().openapi({ example: "conv_..." }),
    communicationStyle: CommunicationStyleSchema,
    explanationLevel: z.number().int().min(0).max(100).openapi({ example: 55 }),
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
  .openapi("ConciergeSession");

export const StartConciergeSessionSchema = z
  .object({
    communicationStyle: CommunicationStyleSchema.optional().default("balanced"),
    explanationLevel: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .default(50)
      .openapi({ example: 50 }),
    title: z.string().optional().default(""),
    forceSyncAgent: z.boolean().optional().default(false),
  })
  .openapi("StartConciergeSession");

export const StartConciergeSessionResponseSchema = z
  .object({
    session: ConciergeSessionSchema,
    conversationToken: z.string(),
    conversationId: z.string(),
    dynamicVariables: z.object({
      communication_style: z.string(),
      explanation_level: z.string(),
    }),
  })
  .openapi("StartConciergeSessionResponse");

export const UpdateConciergeSessionSchema = z
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
  .openapi("UpdateConciergeSession");

export const ConciergeSessionIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/)
    .openapi({
      param: { name: "id", in: "path" },
      example: "1",
    }),
});

export const EnsureConciergeAgentSchema = z
  .object({
    forceSync: z.boolean().optional().default(false),
  })
  .openapi("EnsureConciergeAgent");

export const EnsureConciergeAgentResponseSchema = z
  .object({
    agentId: z.string(),
    created: z.boolean(),
  })
  .openapi("EnsureConciergeAgentResponse");

export const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Concierge session not found" }),
  })
  .openapi("ConciergeDoctorApiError");

export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;
export type ClinicalContext = z.infer<typeof ClinicalContextSchema>;
export type Resolution = z.infer<typeof ResolutionSchema>;
export type ObservabilityEvent = z.infer<typeof ObservabilityEventSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type ConciergeSessionResponse = z.infer<typeof ConciergeSessionSchema>;
