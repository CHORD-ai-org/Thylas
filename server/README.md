# server/ — the Thylas backend

**What this directory is:** the application backend. It holds secrets, talks to external
model APIs, and persists application-domain data. Mounted by Vite in `dev` and
`preview`; `npm run api` runs the same router on a standalone `node:http` host
(D-055). Verified facts, endpoint list and current limits:
`docs/development/backend/AUDIT.md` (rewritten 2026-11-13).

**What never belongs here:** WAM's agent framework internals (planning, shared context,
orchestration — see `docs/development/backend/INTEGRATION.md`), prompt policy, or any
client rendering concern.

## Files

| File | Purpose |
| --- | --- |
| `config.ts` | The only module that reads environment variables. Typed once per process. |
| `ai-handler.ts` | The only implementation of the three endpoints. Pure `node:http`; no Vite import. |
| `routes/profile.ts` + `profile/` | Profile Initialization API: sources → retrieval → extraction → candidate review → confirmed records (see `docs/development/profile/IMPLEMENTATION.md`). |
| `ai.ts` | Vite adapter: mounts the handlers in `dev` and `preview`. Key scrubbed from every log. |
| `index.ts` | Standalone host (`npm run api`), default port 8787. Same handlers, no Vite. |
| `persistence/` | Drizzle schema (3 tables), generated SQL migrations `0000`…`0002` (P1-3/6/7) and the one DB connection (P1-4). |
| `routes/{conversations,files,chat}.ts` | CRUD, file upload/download, chat state (P1-4/6/7). |
| `session/` | Replaceable session source + `GET /api/session` (P1-5). |
| `storage/local.ts` | Only module touching uploaded bytes on disk (P1-6). |
| `router.ts` | The one API router; both hosts mount it, 7 path constants / 16 operations. |
| `http.ts` | `sendJson` / `readBody` (64 KB) / `readJsonBody` (8 MB) / `pipeBodyToFile` (100 MB). |

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

`npm run api:check` starts all three hosts on free ports and checks those
behaviours without a key or Docker. The client-side caller is
`src/services/conversations/client.ts`; it imports the same contract module.

## Session and membership (P1-5)

`GET /api/session` returns `{ok:true, user:{id, workspaceIds}}` for a valid
session, or 401 `unauthorized`. Every `/api/conversations*` request checks the
session first (401), then the workspace membership (403), then performs the
write — a non-member never gets an empty list. The contract is
`src/lib/session.ts`; `server/session/source.ts` is the single replaceable
source. With no `CHORD_ISSUER` it reads a dev-only cookie; with an issuer set
it fails closed at 401 until the IdP verifier exists. Swapping in CHORD changes
one module, not the routes.

## Files (P1-6)

`POST /api/files` streams a raw body to `STORAGE_DIR/<wsId>/<fileId>`; metadata
lands in the `files` table. `GET /api/files`, `GET /api/files/:id`,
`GET /api/files/:id/content` and `DELETE /api/files/:id` (soft delete) complete
the surface. Every one checks the session and workspace membership first.
Without `DATABASE_URL` or `STORAGE_DIR` they answer 503 `not_configured`.
Upload metadata travels in `x-thylas-file-*` headers with a URL-encoded name.
The 100 MB cap returns 413 and removes the partial file. Presigned direct
upload is deferred (`P1-6.md` §1, D-057).

## Chat state (P1-7)

`GET|PUT /api/chat/state` reuse the `conversations` and `messages` tables;
`activeId` / `dock` stay client-local. `VITE_CHAT_SOURCE=local` (default) keeps
the browser envelope unchanged; `api` syncs optimistically with a 300 ms
throttle and an `expectedVersion` guard (409 on conflict). The contract is
`src/lib/chat.ts`. Old `{type}` blocks are normalised on read.

## User (Phase 2 A1, D-059)

`GET|PATCH /api/user` reads and writes the one field Thylas owns here — the
display name. The user id comes only from the session; the client never sends
one, so a caller cannot address another user's file. `server/user/store.ts`
writes `<STORAGE_DIR>/user/<userId>.json` (or `.workbuddy/user/` when unset),
a separate file from the Profile pipeline. No `users` table and no migration
yet: this deployment has no `DATABASE_URL`, and a table would answer 503 here.
`VITE_USER_SOURCE=local` (default) keeps the browser envelope unchanged;
`api` hydrates once and syncs name changes in the background, always keeping
the local copy. The contract is `src/lib/user.ts`. Replacing the file store
with Postgres later changes one module.
