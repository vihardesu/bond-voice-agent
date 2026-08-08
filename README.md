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
npm run db:push
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

- **Agents** (`/`) — manage voice agent configs
- **Speech** (`/speech`) — OpenAI Realtime speech-to-speech conversations with persisted session history (duration, start/end, transcript)
- **Concierge** (`/concierge`) — standalone ElevenLabs empathetic concierge doctor with empathy dials, structured clinical context, mock care actions/handoffs, live observability, and historic sessions

Backend speech module: `backend/src/modules/speech-sessions/` (`OPENAI_API_KEY`).

Backend concierge module: `backend/src/modules/concierge-doctor/` (`ELEVENLABS_API_KEY`, optional `ELEVENLABS_CONCIERGE_AGENT_ID`).

## Feature workflow

See [`.agents/skills/feature-flow/SKILL.md`](.agents/skills/feature-flow/SKILL.md) for the full path:

1. Drizzle tables
2. Hono OpenAPI endpoints
3. Regenerate frontend client from `/doc`
4. TanStack Query hooks
5. Untitled UI screens
