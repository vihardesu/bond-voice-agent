import "dotenv/config";
import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";

import { runMigrations } from "./db/migrate.js";
import { conciergeDoctorApp } from "./modules/concierge-doctor/index.js";
import { speechSessionsApp } from "./modules/speech-sessions/index.js";
import { agentsApp } from "./routes/agents.js";

const app = new OpenAPIHono();

app.use(
  "*",
  cors({
    origin: "*",
  }),
);

app.get("/", (c) =>
  c.json({
    service: "bond-voice-agent-backend",
    status: "ok",
    docs: "/ui",
    openapi: "/doc",
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/", agentsApp);
app.route("/", speechSessionsApp);
app.route("/", conciergeDoctorApp);

app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    title: "Bond Voice Agent API",
    version: "0.1.0",
    description: "Backend API for Bond Voice Agent",
  },
});

app.get("/ui", swaggerUI({ url: "/doc" }));

const port = Number(process.env.PORT) || 3001;

async function start() {
  await runMigrations();

  serve(
    {
      fetch: app.fetch,
      port,
      hostname: "0.0.0.0",
    },
    (info) => {
      console.log(`Backend listening on http://${info.address}:${info.port}`);
      console.log(`OpenAPI spec: http://localhost:${info.port}/doc`);
      console.log(`Swagger UI:   http://localhost:${info.port}/ui`);
    },
  );
}

start().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
