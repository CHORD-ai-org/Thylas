# server/ — the Thylas backend

**What this directory is:** the application backend. It holds secrets, talks to external
model APIs, and (as the product grows) persists application-domain data. Mounted by
Vite in `dev` and `preview`; a real host mounts the same handlers later.

**What never belongs here:** WAM's agent framework internals (planning, shared context,
orchestration — see `docs/development/backend/INTEGRATION.md`), prompt policy, or any
client rendering concern.

## Files

| File | Purpose |
| --- | --- |
| `config.ts` | The only module that reads environment variables. Typed once per process. |
| `ai-handler.ts` | The only implementation of the three endpoints. Pure `node:http`; no Vite import. |
| `ai.ts` | Vite adapter: mounts the handlers in `dev` and `preview`. Key scrubbed from every log. |
| `index.ts` | Standalone host (`npm run api`), default port 8787. Same handlers, no Vite. |
| `persistence/` | Drizzle schema, generated SQL migrations (P1-3) and the one DB connection (P1-4). Chat tables first. |
| `routes/conversations.ts` | CRUD for the first server-owned domain (P1-4). |
| `router.ts` | The one API router; both hosts mount it (P1-4). |
| `http.ts` | `sendJson` / `readBody`, shared by the routes. |

## Where new backend functionality goes

- A new API surface → `routes/<domain>.ts` (created with its second endpoint, not before)
  + its wire contract in `src/lib/<domain>.ts` (the D-006 pattern: both sides import it).
- Durable data → `persistence/` (created when the first server-persisted domain lands).
- WAM integration → `wam/` (created only when a concrete WAM API exists; until then the
  boundary lives in `docs/development/backend/INTEGRATION.md` as prose).

The full architecture, standards, and the implemented/proposed domain split:
`docs/development/backend/`. The five-phase roadmap: `docs/development/backend/ROADMAP.md`.

## Running the standalone host (D-055)

`npm run api` starts a plain `node:http` server on `PORT` (default 8787). Node
loads `.env.local` via `--env-file-if-exists`; a variable the shell already set
wins. `GET /api/ai/status` is the smoke test: it answers `{configured, model}`
without contacting the model. All three endpoints keep the same paths, the same
contract (`src/lib/ai.ts`) and the same typed failures as `npm run dev`.

## Persistence (P1-3)

`server/persistence/schema.ts` defines the first durable tables —
`conversations` and `messages` — following the chat-first rule in
`INTEGRATION.md:31`. `npm run db:generate` writes SQL to
`server/persistence/migrations/`; `npm run db:migrate` applies it to the
Postgres named by `DATABASE_URL`. `server/persistence/migrate.test.ts` applies
the same SQL twice against an embedded Postgres, so the acceptance does not
need Docker running.

## API surfaces (P1-4)

`GET|POST /api/conversations` and `GET|PATCH|DELETE /api/conversations/:id`.
The wire contract is `src/lib/conversations.ts`, imported by the route and by
the client-side tests — a field change breaks the other side at compile time.
Failures are typed `{ok:false, kind, message, retryable}`. Without
`DATABASE_URL` every conversations request answers 503 `not_configured`; the
three `/api/ai*` endpoints keep working. `router.ts` hands every non-`/api/`
path back to Vite, so the SPA is unaffected.
