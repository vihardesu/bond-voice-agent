import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

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
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

const port = Number(process.env.PORT) || 3001;

serve(
  {
    fetch: app.fetch,
    port,
    hostname: "0.0.0.0",
  },
  (info) => {
    console.log(`Backend listening on http://${info.address}:${info.port}`);
  },
);
