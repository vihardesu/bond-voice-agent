---
name: feature-flow
description: End-to-end Bond Voice Agent feature workflow from Drizzle tables through Hono OpenAPI endpoints, frontend OpenAPI client generation, TanStack Query hooks, and Untitled UI screens. Use whenever adding or changing a backend-backed feature, creating tables/endpoints, regenerating the API client, wiring React Query hooks, or building CRUD UI in this repo — even if the user only mentions one layer.
---

# Feature flow (backend → frontend)

Follow this path for every new data-backed feature in `bond-voice-agent`.

## Stack map

| Layer | Tooling | Location |
| --- | --- | --- |
| Tables / migrations | Drizzle ORM + SQLite (libsql) | `backend/src/db/`, `backend/drizzle.config.ts` |
| HTTP + OpenAPI | Hono + `@hono/zod-openapi` | `backend/src/routes/`, `backend/src/schemas/` |
| Public OpenAPI | `GET /doc` (+ Swagger UI at `/ui`) | `backend/src/index.ts` |
| Generated SDK + Query options | `@hey-api/openapi-ts` + `@tanstack/react-query` plugin | `frontend/src/client/` |
| Feature hooks | Thin wrappers over generated options | `frontend/src/hooks/` |
| UI | Untitled UI + React Aria components | `frontend/src/components/` |

Official Drizzle Kit agent skills live under `.agents/skills/drizzle*` (installed via `npx drizzle-kit skills` from `backend/`).

## 1. Create / change tables (Drizzle)

1. Edit `backend/src/db/schema.ts` (or add a schema module and re-export).
2. From `backend/`:
   - `npm run db:generate` — create SQL migration under `backend/drizzle/`
   - `npm run db:push` — apply schema in local/dev (fast iteration)
   - Prefer committing generated migrations for shared environments.
3. Keep column types and defaults explicit. Export `$inferSelect` / `$inferInsert` types when useful.
4. For Drizzle Kit CLI behavior, load the matching `.agents/skills/drizzle-*` skill.

## 2. Add endpoints (Hono OpenAPI)

1. Define Zod request/response schemas with `z` from `@hono/zod-openapi` (see `backend/src/schemas/`).
2. Declare routes with `createRoute({ operationId, tags, request, responses })`.
3. Implement handlers on an `OpenAPIHono` app (see `backend/src/routes/agents.ts`).
4. Mount the route app from `backend/src/index.ts`.
5. Confirm the public spec:
   - JSON: `http://127.0.0.1:3001/doc`
   - UI: `http://127.0.0.1:3001/ui`
6. Every handler that the frontend will call must appear in `/doc` with a stable `operationId`.

## 3. Refresh the frontend generated client

With the backend running (`cd backend && npm run dev`):

```bash
cd frontend
npm run generate:api
```

This runs `@hey-api/openapi-ts` using `frontend/openapi-ts.config.ts`, which:

- reads `OPENAPI_INPUT` or `http://127.0.0.1:3001/doc`
- writes to `frontend/src/client/` (treat as generated — do not hand-edit)
- emits SDK functions, types, Fetch client, and TanStack Query helpers under `src/client/@tanstack/react-query.gen.ts`

Runtime base URL comes from `frontend/src/api/hey-api-runtime.ts` (`NEXT_PUBLIC_API_URL`).

Commit the regenerated `frontend/src/client/**` so CI/builds do not require a live backend.

## 4. Create React Query hooks

Prefer thin wrappers around generated options/mutations:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAgentsOptions,
  listAgentsQueryKey,
  createAgentMutation,
} from "@/client/@tanstack/react-query.gen";

export function useAgents() {
  return useQuery(listAgentsOptions());
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...createAgentMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listAgentsQueryKey() });
    },
  });
}
```

Conventions:

- Put feature hooks in `frontend/src/hooks/use-<resource>.ts`.
- Invalidate list/detail query keys after mutations.
- Do not re-implement fetch/URL logic — call the generated client.
- Ensure `QueryProvider` wraps the app (`frontend/src/providers/query-provider.tsx`).

## 5. Build the frontend (Untitled UI)

1. Prefer existing components under `frontend/src/components/base/*`.
2. Install missing Untitled UI pieces via MCP/`npx untitledui@latest add <component>` rather than inventing new primitives.
3. Keep screens composition-focused: one job per section, reuse Input/TextArea/Button/Badge patterns.
4. Wire screens only through the feature hooks from step 4.
5. Example reference: `frontend/src/components/agents/agents-crud.tsx`.

## Checklist for a new feature

- [ ] Schema + migration/push in `backend/`
- [ ] Zod schemas + OpenAPI routes mounted and visible at `/doc`
- [ ] Backend typechecks (`npm run typecheck` in `backend/`)
- [ ] `npm run generate:api` in `frontend/` after backend is up
- [ ] Hooks wrapping generated query/mutation options
- [ ] Untitled UI screen using those hooks
- [ ] Manual smoke: create/list/update/delete against local API

## Common commands

```bash
# Backend
cd backend
npm run dev
npm run db:push
npm run db:generate
npm run typecheck

# Frontend
cd frontend
npm run generate:api
npm run dev
```
