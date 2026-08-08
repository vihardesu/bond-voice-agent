import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { createRealtimeClientSecret } from "./openai.js";
import { speechSessions, type SpeechSession } from "./schema.js";
import {
  CreateSpeechClientSecretSchema,
  CreateSpeechSessionSchema,
  ErrorSchema,
  SpeechClientSecretSchema,
  SpeechSessionIdParamSchema,
  SpeechSessionSchema,
  UpdateSpeechSessionSchema,
  type SpeechSessionResponse,
  type TranscriptEntry,
} from "./schemas.js";

function parseTranscript(raw: string): TranscriptEntry[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as TranscriptEntry[];
  } catch {
    return [];
  }
}

function toSpeechSessionResponse(row: SpeechSession): SpeechSessionResponse {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    model: row.model,
    voice: row.voice,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    durationMs: row.durationMs ?? null,
    transcript: parseTranscript(row.transcript),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const listSpeechSessionsRoute = createRoute({
  method: "get",
  path: "/speech-sessions",
  tags: ["Speech Sessions"],
  summary: "List speech sessions",
  operationId: "listSpeechSessions",
  responses: {
    200: {
      description: "All speech sessions",
      content: {
        "application/json": {
          schema: z.array(SpeechSessionSchema),
        },
      },
    },
  },
});

const getSpeechSessionRoute = createRoute({
  method: "get",
  path: "/speech-sessions/{id}",
  tags: ["Speech Sessions"],
  summary: "Get a speech session by id",
  operationId: "getSpeechSession",
  request: {
    params: SpeechSessionIdParamSchema,
  },
  responses: {
    200: {
      description: "Speech session found",
      content: {
        "application/json": {
          schema: SpeechSessionSchema,
        },
      },
    },
    404: {
      description: "Speech session not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const createSpeechSessionRoute = createRoute({
  method: "post",
  path: "/speech-sessions",
  tags: ["Speech Sessions"],
  summary: "Create a speech session",
  operationId: "createSpeechSession",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateSpeechSessionSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Speech session created",
      content: {
        "application/json": {
          schema: SpeechSessionSchema,
        },
      },
    },
  },
});

const updateSpeechSessionRoute = createRoute({
  method: "patch",
  path: "/speech-sessions/{id}",
  tags: ["Speech Sessions"],
  summary: "Update a speech session",
  operationId: "updateSpeechSession",
  request: {
    params: SpeechSessionIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateSpeechSessionSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Speech session updated",
      content: {
        "application/json": {
          schema: SpeechSessionSchema,
        },
      },
    },
    404: {
      description: "Speech session not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const deleteSpeechSessionRoute = createRoute({
  method: "delete",
  path: "/speech-sessions/{id}",
  tags: ["Speech Sessions"],
  summary: "Delete a speech session",
  operationId: "deleteSpeechSession",
  request: {
    params: SpeechSessionIdParamSchema,
  },
  responses: {
    204: {
      description: "Speech session deleted",
    },
    404: {
      description: "Speech session not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const createSpeechClientSecretRoute = createRoute({
  method: "post",
  path: "/speech-sessions/client-secret",
  tags: ["Speech Sessions"],
  summary: "Create an OpenAI Realtime ephemeral client secret",
  operationId: "createSpeechClientSecret",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateSpeechClientSecretSchema,
        },
      },
      required: false,
    },
  },
  responses: {
    200: {
      description: "Ephemeral client secret",
      content: {
        "application/json": {
          schema: SpeechClientSecretSchema,
        },
      },
    },
    500: {
      description: "Failed to mint client secret",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const speechSessionsApp = new OpenAPIHono();

speechSessionsApp.openapi(listSpeechSessionsRoute, async (c) => {
  const rows = await db
    .select()
    .from(speechSessions)
    .orderBy(desc(speechSessions.startedAt));
  return c.json(rows.map(toSpeechSessionResponse), 200);
});

speechSessionsApp.openapi(createSpeechClientSecretRoute, async (c) => {
  const body = c.req.valid("json") ?? {};

  try {
    const secret = await createRealtimeClientSecret({
      model: body.model,
      voice: body.voice,
    });
    return c.json(secret, 200);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create client secret";
    return c.json({ error: message }, 500);
  }
});

speechSessionsApp.openapi(getSpeechSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db
    .select()
    .from(speechSessions)
    .where(eq(speechSessions.id, Number(id)))
    .limit(1);

  if (!row) {
    return c.json({ error: "Speech session not found" }, 404);
  }

  return c.json(toSpeechSessionResponse(row), 200);
});

speechSessionsApp.openapi(createSpeechSessionRoute, async (c) => {
  const body = c.req.valid("json");
  const [row] = await db
    .insert(speechSessions)
    .values({
      title: body.title ?? "",
      model: body.model ?? "gpt-realtime-2.1",
      voice: body.voice ?? "marin",
      status: "active",
      startedAt: new Date(),
      transcript: "[]",
    })
    .returning();

  return c.json(toSpeechSessionResponse(row), 201);
});

speechSessionsApp.openapi(updateSpeechSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const [row] = await db
    .update(speechSessions)
    .set({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.endedAt !== undefined ? { endedAt: new Date(body.endedAt) } : {}),
      ...(body.durationMs !== undefined ? { durationMs: body.durationMs } : {}),
      ...(body.transcript !== undefined
        ? { transcript: JSON.stringify(body.transcript) }
        : {}),
    })
    .where(eq(speechSessions.id, Number(id)))
    .returning();

  if (!row) {
    return c.json({ error: "Speech session not found" }, 404);
  }

  return c.json(toSpeechSessionResponse(row), 200);
});

speechSessionsApp.openapi(deleteSpeechSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const deleted = await db
    .delete(speechSessions)
    .where(eq(speechSessions.id, Number(id)))
    .returning({ id: speechSessions.id });

  if (deleted.length === 0) {
    return c.json({ error: "Speech session not found" }, 404);
  }

  return c.body(null, 204);
});
