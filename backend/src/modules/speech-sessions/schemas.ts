import { z } from "@hono/zod-openapi";

export const TranscriptEntrySchema = z
  .object({
    role: z.enum(["user", "assistant"]).openapi({ example: "user" }),
    text: z.string().openapi({ example: "Hello, can you help me?" }),
    at: z.string().datetime().openapi({ example: "2026-08-08T17:00:00.000Z" }),
  })
  .openapi("SpeechTranscriptEntry");

export const SpeechSessionSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    title: z.string().openapi({ example: "Support call" }),
    status: z.enum(["active", "ended"]).openapi({ example: "ended" }),
    model: z.string().openapi({ example: "gpt-realtime-2.1" }),
    voice: z.string().openapi({ example: "marin" }),
    startedAt: z.string().datetime().openapi({ example: "2026-08-08T17:00:00.000Z" }),
    endedAt: z
      .string()
      .datetime()
      .nullable()
      .openapi({ example: "2026-08-08T17:05:00.000Z" }),
    durationMs: z.number().int().nullable().openapi({ example: 300000 }),
    transcript: z.array(TranscriptEntrySchema),
    createdAt: z.string().datetime().openapi({ example: "2026-08-08T17:00:00.000Z" }),
    updatedAt: z.string().datetime().openapi({ example: "2026-08-08T17:05:00.000Z" }),
  })
  .openapi("SpeechSession");

export const CreateSpeechSessionSchema = z
  .object({
    title: z
      .string()
      .optional()
      .default("")
      .openapi({ example: "Support call" }),
    model: z
      .string()
      .optional()
      .default("gpt-realtime-2.1")
      .openapi({ example: "gpt-realtime-2.1" }),
    voice: z.string().optional().default("marin").openapi({ example: "marin" }),
  })
  .openapi("CreateSpeechSession");

export const UpdateSpeechSessionSchema = z
  .object({
    title: z.string().optional().openapi({ example: "Support call" }),
    status: z.enum(["active", "ended"]).optional().openapi({ example: "ended" }),
    endedAt: z
      .string()
      .datetime()
      .optional()
      .openapi({ example: "2026-08-08T17:05:00.000Z" }),
    durationMs: z.number().int().nonnegative().optional().openapi({ example: 300000 }),
    transcript: z.array(TranscriptEntrySchema).optional(),
  })
  .openapi("UpdateSpeechSession");

export const SpeechSessionIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/)
    .openapi({
      param: { name: "id", in: "path" },
      example: "1",
    }),
});

export const SpeechClientSecretSchema = z
  .object({
    value: z.string().openapi({ example: "ek_..." }),
    expiresAt: z.number().int().optional().openapi({ example: 1754670000 }),
    model: z.string().openapi({ example: "gpt-realtime-2.1" }),
    voice: z.string().openapi({ example: "marin" }),
  })
  .openapi("SpeechClientSecret");

export const CreateSpeechClientSecretSchema = z
  .object({
    model: z
      .string()
      .optional()
      .default("gpt-realtime-2.1")
      .openapi({ example: "gpt-realtime-2.1" }),
    voice: z.string().optional().default("marin").openapi({ example: "marin" }),
  })
  .openapi("CreateSpeechClientSecret");

export const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Speech session not found" }),
  })
  .openapi("SpeechSessionApiError");

export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;
export type SpeechSessionResponse = z.infer<typeof SpeechSessionSchema>;
