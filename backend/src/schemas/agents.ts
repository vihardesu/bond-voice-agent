import { z } from "@hono/zod-openapi";

export const AgentSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().min(1).openapi({ example: "Support Agent" }),
    description: z
      .string()
      .openapi({ example: "Handles inbound customer support calls." }),
    createdAt: z.string().datetime().openapi({ example: "2026-08-08T17:00:00.000Z" }),
    updatedAt: z.string().datetime().openapi({ example: "2026-08-08T17:00:00.000Z" }),
  })
  .openapi("Agent");

export const CreateAgentSchema = z
  .object({
    name: z.string().min(1).openapi({ example: "Support Agent" }),
    description: z
      .string()
      .optional()
      .default("")
      .openapi({ example: "Handles inbound customer support calls." }),
  })
  .openapi("CreateAgent");

export const UpdateAgentSchema = z
  .object({
    name: z.string().min(1).optional().openapi({ example: "Support Agent" }),
    description: z
      .string()
      .optional()
      .openapi({ example: "Handles inbound customer support calls." }),
  })
  .openapi("UpdateAgent");

export const AgentIdParamSchema = z.object({
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
    error: z.string().openapi({ example: "Agent not found" }),
  })
  .openapi("ApiError");

export type AgentResponse = z.infer<typeof AgentSchema>;
