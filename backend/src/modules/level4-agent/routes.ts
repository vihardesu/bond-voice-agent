import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import {
  createConversationCredentials,
  createRemoteLevel4Agent,
  deleteRemoteLevel4Agent,
  extractMetricsFromRemote,
  fetchConversationDetails,
  formatElevenLabsError,
  sessionDynamicVariables,
  syncRemoteLevel4Agent,
} from "./elevenlabs.js";
import { composeLevel4Defaults, resolveDisplayName } from "./prompt.js";
import {
  DEFAULT_LEVEL4_SETTINGS,
  normalizeEnabledTools,
  normalizeStringList,
  TOOL_OPTIONS,
  type Level4AgentSettings,
  type ToolOption,
} from "./settings.js";
import { level4Agents, level4Sessions, type Level4Agent, type Level4Session } from "./schema.js";
import {
  ClinicalContextSchema,
  ComposeLevel4DefaultsResponseSchema,
  CreateLevel4AgentSchema,
  ErrorSchema,
  IdParamSchema,
  Level4AgentSchema,
  Level4AgentSettingsSchema,
  Level4SessionSchema,
  StartLevel4SessionResponseSchema,
  StartLevel4SessionSchema,
  UpdateLevel4AgentSchema,
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

function settingsFromBody(
  body: Partial<Level4AgentSettings>,
  base: Level4AgentSettings = DEFAULT_LEVEL4_SETTINGS,
): Level4AgentSettings {
  const enabledTools = normalizeEnabledTools(
    (body.enabledTools as ToolOption[] | undefined) ?? base.enabledTools,
  );
  return {
    variantLabel: body.variantLabel ?? base.variantLabel,
    communicationStyle: body.communicationStyle ?? base.communicationStyle,
    explanationLevel: body.explanationLevel ?? base.explanationLevel,
    safetyPosture: body.safetyPosture ?? base.safetyPosture,
    resolutionBias: body.resolutionBias ?? base.resolutionBias,
    turnEagerness: body.turnEagerness ?? base.turnEagerness,
    voicePreset: body.voicePreset ?? base.voicePreset,
    ttsModel: body.ttsModel ?? base.ttsModel,
    llm: body.llm ?? base.llm,
    interruptionMode: body.interruptionMode ?? base.interruptionMode,
    personaPreset: body.personaPreset ?? base.personaPreset,
    promptProfile: body.promptProfile ?? base.promptProfile,
    enabledTools: enabledTools.length > 0 ? enabledTools : [...TOOL_OPTIONS],
    displayName: body.displayName ?? base.displayName,
    systemPrompt: body.systemPrompt ?? base.systemPrompt,
    firstMessage: body.firstMessage ?? base.firstMessage,
    asrKeywords: normalizeStringList(
      body.asrKeywords !== undefined ? body.asrKeywords : base.asrKeywords,
    ),
    interruptionIgnoreTerms: normalizeStringList(
      body.interruptionIgnoreTerms !== undefined
        ? body.interruptionIgnoreTerms
        : base.interruptionIgnoreTerms,
    ),
    extraGuardrailPrompt: body.extraGuardrailPrompt ?? base.extraGuardrailPrompt,
  };
}

function settingsFromRow(row: Level4Agent): Level4AgentSettings {
  return {
    variantLabel: row.variantLabel,
    communicationStyle: row.communicationStyle,
    explanationLevel: row.explanationLevel,
    safetyPosture: row.safetyPosture,
    resolutionBias: row.resolutionBias,
    turnEagerness: row.turnEagerness,
    voicePreset: row.voicePreset,
    ttsModel: row.ttsModel,
    llm: row.llm as Level4AgentSettings["llm"],
    interruptionMode: row.interruptionMode,
    personaPreset: row.personaPreset,
    promptProfile: row.promptProfile,
    enabledTools: normalizeEnabledTools(
      parseJson<ToolOption[]>(row.enabledTools, [...TOOL_OPTIONS]),
    ),
    displayName: row.displayName,
    systemPrompt: row.systemPrompt,
    firstMessage: row.firstMessage,
    asrKeywords: normalizeStringList(parseJson<string[]>(row.asrKeywords, [])),
    interruptionIgnoreTerms: normalizeStringList(
      parseJson<string[]>(row.interruptionIgnoreTerms, []),
    ),
    extraGuardrailPrompt: row.extraGuardrailPrompt,
  };
}

function toAgentResponse(row: Level4Agent): Level4AgentResponse {
  const settings = settingsFromRow(row);
  return {
    id: row.id,
    elevenLabsAgentId: row.elevenLabsAgentId,
    ...settings,
    displayName: row.displayName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function agentRowValues(settings: Level4AgentSettings) {
  return {
    displayName: resolveDisplayName(settings),
    variantLabel: settings.variantLabel,
    communicationStyle: settings.communicationStyle,
    explanationLevel: settings.explanationLevel,
    safetyPosture: settings.safetyPosture,
    resolutionBias: settings.resolutionBias,
    turnEagerness: settings.turnEagerness,
    voicePreset: settings.voicePreset,
    ttsModel: settings.ttsModel,
    llm: settings.llm,
    interruptionMode: settings.interruptionMode,
    personaPreset: settings.personaPreset,
    promptProfile: settings.promptProfile,
    enabledTools: JSON.stringify(settings.enabledTools),
    systemPrompt: settings.systemPrompt.trim(),
    firstMessage: settings.firstMessage.trim(),
    asrKeywords: JSON.stringify(settings.asrKeywords),
    interruptionIgnoreTerms: JSON.stringify(settings.interruptionIgnoreTerms),
    extraGuardrailPrompt: settings.extraGuardrailPrompt.trim(),
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

async function agentDisplayNameById(agentId: number): Promise<string> {
  const [agent] = await db
    .select({ displayName: level4Agents.displayName })
    .from(level4Agents)
    .where(eq(level4Agents.id, agentId))
    .limit(1);
  return agent?.displayName ?? `Agent ${agentId}`;
}

const listAgentsRoute = createRoute({
  method: "get",
  path: "/level4-agents",
  tags: ["Level 4 Agent"],
  summary: "List Level 4 agents",
  operationId: "listLevel4Agents",
  responses: {
    200: {
      description: "All Level 4 agents",
      content: {
        "application/json": {
          schema: z.array(Level4AgentSchema),
        },
      },
    },
  },
});

const getAgentRoute = createRoute({
  method: "get",
  path: "/level4-agents/{id}",
  tags: ["Level 4 Agent"],
  summary: "Get a Level 4 agent",
  operationId: "getLevel4Agent",
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Agent found",
      content: { "application/json": { schema: Level4AgentSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const composeDefaultsRoute = createRoute({
  method: "post",
  path: "/level4-agents/compose-defaults",
  tags: ["Level 4 Agent"],
  summary: "Compose free-text defaults from typed Level 4 dials (includes L4 appendix)",
  operationId: "composeLevel4Defaults",
  request: {
    body: {
      content: { "application/json": { schema: Level4AgentSettingsSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Composed defaults",
      content: {
        "application/json": { schema: ComposeLevel4DefaultsResponseSchema },
      },
    },
  },
});

const createAgentRoute = createRoute({
  method: "post",
  path: "/level4-agents",
  tags: ["Level 4 Agent"],
  summary: "Create a Level 4 agent from typed settings",
  operationId: "createLevel4Agent",
  request: {
    body: {
      content: { "application/json": { schema: CreateLevel4AgentSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Agent created",
      content: { "application/json": { schema: Level4AgentSchema } },
    },
    500: {
      description: "Create failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const updateAgentRoute = createRoute({
  method: "patch",
  path: "/level4-agents/{id}",
  tags: ["Level 4 Agent"],
  summary: "Update a Level 4 agent and sync ElevenLabs",
  operationId: "updateLevel4Agent",
  request: {
    params: IdParamSchema,
    body: {
      content: { "application/json": { schema: UpdateLevel4AgentSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Agent updated",
      content: { "application/json": { schema: Level4AgentSchema } },
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

const deleteAgentRoute = createRoute({
  method: "delete",
  path: "/level4-agents/{id}",
  tags: ["Level 4 Agent"],
  summary: "Delete a Level 4 agent",
  operationId: "deleteLevel4Agent",
  request: { params: IdParamSchema },
  responses: {
    204: { description: "Deleted" },
    404: {
      description: "Not found",
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
      description: "All Level 4 sessions",
      content: {
        "application/json": {
          schema: z.array(Level4SessionSchema),
        },
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
      description: "Session found",
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
  path: "/level4-agents/{id}/sessions/start",
  tags: ["Level 4 Agent"],
  summary: "Start a conversation with a Level 4 agent and optional memory bank",
  operationId: "startLevel4Session",
  request: {
    params: IdParamSchema,
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
    404: {
      description: "Agent not found",
      content: { "application/json": { schema: ErrorSchema } },
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

// Static `/sessions` routes must be registered before `/{id}` or "sessions" is captured.
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
    rows.map((row) =>
      toSessionResponse(
        row.session,
        row.agentDisplayName ?? `Agent ${row.session.agentId}`,
      ),
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

  return c.json(
    toSessionResponse(row, await agentDisplayNameById(row.agentId)),
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
    const agent = (
      await db
        .select()
        .from(level4Agents)
        .where(eq(level4Agents.id, existing.agentId))
        .limit(1)
    )[0];

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
          interruptionCount: nextEvents.filter((event) => event.type === "interruption")
            .length,
          avgVadScore: avgVadFromEvents(nextEvents),
          ttsModel: agent?.ttsModel ?? "eleven_flash_v2",
          llm: agent?.llm ?? "qwen36-35b-a3b",
          voicePreset: agent?.voicePreset ?? "sarah",
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

    return c.json(
      toSessionResponse(row, agent?.displayName ?? (await agentDisplayNameById(row.agentId))),
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

level4AgentApp.openapi(composeDefaultsRoute, async (c) => {
  const body = c.req.valid("json");
  const settings = settingsFromBody(body);
  return c.json(composeLevel4Defaults(settings), 200);
});

level4AgentApp.openapi(listAgentsRoute, async (c) => {
  const rows = await db
    .select()
    .from(level4Agents)
    .orderBy(desc(level4Agents.updatedAt));
  return c.json(rows.map(toAgentResponse), 200);
});

level4AgentApp.openapi(createAgentRoute, async (c) => {
  const body = c.req.valid("json");
  const settings = settingsFromBody(body);

  try {
    const elevenLabsAgentId = await createRemoteLevel4Agent(settings);
    const [row] = await db
      .insert(level4Agents)
      .values({
        elevenLabsAgentId,
        ...agentRowValues(settings),
      })
      .returning();

    return c.json(toAgentResponse(row), 201);
  } catch (error) {
    const message = formatElevenLabsError(error) || "Failed to create Level 4 agent";
    console.error("[level4-agent] Create failed", { error: message });
    return c.json({ error: message }, 500);
  }
});

level4AgentApp.openapi(updateAgentRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const [existing] = await db
    .select()
    .from(level4Agents)
    .where(eq(level4Agents.id, Number(id)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Level 4 agent not found" }, 404);
  }

  const settings = settingsFromBody(body, settingsFromRow(existing));

  try {
    await syncRemoteLevel4Agent(existing.elevenLabsAgentId, settings);
    const [row] = await db
      .update(level4Agents)
      .set(agentRowValues(settings))
      .where(eq(level4Agents.id, Number(id)))
      .returning();

    if (!row) {
      return c.json({ error: "Level 4 agent not found" }, 404);
    }

    return c.json(toAgentResponse(row), 200);
  } catch (error) {
    const message = formatElevenLabsError(error) || "Failed to update Level 4 agent";
    console.error("[level4-agent] Update failed", { id, error: message });
    return c.json({ error: message }, 500);
  }
});

level4AgentApp.openapi(getAgentRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db
    .select()
    .from(level4Agents)
    .where(eq(level4Agents.id, Number(id)))
    .limit(1);

  if (!row) {
    return c.json({ error: "Level 4 agent not found" }, 404);
  }

  return c.json(toAgentResponse(row), 200);
});

level4AgentApp.openapi(deleteAgentRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [existing] = await db
    .select()
    .from(level4Agents)
    .where(eq(level4Agents.id, Number(id)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Level 4 agent not found" }, 404);
  }

  await deleteRemoteLevel4Agent(existing.elevenLabsAgentId);
  await db.delete(level4Agents).where(eq(level4Agents.id, Number(id)));
  return c.body(null, 204);
});

level4AgentApp.openapi(startSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json") ?? {};
  const memoryBank = (body.memoryBank ?? "").trim();

  const [agent] = await db
    .select()
    .from(level4Agents)
    .where(eq(level4Agents.id, Number(id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: "Level 4 agent not found" }, 404);
  }

  const settings = settingsFromRow(agent);

  try {
    if (body.forceSyncAgent ?? true) {
      await syncRemoteLevel4Agent(agent.elevenLabsAgentId, settings);
    }

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
              settings,
            },
          },
        ]),
        metrics: JSON.stringify({
          ttsModel: settings.ttsModel,
          llm: settings.llm,
          voicePreset: settings.voicePreset,
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
        dynamicVariables: sessionDynamicVariables(settings, memoryBank),
        memoryBank,
        enabledTools: settings.enabledTools,
      },
      201,
    );
  } catch (error) {
    const message = formatElevenLabsError(error) || "Failed to start Level 4 session";
    console.error("[level4-agent] Start session failed", {
      agentId: id,
      error: message,
    });
    return c.json({ error: message }, 500);
  }
});

void ClinicalContextSchema;
