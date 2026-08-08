import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { agents, type Agent } from "../db/tables/agents.js";
import {
  AgentIdParamSchema,
  AgentSchema,
  CreateAgentSchema,
  ErrorSchema,
  UpdateAgentSchema,
  type AgentResponse,
} from "../schemas/agents.js";

function toAgentResponse(agent: Agent): AgentResponse {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

const listAgentsRoute = createRoute({
  method: "get",
  path: "/agents",
  tags: ["Agents"],
  summary: "List agents",
  operationId: "listAgents",
  responses: {
    200: {
      description: "All agents",
      content: {
        "application/json": {
          schema: z.array(AgentSchema),
        },
      },
    },
  },
});

const getAgentRoute = createRoute({
  method: "get",
  path: "/agents/{id}",
  tags: ["Agents"],
  summary: "Get an agent by id",
  operationId: "getAgent",
  request: {
    params: AgentIdParamSchema,
  },
  responses: {
    200: {
      description: "Agent found",
      content: {
        "application/json": {
          schema: AgentSchema,
        },
      },
    },
    404: {
      description: "Agent not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const createAgentRoute = createRoute({
  method: "post",
  path: "/agents",
  tags: ["Agents"],
  summary: "Create an agent",
  operationId: "createAgent",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateAgentSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Agent created",
      content: {
        "application/json": {
          schema: AgentSchema,
        },
      },
    },
  },
});

const updateAgentRoute = createRoute({
  method: "patch",
  path: "/agents/{id}",
  tags: ["Agents"],
  summary: "Update an agent",
  operationId: "updateAgent",
  request: {
    params: AgentIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateAgentSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Agent updated",
      content: {
        "application/json": {
          schema: AgentSchema,
        },
      },
    },
    404: {
      description: "Agent not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const deleteAgentRoute = createRoute({
  method: "delete",
  path: "/agents/{id}",
  tags: ["Agents"],
  summary: "Delete an agent",
  operationId: "deleteAgent",
  request: {
    params: AgentIdParamSchema,
  },
  responses: {
    204: {
      description: "Agent deleted",
    },
    404: {
      description: "Agent not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const agentsApp = new OpenAPIHono();

agentsApp.openapi(listAgentsRoute, async (c) => {
  const rows = await db.select().from(agents).orderBy(agents.id);
  return c.json(rows.map(toAgentResponse), 200);
});

agentsApp.openapi(getAgentRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, Number(id)))
    .limit(1);

  if (!row) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json(toAgentResponse(row), 200);
});

agentsApp.openapi(createAgentRoute, async (c) => {
  const body = c.req.valid("json");
  const [row] = await db
    .insert(agents)
    .values({
      name: body.name,
      description: body.description ?? "",
    })
    .returning();

  return c.json(toAgentResponse(row), 201);
});

agentsApp.openapi(updateAgentRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const [row] = await db
    .update(agents)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
    })
    .where(eq(agents.id, Number(id)))
    .returning();

  if (!row) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json(toAgentResponse(row), 200);
});

agentsApp.openapi(deleteAgentRoute, async (c) => {
  const { id } = c.req.valid("param");
  const deleted = await db
    .delete(agents)
    .where(eq(agents.id, Number(id)))
    .returning({ id: agents.id });

  if (deleted.length === 0) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.body(null, 204);
});
