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

## Feature workflow

See [`.agents/skills/feature-flow/SKILL.md`](.agents/skills/feature-flow/SKILL.md) for the full path:

1. Drizzle tables
2. Hono OpenAPI endpoints
3. Regenerate frontend client from `/doc`
4. TanStack Query hooks
5. Untitled UI screens
