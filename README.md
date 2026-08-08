# bond-voice-agent

Monorepo for the Bond voice agent.

- `frontend/` — Next.js app (Untitled UI + TanStack Query + generated OpenAPI client)
- `backend/` — Hono TypeScript API (Drizzle + SQLite + OpenAPI)

## Quick start

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:push   # optional locally; `npm run dev` also applies migrations on boot
npm run dev
```

- API: `http://127.0.0.1:3001`
- OpenAPI JSON: `http://127.0.0.1:3001/doc`
- Swagger UI: `http://127.0.0.1:3001/ui`

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run generate:api   # requires backend running
npm run dev
```

## Features

- **Home** (`/`) — gallery of the speakable agents
- **Level 1 Agent** (`/speech`) — OpenAI Realtime speech-to-speech baseline (no custom harness/prompt) with persisted session history
- **Level 2 Agent** (`/concierge`) — ElevenLabs empathetic concierge doctor with empathy dials, structured clinical context, mock care actions/handoffs, guardrails, live observability, and historic sessions
- **Level 3 Agent** (`/level3`) — tunable healthcare concierge builder: save typed harness settings as distinct ElevenLabs agents, converse with each, and keep Level 2-style observability

Backend speech module: `backend/src/modules/speech-sessions/` (`OPENAI_API_KEY`).

Backend concierge module: `backend/src/modules/concierge-doctor/` (`ELEVENLABS_API_KEY`, optional `ELEVENLABS_CONCIERGE_AGENT_ID`).

Backend Level 3 module: `backend/src/modules/level3-agent/` (`ELEVENLABS_API_KEY`).

## Feature workflow

See [`.agents/skills/feature-flow/SKILL.md`](.agents/skills/feature-flow/SKILL.md) for the full path:

1. Drizzle tables
2. Hono OpenAPI endpoints
3. Regenerate frontend client from `/doc`
4. TanStack Query hooks
5. Untitled UI screens
