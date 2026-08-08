import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import {
  createConversationCredentials,
  ensureConciergeAgent,
  extractMetricsFromRemote,
  fetchConversationDetails,
} from "./elevenlabs.js";
import { conciergeSessions, type ConciergeSession } from "./schema.js";
import {
  ClinicalContextSchema,
  ConciergeSessionIdParamSchema,
  ConciergeSessionSchema,
  EnsureConciergeAgentResponseSchema,
  EnsureConciergeAgentSchema,
  ErrorSchema,
  StartConciergeSessionResponseSchema,
  StartConciergeSessionSchema,
  UpdateConciergeSessionSchema,
  type ClinicalContext,
  type ConciergeSessionResponse,
  type Metrics,
  type ObservabilityEvent,
  type Resolution,
  type TranscriptEntry,
} from "./schemas.js";

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toSessionResponse(row: ConciergeSession): ConciergeSessionResponse {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    elevenLabsAgentId: row.elevenLabsAgentId,
    elevenLabsConversationId: row.elevenLabsConversationId,
    communicationStyle: row.communicationStyle,
    explanationLevel: row.explanationLevel,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    durationMs: row.durationMs ?? null,
    transcript: parseJson<TranscriptEntry[]>(row.transcript, []),
    clinicalContext: parseJson<ClinicalContext>(row.clinicalContext, {}),
    resolution: row.resolution ? parseJson<Resolution | null>(row.resolution, null) : null,
    events: parseJson<ObservabilityEvent[]>(row.events, []),
    metrics: parseJson<Metrics>(row.metrics, {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function latencySamplesFromEvents(events: ObservabilityEvent[]): number[] {
  return events
    .filter((event) => event.type === "ping")
    .map((event) => {
      const value = event.data?.pingMs;
      return typeof value === "number" ? value : null;
    })
    .filter((value): value is number => value != null);
}

function avgVadFromEvents(events: ObservabilityEvent[]): number | null {
  const scores = events
    .filter((event) => event.type === "vad")
    .map((event) => {
      const value = event.data?.vadScore;
      return typeof value === "number" ? value : null;
    })
    .filter((value): value is number => value != null);
  if (scores.length === 0) return null;
  return Number(
    (scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(3),
  );
}

const ensureAgentRoute = createRoute({
  method: "post",
  path: "/concierge-doctor/ensure-agent",
  tags: ["Concierge Doctor"],
  summary: "Ensure the ElevenLabs concierge doctor agent exists",
  operationId: "ensureConciergeDoctorAgent",
  request: {
    body: {
      content: {
        "application/json": {
          schema: EnsureConciergeAgentSchema,
        },
      },
      required: false,
    },
  },
  responses: {
    200: {
      description: "Agent ready",
      content: {
        "application/json": {
          schema: EnsureConciergeAgentResponseSchema,
        },
      },
    },
    500: {
      description: "Failed to ensure agent",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const listSessionsRoute = createRoute({
  method: "get",
  path: "/concierge-doctor/sessions",
  tags: ["Concierge Doctor"],
  summary: "List concierge doctor sessions",
  operationId: "listConciergeDoctorSessions",
  responses: {
    200: {
      description: "All concierge sessions",
      content: {
        "application/json": {
          schema: z.array(ConciergeSessionSchema),
        },
      },
    },
  },
});

const getSessionRoute = createRoute({
  method: "get",
  path: "/concierge-doctor/sessions/{id}",
  tags: ["Concierge Doctor"],
  summary: "Get a concierge doctor session",
  operationId: "getConciergeDoctorSession",
  request: {
    params: ConciergeSessionIdParamSchema,
  },
  responses: {
    200: {
      description: "Session found",
      content: {
        "application/json": {
          schema: ConciergeSessionSchema,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const startSessionRoute = createRoute({
  method: "post",
  path: "/concierge-doctor/sessions/start",
  tags: ["Concierge Doctor"],
  summary: "Start a concierge doctor conversation",
  operationId: "startConciergeDoctorSession",
  request: {
    body: {
      content: {
        "application/json": {
          schema: StartConciergeSessionSchema,
        },
      },
      required: false,
    },
  },
  responses: {
    201: {
      description: "Session started with connection credentials",
      content: {
        "application/json": {
          schema: StartConciergeSessionResponseSchema,
        },
      },
    },
    500: {
      description: "Failed to start session",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const updateSessionRoute = createRoute({
  method: "patch",
  path: "/concierge-doctor/sessions/{id}",
  tags: ["Concierge Doctor"],
  summary: "Update a concierge doctor session",
  operationId: "updateConciergeDoctorSession",
  request: {
    params: ConciergeSessionIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateConciergeSessionSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Session updated",
      content: {
        "application/json": {
          schema: ConciergeSessionSchema,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    500: {
      description: "Update failed",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const deleteSessionRoute = createRoute({
  method: "delete",
  path: "/concierge-doctor/sessions/{id}",
  tags: ["Concierge Doctor"],
  summary: "Delete a concierge doctor session",
  operationId: "deleteConciergeDoctorSession",
  request: {
    params: ConciergeSessionIdParamSchema,
  },
  responses: {
    204: {
      description: "Deleted",
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const mockPharmacyRoute = createRoute({
  method: "post",
  path: "/concierge-doctor/mocks/pharmacy",
  tags: ["Concierge Doctor"],
  summary: "Mock retail pharmacy portal action",
  operationId: "mockConciergePharmacyRequest",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            pharmacy: z.enum(["walgreens", "cvs", "other"]),
            requestType: z.enum([
              "refill_status",
              "pickup_ready_check",
              "transfer_request",
              "general_question",
            ]),
            medicationName: z.string().optional(),
            details: z.string().optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Mock pharmacy response",
      content: {
        "application/json": {
          schema: z.object({
            confirmationId: z.string(),
            status: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
});

const mockScheduleRoute = createRoute({
  method: "post",
  path: "/concierge-doctor/mocks/schedule",
  tags: ["Concierge Doctor"],
  summary: "Mock provider follow-up scheduling",
  operationId: "mockConciergeScheduleFollowUp",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            reason: z.string(),
            urgency: z.enum(["routine", "soon", "urgent"]),
            preferredWindow: z.string().optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Mock schedule response",
      content: {
        "application/json": {
          schema: z.object({
            confirmationId: z.string(),
            slot: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
});

export const conciergeDoctorApp = new OpenAPIHono();

conciergeDoctorApp.openapi(ensureAgentRoute, async (c) => {
  const body = c.req.valid("json") ?? {};
  try {
    const result = await ensureConciergeAgent({ forceSync: body.forceSync });
    return c.json(result, 200);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to ensure concierge agent";
    return c.json({ error: message }, 500);
  }
});

conciergeDoctorApp.openapi(listSessionsRoute, async (c) => {
  const rows = await db
    .select()
    .from(conciergeSessions)
    .orderBy(desc(conciergeSessions.startedAt));
  return c.json(rows.map(toSessionResponse), 200);
});

conciergeDoctorApp.openapi(getSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db
    .select()
    .from(conciergeSessions)
    .where(eq(conciergeSessions.id, Number(id)))
    .limit(1);

  if (!row) {
    return c.json({ error: "Concierge session not found" }, 404);
  }

  return c.json(toSessionResponse(row), 200);
});

conciergeDoctorApp.openapi(startSessionRoute, async (c) => {
  const body = c.req.valid("json") ?? {};
  const communicationStyle = body.communicationStyle ?? "balanced";
  const explanationLevel = body.explanationLevel ?? 50;

  try {
    const { agentId } = await ensureConciergeAgent({
      // Keep remote agent config aligned with local defaults (TTS model, monitoring, etc.).
      forceSync: body.forceSyncAgent ?? true,
    });
    const credentials = await createConversationCredentials({ agentId });

    const [row] = await db
      .insert(conciergeSessions)
      .values({
        title: body.title ?? "",
        status: "active",
        elevenLabsAgentId: agentId,
        elevenLabsConversationId: credentials.conversationId,
        communicationStyle,
        explanationLevel,
        startedAt: new Date(),
        transcript: "[]",
        clinicalContext: "{}",
        events: JSON.stringify([
          {
            at: new Date().toISOString(),
            type: "status",
            message: "Session created",
            data: {
              communicationStyle,
              explanationLevel,
              conversationId: credentials.conversationId,
            },
          },
        ]),
        metrics: "{}",
      })
      .returning();

    return c.json(
      {
        session: toSessionResponse(row),
        conversationToken: credentials.conversationToken,
        conversationId: credentials.conversationId,
        dynamicVariables: {
          communication_style: communicationStyle,
          explanation_level: String(explanationLevel),
        },
      },
      201,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start concierge session";
    return c.json({ error: message }, 500);
  }
});

conciergeDoctorApp.openapi(updateSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const [existing] = await db
    .select()
    .from(conciergeSessions)
    .where(eq(conciergeSessions.id, Number(id)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Concierge session not found" }, 404);
  }

  try {
    const currentEvents = parseJson<ObservabilityEvent[]>(existing.events, []);
    const nextEvents: ObservabilityEvent[] = body.appendEvents
      ? [...currentEvents, ...body.appendEvents]
      : body.events
        ? body.events
        : currentEvents;

    const conversationId =
      body.elevenLabsConversationId ?? existing.elevenLabsConversationId;

    let nextMetrics = body.metrics
      ? { ...parseJson<Metrics>(existing.metrics, {}), ...body.metrics }
      : parseJson<Metrics>(existing.metrics, {});

    let nextTranscript = body.transcript;

    if (body.syncRemoteMetrics && conversationId) {
      const remote = await fetchConversationDetails(conversationId);
      nextMetrics = {
        ...nextMetrics,
        ...extractMetricsFromRemote(remote, {
          latencySamplesMs: latencySamplesFromEvents(nextEvents),
          turnCount: nextEvents.filter((event) => event.type === "transcript").length,
          toolCallCount: nextEvents.filter((event) => event.type === "tool_request").length,
          watchEventCount: nextEvents.filter((event) => event.type === "watch").length,
          interruptionCount: nextEvents.filter((event) => event.type === "interruption")
            .length,
          avgVadScore: avgVadFromEvents(nextEvents),
        }),
      };

      if (remote?.transcript?.length && !nextTranscript) {
        nextTranscript = remote.transcript
          .filter((entry) => entry.message)
          .map((entry) => ({
            role: entry.role === "user" ? ("user" as const) : ("agent" as const),
            text: entry.message ?? "",
            at: new Date(
              (existing.startedAt.getTime() || Date.now()) +
                (entry.timeInCallSecs ?? 0) * 1000,
            ).toISOString(),
          }));
      }
    }

    const nextClinical = body.clinicalContext
      ? {
          ...parseJson<ClinicalContext>(existing.clinicalContext, {}),
          ...body.clinicalContext,
        }
      : parseJson<ClinicalContext>(existing.clinicalContext, {});

    const [row] = await db
      .update(conciergeSessions)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.endedAt !== undefined ? { endedAt: new Date(body.endedAt) } : {}),
        ...(body.durationMs !== undefined ? { durationMs: body.durationMs } : {}),
        ...(nextTranscript !== undefined
          ? { transcript: JSON.stringify(nextTranscript) }
          : {}),
        clinicalContext: JSON.stringify(nextClinical),
        ...(body.resolution !== undefined
          ? {
              resolution:
                body.resolution === null ? null : JSON.stringify(body.resolution),
            }
          : {}),
        events: JSON.stringify(nextEvents),
        metrics: JSON.stringify(nextMetrics),
        ...(conversationId
          ? { elevenLabsConversationId: conversationId }
          : {}),
      })
      .where(eq(conciergeSessions.id, Number(id)))
      .returning();

    if (!row) {
      return c.json({ error: "Concierge session not found" }, 404);
    }

    return c.json(toSessionResponse(row), 200);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update concierge session";
    return c.json({ error: message }, 500);
  }
});

conciergeDoctorApp.openapi(deleteSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const deleted = await db
    .delete(conciergeSessions)
    .where(eq(conciergeSessions.id, Number(id)))
    .returning({ id: conciergeSessions.id });

  if (deleted.length === 0) {
    return c.json({ error: "Concierge session not found" }, 404);
  }

  return c.body(null, 204);
});

conciergeDoctorApp.openapi(mockPharmacyRoute, async (c) => {
  const body = c.req.valid("json");
  const confirmationId = `MOCK-RX-${Date.now().toString(36).toUpperCase()}`;
  return c.json(
    {
      confirmationId,
      status: "submitted",
      message: `Mock ${body.pharmacy} ${body.requestType} accepted${
        body.medicationName ? ` for ${body.medicationName}` : ""
      }. No real pharmacy transaction was performed.`,
    },
    200,
  );
});

conciergeDoctorApp.openapi(mockScheduleRoute, async (c) => {
  const body = c.req.valid("json");
  const confirmationId = `MOCK-APPT-${Date.now().toString(36).toUpperCase()}`;
  const slot =
    body.preferredWindow?.trim() ||
    (body.urgency === "urgent"
      ? "Today within 2 hours (mock)"
      : body.urgency === "soon"
        ? "Tomorrow morning (mock)"
        : "Within 3 business days (mock)");

  return c.json(
    {
      confirmationId,
      slot,
      message: `Mock provider portal booked a ${body.urgency} follow-up for: ${body.reason}`,
    },
    200,
  );
});

// Keep ClinicalContextSchema referenced for OpenAPI component registration via route bodies.
void ClinicalContextSchema;
