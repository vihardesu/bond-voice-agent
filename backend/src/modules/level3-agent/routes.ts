import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import {
  createConversationCredentials,
  createRemoteLevel3Agent,
  deleteRemoteLevel3Agent,
  extractMetricsFromRemote,
  fetchConversationDetails,
  formatElevenLabsError,
  syncRemoteLevel3Agent,
} from "./elevenlabs.js";
import {
  composeLevel3Defaults,
  resolveDisplayName,
} from "./prompt.js";
import {
  DEFAULT_LEVEL3_SETTINGS,
  explanationLevelNumber,
  normalizeEnabledTools,
  normalizeStringList,
  TOOL_OPTIONS,
  type Level3AgentSettings,
  type ToolOption,
} from "./settings.js";
import { level3Agents, level3Sessions, type Level3Agent, type Level3Session } from "./schema.js";
import {
  ClinicalContextSchema,
  ComposeLevel3DefaultsResponseSchema,
  CreateLevel3AgentSchema,
  ErrorSchema,
  IdParamSchema,
  Level3AgentSchema,
  Level3AgentSettingsSchema,
  Level3SessionSchema,
  StartLevel3SessionResponseSchema,
  StartLevel3SessionSchema,
  UpdateLevel3AgentSchema,
  UpdateLevel3SessionSchema,
  type ClinicalContext,
  type Level3AgentResponse,
  type Level3SessionResponse,
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

function settingsFromBody(
  body: Partial<Level3AgentSettings>,
  base: Level3AgentSettings = DEFAULT_LEVEL3_SETTINGS,
): Level3AgentSettings {
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

function settingsFromRow(row: Level3Agent): Level3AgentSettings {
  return {
    variantLabel: row.variantLabel,
    communicationStyle: row.communicationStyle,
    explanationLevel: row.explanationLevel,
    safetyPosture: row.safetyPosture,
    resolutionBias: row.resolutionBias,
    turnEagerness: row.turnEagerness,
    voicePreset: row.voicePreset,
    ttsModel: row.ttsModel,
    llm: row.llm as Level3AgentSettings["llm"],
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

function toAgentResponse(row: Level3Agent): Level3AgentResponse {
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

function agentRowValues(settings: Level3AgentSettings) {
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
  row: Level3Session,
  agentDisplayName: string,
): Level3SessionResponse {
  return {
    id: row.id,
    agentId: row.agentId,
    agentDisplayName,
    title: row.title,
    status: row.status,
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
    .select({ displayName: level3Agents.displayName })
    .from(level3Agents)
    .where(eq(level3Agents.id, agentId))
    .limit(1);
  return agent?.displayName ?? `Agent ${agentId}`;
}

const listAgentsRoute = createRoute({
  method: "get",
  path: "/level3-agents",
  tags: ["Level 3 Agent"],
  summary: "List Level 3 agents",
  operationId: "listLevel3Agents",
  responses: {
    200: {
      description: "All Level 3 agents",
      content: {
        "application/json": {
          schema: z.array(Level3AgentSchema),
        },
      },
    },
  },
});

const getAgentRoute = createRoute({
  method: "get",
  path: "/level3-agents/{id}",
  tags: ["Level 3 Agent"],
  summary: "Get a Level 3 agent",
  operationId: "getLevel3Agent",
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Agent found",
      content: { "application/json": { schema: Level3AgentSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const composeDefaultsRoute = createRoute({
  method: "post",
  path: "/level3-agents/compose-defaults",
  tags: ["Level 3 Agent"],
  summary: "Compose free-text defaults from typed Level 3 dials",
  operationId: "composeLevel3Defaults",
  request: {
    body: {
      content: { "application/json": { schema: Level3AgentSettingsSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Composed defaults",
      content: {
        "application/json": { schema: ComposeLevel3DefaultsResponseSchema },
      },
    },
  },
});

const createAgentRoute = createRoute({
  method: "post",
  path: "/level3-agents",
  tags: ["Level 3 Agent"],
  summary: "Create a Level 3 agent from typed settings",
  operationId: "createLevel3Agent",
  request: {
    body: {
      content: { "application/json": { schema: CreateLevel3AgentSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Agent created",
      content: { "application/json": { schema: Level3AgentSchema } },
    },
    500: {
      description: "Create failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const updateAgentRoute = createRoute({
  method: "patch",
  path: "/level3-agents/{id}",
  tags: ["Level 3 Agent"],
  summary: "Update a Level 3 agent and sync ElevenLabs",
  operationId: "updateLevel3Agent",
  request: {
    params: IdParamSchema,
    body: {
      content: { "application/json": { schema: UpdateLevel3AgentSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Agent updated",
      content: { "application/json": { schema: Level3AgentSchema } },
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
  path: "/level3-agents/{id}",
  tags: ["Level 3 Agent"],
  summary: "Delete a Level 3 agent",
  operationId: "deleteLevel3Agent",
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
  path: "/level3-agents/sessions",
  tags: ["Level 3 Agent"],
  summary: "List Level 3 sessions",
  operationId: "listLevel3Sessions",
  responses: {
    200: {
      description: "All Level 3 sessions",
      content: {
        "application/json": {
          schema: z.array(Level3SessionSchema),
        },
      },
    },
  },
});

const getSessionRoute = createRoute({
  method: "get",
  path: "/level3-agents/sessions/{id}",
  tags: ["Level 3 Agent"],
  summary: "Get a Level 3 session",
  operationId: "getLevel3Session",
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Session found",
      content: { "application/json": { schema: Level3SessionSchema } },
    },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const startSessionRoute = createRoute({
  method: "post",
  path: "/level3-agents/{id}/sessions/start",
  tags: ["Level 3 Agent"],
  summary: "Start a conversation with a Level 3 agent",
  operationId: "startLevel3Session",
  request: {
    params: IdParamSchema,
    body: {
      content: { "application/json": { schema: StartLevel3SessionSchema } },
      required: false,
    },
  },
  responses: {
    201: {
      description: "Session started",
      content: {
        "application/json": { schema: StartLevel3SessionResponseSchema },
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
  path: "/level3-agents/sessions/{id}",
  tags: ["Level 3 Agent"],
  summary: "Update a Level 3 session",
  operationId: "updateLevel3Session",
  request: {
    params: IdParamSchema,
    body: {
      content: { "application/json": { schema: UpdateLevel3SessionSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Session updated",
      content: { "application/json": { schema: Level3SessionSchema } },
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
  path: "/level3-agents/sessions/{id}",
  tags: ["Level 3 Agent"],
  summary: "Delete a Level 3 session",
  operationId: "deleteLevel3Session",
  request: { params: IdParamSchema },
  responses: {
    204: { description: "Deleted" },
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const mockPharmacyRoute = createRoute({
  method: "post",
  path: "/level3-agents/mocks/pharmacy",
  tags: ["Level 3 Agent"],
  summary: "Mock retail pharmacy portal action",
  operationId: "mockLevel3PharmacyRequest",
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
  path: "/level3-agents/mocks/schedule",
  tags: ["Level 3 Agent"],
  summary: "Mock provider follow-up scheduling",
  operationId: "mockLevel3ScheduleFollowUp",
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

export const level3AgentApp = new OpenAPIHono();

// Static `/sessions` routes must be registered before `/{id}` or "sessions" is captured.
level3AgentApp.openapi(listSessionsRoute, async (c) => {
  const rows = await db
    .select({
      session: level3Sessions,
      agentDisplayName: level3Agents.displayName,
    })
    .from(level3Sessions)
    .leftJoin(level3Agents, eq(level3Sessions.agentId, level3Agents.id))
    .orderBy(desc(level3Sessions.startedAt));

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

level3AgentApp.openapi(getSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db
    .select()
    .from(level3Sessions)
    .where(eq(level3Sessions.id, Number(id)))
    .limit(1);

  if (!row) {
    return c.json({ error: "Level 3 session not found" }, 404);
  }

  return c.json(
    toSessionResponse(row, await agentDisplayNameById(row.agentId)),
    200,
  );
});

level3AgentApp.openapi(updateSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const [existing] = await db
    .select()
    .from(level3Sessions)
    .where(eq(level3Sessions.id, Number(id)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Level 3 session not found" }, 404);
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
        .from(level3Agents)
        .where(eq(level3Agents.id, existing.agentId))
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
          llm: agent?.llm ?? "gemini-2.5-flash",
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
      .update(level3Sessions)
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
      .where(eq(level3Sessions.id, Number(id)))
      .returning();

    if (!row) {
      return c.json({ error: "Level 3 session not found" }, 404);
    }

    return c.json(
      toSessionResponse(row, agent?.displayName ?? (await agentDisplayNameById(row.agentId))),
      200,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update Level 3 session";
    return c.json({ error: message }, 500);
  }
});

level3AgentApp.openapi(deleteSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const deleted = await db
    .delete(level3Sessions)
    .where(eq(level3Sessions.id, Number(id)))
    .returning({ id: level3Sessions.id });

  if (deleted.length === 0) {
    return c.json({ error: "Level 3 session not found" }, 404);
  }

  return c.body(null, 204);
});

level3AgentApp.openapi(mockPharmacyRoute, async (c) => {
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

level3AgentApp.openapi(mockScheduleRoute, async (c) => {
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

level3AgentApp.openapi(listAgentsRoute, async (c) => {
  const rows = await db
    .select()
    .from(level3Agents)
    .orderBy(desc(level3Agents.updatedAt));
  return c.json(rows.map(toAgentResponse), 200);
});

level3AgentApp.openapi(composeDefaultsRoute, async (c) => {
  const body = c.req.valid("json");
  const settings = settingsFromBody(body);
  return c.json(composeLevel3Defaults(settings), 200);
});

level3AgentApp.openapi(createAgentRoute, async (c) => {
  const body = c.req.valid("json");
  const settings = settingsFromBody(body);

  try {
    const elevenLabsAgentId = await createRemoteLevel3Agent(settings);
    const [row] = await db
      .insert(level3Agents)
      .values({
        elevenLabsAgentId,
        ...agentRowValues(settings),
      })
      .returning();

    return c.json(toAgentResponse(row), 201);
  } catch (error) {
    const message = formatElevenLabsError(error) || "Failed to create Level 3 agent";
    console.error("[level3-agent] Create failed", { error: message });
    return c.json({ error: message }, 500);
  }
});

level3AgentApp.openapi(updateAgentRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const [existing] = await db
    .select()
    .from(level3Agents)
    .where(eq(level3Agents.id, Number(id)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Level 3 agent not found" }, 404);
  }

  const settings = settingsFromBody(body, settingsFromRow(existing));

  try {
    await syncRemoteLevel3Agent(existing.elevenLabsAgentId, settings);
    const [row] = await db
      .update(level3Agents)
      .set(agentRowValues(settings))
      .where(eq(level3Agents.id, Number(id)))
      .returning();

    if (!row) {
      return c.json({ error: "Level 3 agent not found" }, 404);
    }

    return c.json(toAgentResponse(row), 200);
  } catch (error) {
    const message = formatElevenLabsError(error) || "Failed to update Level 3 agent";
    console.error("[level3-agent] Update failed", { id, error: message });
    return c.json({ error: message }, 500);
  }
});

level3AgentApp.openapi(getAgentRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db
    .select()
    .from(level3Agents)
    .where(eq(level3Agents.id, Number(id)))
    .limit(1);

  if (!row) {
    return c.json({ error: "Level 3 agent not found" }, 404);
  }

  return c.json(toAgentResponse(row), 200);
});

level3AgentApp.openapi(deleteAgentRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [existing] = await db
    .select()
    .from(level3Agents)
    .where(eq(level3Agents.id, Number(id)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Level 3 agent not found" }, 404);
  }

  await deleteRemoteLevel3Agent(existing.elevenLabsAgentId);
  await db.delete(level3Agents).where(eq(level3Agents.id, Number(id)));
  return c.body(null, 204);
});

level3AgentApp.openapi(startSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json") ?? {};

  const [agent] = await db
    .select()
    .from(level3Agents)
    .where(eq(level3Agents.id, Number(id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: "Level 3 agent not found" }, 404);
  }

  const settings = settingsFromRow(agent);

  try {
    if (body.forceSyncAgent ?? true) {
      await syncRemoteLevel3Agent(agent.elevenLabsAgentId, settings);
    }

    const credentials = await createConversationCredentials({
      agentId: agent.elevenLabsAgentId,
    });

    const [row] = await db
      .insert(level3Sessions)
      .values({
        agentId: agent.id,
        title: body.title ?? "",
        status: "active",
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
        dynamicVariables: {
          communication_style: settings.communicationStyle,
          explanation_level: String(explanationLevelNumber(settings.explanationLevel)),
          safety_posture: settings.safetyPosture,
          resolution_bias: settings.resolutionBias,
        },
        enabledTools: settings.enabledTools,
      },
      201,
    );
  } catch (error) {
    const message = formatElevenLabsError(error) || "Failed to start Level 3 session";
    console.error("[level3-agent] Start session failed", {
      agentId: id,
      error: message,
    });
    return c.json({ error: message }, 500);
  }
});

void ClinicalContextSchema;
