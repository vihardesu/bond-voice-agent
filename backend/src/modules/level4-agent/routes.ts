import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import {
  DAPHNE_V2_DISPLAY_NAME,
  DAPHNE_V2_FIRST_MESSAGE,
  DAPHNE_V2_SETTINGS,
} from "./daphne-v2.js";
import {
  createConversationCredentials,
  createRemoteLevel4Agent,
  extractMetricsFromRemote,
  fetchConversationDetails,
  formatElevenLabsError,
  sessionDynamicVariables,
  syncRemoteLevel4Agent,
} from "./elevenlabs.js";
import { level4Agents, level4Sessions, type Level4Agent, type Level4Session } from "./schema.js";
import {
  ClinicalContextSchema,
  ErrorSchema,
  IdParamSchema,
  Level4AgentSchema,
  Level4SessionSchema,
  StartLevel4SessionResponseSchema,
  StartLevel4SessionSchema,
  UpdateLevel4SessionSchema,
  WebSearchRequestSchema,
  WebSearchResponseSchema,
  type ClinicalContext,
  type Level4AgentResponse,
  type Level4SessionResponse,
  type Metrics,
  type ObservabilityEvent,
  type Resolution,
  type TranscriptEntry,
} from "./schemas.js";
import { searchWebWithExa } from "./web-search.js";

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toAgentResponse(row: Level4Agent): Level4AgentResponse {
  return {
    id: row.id,
    key: row.key,
    displayName: row.displayName,
    elevenLabsAgentId: row.elevenLabsAgentId,
    llm: DAPHNE_V2_SETTINGS.llm,
    voicePreset: DAPHNE_V2_SETTINGS.voicePreset,
    ttsModel: DAPHNE_V2_SETTINGS.ttsModel,
    firstMessage: DAPHNE_V2_FIRST_MESSAGE,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSessionResponse(
  row: Level4Session,
  agentDisplayName: string,
): Level4SessionResponse {
  return {
    id: row.id,
    agentId: row.agentId,
    agentDisplayName,
    title: row.title,
    status: row.status,
    memoryBank: row.memoryBank,
    elevenLabsAgentId: row.elevenLabsAgentId,
    elevenLabsConversationId: row.elevenLabsConversationId,
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

async function ensureLevel4Agent(forceSync: boolean): Promise<Level4Agent> {
  const [existing] = await db
    .select()
    .from(level4Agents)
    .where(eq(level4Agents.key, "daphne_v2"))
    .limit(1);

  if (existing) {
    if (forceSync) {
      await syncRemoteLevel4Agent(existing.elevenLabsAgentId);
    }
    return existing;
  }

  const elevenLabsAgentId = await createRemoteLevel4Agent();
  const [created] = await db
    .insert(level4Agents)
    .values({
      key: "daphne_v2",
      displayName: DAPHNE_V2_DISPLAY_NAME,
      elevenLabsAgentId,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to persist Level 4 agent");
  }
  return created;
}

const getAgentRoute = createRoute({
  method: "get",
  path: "/level4-agents/agent",
  tags: ["Level 4 Agent"],
  summary: "Get the frozen Daphne v2 Level 4 agent (creates/syncs if needed)",
  operationId: "getLevel4Agent",
  request: {
    query: z.object({
      forceSync: z
        .enum(["true", "false"])
        .optional()
        .default("false")
        .openapi({ description: "Force sync remote ElevenLabs agent config" }),
    }),
  },
  responses: {
    200: {
      description: "Level 4 agent",
      content: { "application/json": { schema: Level4AgentSchema } },
    },
    500: {
      description: "Failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const listSessionsRoute = createRoute({
  method: "get",
  path: "/level4-agents/sessions",
  tags: ["Level 4 Agent"],
  summary: "List Level 4 sessions",
  operationId: "listLevel4Sessions",
  responses: {
    200: {
      description: "Sessions",
      content: {
        "application/json": { schema: z.array(Level4SessionSchema) },
      },
    },
  },
});

const getSessionRoute = createRoute({
  method: "get",
  path: "/level4-agents/sessions/{id}",
  tags: ["Level 4 Agent"],
  summary: "Get a Level 4 session",
  operationId: "getLevel4Session",
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Session",
      content: { "application/json": { schema: Level4SessionSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const startSessionRoute = createRoute({
  method: "post",
  path: "/level4-agents/sessions/start",
  tags: ["Level 4 Agent"],
  summary: "Start a Level 4 conversation with an optional memory bank",
  operationId: "startLevel4Session",
  request: {
    body: {
      content: { "application/json": { schema: StartLevel4SessionSchema } },
      required: false,
    },
  },
  responses: {
    201: {
      description: "Session started",
      content: {
        "application/json": { schema: StartLevel4SessionResponseSchema },
      },
    },
    500: {
      description: "Start failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const updateSessionRoute = createRoute({
  method: "patch",
  path: "/level4-agents/sessions/{id}",
  tags: ["Level 4 Agent"],
  summary: "Update a Level 4 session",
  operationId: "updateLevel4Session",
  request: {
    params: IdParamSchema,
    body: {
      content: { "application/json": { schema: UpdateLevel4SessionSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Session updated",
      content: { "application/json": { schema: Level4SessionSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Update failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const deleteSessionRoute = createRoute({
  method: "delete",
  path: "/level4-agents/sessions/{id}",
  tags: ["Level 4 Agent"],
  summary: "Delete a Level 4 session",
  operationId: "deleteLevel4Session",
  request: { params: IdParamSchema },
  responses: {
    204: { description: "Deleted" },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const webSearchRoute = createRoute({
  method: "post",
  path: "/level4-agents/tools/web-search",
  tags: ["Level 4 Agent"],
  summary: "Exa web search (debug / fallback)",
  operationId: "level4WebSearch",
  request: {
    body: {
      content: { "application/json": { schema: WebSearchRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Search results",
      content: { "application/json": { schema: WebSearchResponseSchema } },
    },
    500: {
      description: "Search failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const mockPharmacyRoute = createRoute({
  method: "post",
  path: "/level4-agents/mocks/pharmacy",
  tags: ["Level 4 Agent"],
  summary: "Mock retail pharmacy portal action",
  operationId: "mockLevel4PharmacyRequest",
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
  path: "/level4-agents/mocks/schedule",
  tags: ["Level 4 Agent"],
  summary: "Mock schedule follow-up",
  operationId: "mockLevel4ScheduleFollowUp",
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

export const level4AgentApp = new OpenAPIHono();

level4AgentApp.openapi(listSessionsRoute, async (c) => {
  const rows = await db
    .select({
      session: level4Sessions,
      agentDisplayName: level4Agents.displayName,
    })
    .from(level4Sessions)
    .leftJoin(level4Agents, eq(level4Sessions.agentId, level4Agents.id))
    .orderBy(desc(level4Sessions.startedAt));

  return c.json(
    rows.map(({ session, agentDisplayName }) =>
      toSessionResponse(session, agentDisplayName ?? DAPHNE_V2_DISPLAY_NAME),
    ),
    200,
  );
});

level4AgentApp.openapi(getSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db
    .select()
    .from(level4Sessions)
    .where(eq(level4Sessions.id, Number(id)))
    .limit(1);

  if (!row) {
    return c.json({ error: "Level 4 session not found" }, 404);
  }

  const [agent] = await db
    .select()
    .from(level4Agents)
    .where(eq(level4Agents.id, row.agentId))
    .limit(1);

  return c.json(
    toSessionResponse(row, agent?.displayName ?? DAPHNE_V2_DISPLAY_NAME),
    200,
  );
});

level4AgentApp.openapi(updateSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const [existing] = await db
    .select()
    .from(level4Sessions)
    .where(eq(level4Sessions.id, Number(id)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Level 4 session not found" }, 404);
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
          toolCallCount: nextEvents.filter((event) => event.type === "tool_request")
            .length,
          watchEventCount: nextEvents.filter((event) => event.type === "watch").length,
          interruptionCount: nextEvents.filter(
            (event) => event.type === "interruption",
          ).length,
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
      .update(level4Sessions)
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
        ...(conversationId ? { elevenLabsConversationId: conversationId } : {}),
      })
      .where(eq(level4Sessions.id, Number(id)))
      .returning();

    if (!row) {
      return c.json({ error: "Level 4 session not found" }, 404);
    }

    const [agent] = await db
      .select()
      .from(level4Agents)
      .where(eq(level4Agents.id, row.agentId))
      .limit(1);

    return c.json(
      toSessionResponse(row, agent?.displayName ?? DAPHNE_V2_DISPLAY_NAME),
      200,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update Level 4 session";
    return c.json({ error: message }, 500);
  }
});

level4AgentApp.openapi(deleteSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const deleted = await db
    .delete(level4Sessions)
    .where(eq(level4Sessions.id, Number(id)))
    .returning({ id: level4Sessions.id });

  if (deleted.length === 0) {
    return c.json({ error: "Level 4 session not found" }, 404);
  }

  return c.body(null, 204);
});

level4AgentApp.openapi(webSearchRoute, async (c) => {
  const body = c.req.valid("json");
  try {
    const result = await searchWebWithExa(body.query);
    return c.json(result, 200);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Web search failed";
    return c.json({ error: message }, 500);
  }
});

level4AgentApp.openapi(mockPharmacyRoute, async (c) => {
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

level4AgentApp.openapi(mockScheduleRoute, async (c) => {
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

level4AgentApp.openapi(getAgentRoute, async (c) => {
  const { forceSync } = c.req.valid("query");
  try {
    const agent = await ensureLevel4Agent(forceSync === "true");
    return c.json(toAgentResponse(agent), 200);
  } catch (error) {
    const message = formatElevenLabsError(error);
    console.error("[level4-agent] Get/ensure agent failed", { error: message });
    return c.json({ error: message }, 500);
  }
});

level4AgentApp.openapi(startSessionRoute, async (c) => {
  const body = c.req.valid("json") ?? {};
  const memoryBank = (body.memoryBank ?? "").trim();

  try {
    const agent = await ensureLevel4Agent(body.forceSyncAgent ?? true);
    const credentials = await createConversationCredentials({
      agentId: agent.elevenLabsAgentId,
    });

    const [row] = await db
      .insert(level4Sessions)
      .values({
        agentId: agent.id,
        title: body.title ?? "",
        status: "active",
        memoryBank,
        elevenLabsAgentId: agent.elevenLabsAgentId,
        elevenLabsConversationId: credentials.conversationId,
        startedAt: new Date(),
        transcript: "[]",
        clinicalContext: "{}",
        events: JSON.stringify([
          {
            at: new Date().toISOString(),
            type: "status",
            message: "Session created",
            data: {
              agentId: agent.id,
              displayName: agent.displayName,
              conversationId: credentials.conversationId,
              memoryBankChars: memoryBank.length,
            },
          },
        ]),
        metrics: JSON.stringify({
          ttsModel: DAPHNE_V2_SETTINGS.ttsModel,
          llm: DAPHNE_V2_SETTINGS.llm,
          voicePreset: DAPHNE_V2_SETTINGS.voicePreset,
          asrProvider: "scribe_realtime",
          turnModel: "turn_v3",
        }),
      })
      .returning();

    return c.json(
      {
        session: toSessionResponse(row, agent.displayName),
        conversationToken: credentials.conversationToken,
        conversationId: credentials.conversationId,
        dynamicVariables: sessionDynamicVariables(memoryBank),
        memoryBank,
      },
      201,
    );
  } catch (error) {
    const message = formatElevenLabsError(error);
    console.error("[level4-agent] Start session failed", { error: message });
    return c.json({ error: message }, 500);
  }
});
