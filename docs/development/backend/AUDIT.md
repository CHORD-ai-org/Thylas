# Backend — repository audit

**Written 2026-11-13 18:05 (P1-8).** Replaces the 11-11 snapshot in this file. Every fact
below was read from the running code. The old snapshot survives as `PHASE-1.md` §0
and in git history; it said "the entire backend is one Vite middleware file".

> **11-13 21:00 update.** External commits added the Profile Initialization pipeline
> (`server/profile/*`, `server/routes/profile.ts`, `src/lib/profile.ts`, `/user/profile`).
> The numbers in §1, §2 and §7 are the 18:05 snapshot. **As of 11-14 08:20** the
> counts are 30 server `.ts` files, 9 path constants / 25 operations (Phase 2 A1
> added `GET|PATCH /api/user`), 50 test files / 424 tests, 16 `api:check` checks,
> 315 e2e assertions. A1's User state uses a per-user server file, not a table
> (D-059) — `server/user/store.ts`; the 3 tables in §3 are unchanged.
> Full capability audit: `PHASE-2-USER.md` §0. Pipeline details:
> `docs/development/profile/IMPLEMENTATION.md`. §7's verification numbers are kept
> as the dated P1-8 record, not rewritten.

## 0. The short version

`npm run dev` starts one Vite process on 5173. The page, the AI endpoints,
`/api/session`, `/api/conversations`, `/api/files` and `/api/chat/state` are all on
that port. `vite.config.ts` has no proxy. `npm run api` starts `server/index.ts`
on 8787 with the same router and no Vite.

With no `DATABASE_URL` and no `STORAGE_DIR`, the startup line reads
`key set · db missing`. Protected DB endpoints answer `503 not_configured`; they do
not crash and they do not pretend to have saved anything.

## 1. Files

| Path | What it does |
| --- | --- |
| `server/index.ts` (30) | Standalone `node:http` host, default 8787 |
| `server/ai.ts` (33) | Vite plugin adapter; no endpoint logic |
| `server/router.ts` (59) | The one router, shared by both hosts; non-`/api/` goes to `next()` for the SPA |
| `server/ai-handler.ts` (407) | The three AI endpoints; SSE bytes are piped through unchanged (D-051) |
| `server/config.ts` (61) | Only module that reads env; 9 typed fields |
| `server/http.ts` (134) | `sendJson`, `readBody` (64 KB), `readJsonBody` (8 MB), `pipeBodyToFile` (100 MB) |
| `server/persistence/schema.ts` (83) | 3 tables, 3 indexes |
| `server/persistence/client.ts` (21) | Only place a DB connection is made |
| `server/routes/{conversations,files,chat}.ts` (267/310/218) | Domain routers |
| `server/session/{source,handler}.ts` (49/48) | Replaceable session source + `GET /api/session` |
| `server/storage/local.ts` (51) | Only module touching upload bytes on disk |
| `src/lib/{ai,conversations,session,files,chat}.ts` | Wire contracts imported by both sides |

Numbers in brackets are line counts. 23 `.ts` files under `server/`; 44 test files
repo-wide.

## 2. API surface

7 path constants in `src/lib/*.ts`, 16 method+path operations, dispatched at
`server/router.ts:42-57`.

| Path | Operations | Contract |
| --- | --- | --- |
| `/api/ai`, `/api/ai/stream`, `/api/ai/status` | 3 | `src/lib/ai.ts:12,22,36` — 7 error kinds, typed `retryable` |
| `/api/session` | 1 GET | `src/lib/session.ts:8` — user id + workspace membership flags |
| `/api/chat/state` | GET, PUT | `src/lib/chat.ts:9` — full envelope, `expectedVersion` conflict → 409 |
| `/api/conversations[/:id]` | GET list, POST, GET one, PATCH, DELETE | `src/lib/conversations.ts:6` |
| `/api/files[/:id][/content]` | GET list, POST upload, GET meta, GET bytes, DELETE soft | `src/lib/files.ts:7` |

Unknown `/api/*` → `404 contract`. A path outside `/api/` is handed back to Vite,
which serves the SPA (checked as `vite dev SPA · HTTP 200`).

## 3. Data

| Table | Columns | Notes |
| --- | --- | --- |
| `conversations` | 8 | `context` JSONB, `sync_version` for optimistic writes, `archived_at` |
| `messages` | 9 | FK to conversations `ON DELETE CASCADE`; `blocks` is the client's four `{kind}` variants |
| `files` | 10 | `deleted_at` soft delete; `folder_id` is a string, no folders table |

Migrations: `0000_tired_exodus.sql`, `0001_classy_bedlam.sql`,
`0002_windy_exiles.sql`. `migrate.test.ts` runs all three twice against embedded
Postgres and writes a message. `npm run db:generate` on a clean tree answers
`No schema changes`.

**Not done:** `npm run db:migrate` has never run against a real Postgres. Docker
daemon is not running on this machine; `docker desktop start` was blocked by the
sandbox. The SQL is verified in PGlite only.

## 4. What a request actually sees

The order in every protected router is session → membership → configuration → write.
Concrete results from `npm run api:check` (14 checks, all green):

| Request | Response |
| --- | --- |
| `GET /api/conversations` with no cookie | `401 {"kind":"unauthorized","message":"Sign in to continue."}` |
| `GET /api/session` with `dev:u-1:ws-1` | `200 {"ok":true,"user":{"id":"u-1","workspaceIds":["ws-1"]}}` |
| create/list/read against another workspace | `403 forbidden`, not an empty list |
| `POST /api/conversations` with a valid cookie, no DB | `503 not_configured` — `No DATABASE_URL on the server. Set it and restart.` |
| `POST /api/ai` with an empty prompt | `400 contract` — `The request needs a non-empty "prompt" string.` |
| `GET /api/ai/status` | `{"configured":true,"model":"deepseek-chat"}` on both hosts and on `PORT=8899` |

`server/session/source.ts:46` is the swap point. With `CHORD_ISSUER` set and no
verifier, the source is `pending-idp` and every protected request fails closed with
401. The dev cookie can never reach such a deployment.

## 5. What still lives in the browser

`VITE_CHAT_SOURCE=local` is the default in `.env.example`. `src/state/chat.ts` (430
lines) keeps `thylas:chat:v1`, and `src/pages/chat/` has no diff from before P1-7.
Setting `api` turns on optimistic commit, 300 ms throttle, one-time envelope import
(marked in `thylas:chat:migrated:v1`, local copy kept). `activeId` and dock state
stay local.

Other versioned envelopes: `user:v1`, `workspaces:v1`, `artifacts:v1`, `notes:v1`,
`connect:v1`, `coworkers:v1`, `compute:v2`. Files, boards and processes are still
seed data in `src/data/`.

`Files.tsx:184,208` still has a disabled Upload button. Its text now says the
service is running but the UI is not wired to it. That is true: the five file
endpoints answer over HTTP, and the page does not call them.

## 6. What does not exist

- CHORD IdP verifier. 401 / 403 are proven with a dev cookie only.
- S3 / R2, presigned URLs, 5 GB ceiling, multipart upload. Local `STORAGE_DIR` tops
  out at 100 MB per file (D-057).
- Real Postgres migration run (§3).
- User / Workspace / Coworker / Artifact tables — Phase 2 (`ROADMAP.md:16-17`).
- WAM, A2A, tool execution, agent orchestration, knowledge graph, billing.
  No `server/wam/` directory (`PHASE-1.md` §3).
- Long-running execution. Process runs are still simulated client-side.
- A browser e2e assertion on `/api/conversations` or `/api/files`. `npm run e2e`
  checks 302 UI behaviours including the AI SSE path; the DB surfaces are covered by
  `server/routes/*.test.ts` over real HTTP and `api:check`.

## 7. P1-8 verification (2026-11-13)

| Command | Result |
| --- | --- |
| `npm run check` | pass |
| `npm run test` | 44 files / 379 tests pass |
| `npm run api:check` | 14 / 14 pass |
| `npm run e2e` | 302 / 302 pass |
| `npm run db:generate` | `No schema changes` |
| `npx eslint server src/lib/{chat,files,session}*` | clean |
| `npm run lint` (full repo) | 2 errors, 2 warnings — all pre-existing |

The two lint errors are untouched by Phase 1: `src/shell/AppShell.tsx:7`
(`no-restricted-imports`) and a missing `react-hooks/exhaustive-deps` rule
definition at `src/pages/coworkers/CoworkerDetail.tsx:37`. Fixing them is a
UI/lint-config task, not a backend one.

## 8. Documents that were out of date before P1-8

All nine were written before Phase 1 and state the opposite of §0 here. Three were
corrected in place on 11-13; the rest keep their wording as a historical record.
This table is the current answer.

| File | Line | Old claim | Reality | 11-13 action |
| --- | --- | --- | --- | --- |
| `docs/README.md` | 139–140 | "Thylas may have no backend", "There is no database yet" | `backend/` has 9 docs, 3 tables, 3 migrations | **Corrected**: §1 adds `development/backend/` as item 15, §5 rows 4–5 rewritten |
| `docs/development/backend/ROADMAP.md` | 3–4 | "P1-0 … P1-4 complete", "still no database / auth / file storage" | P1-0 … P1-8 complete | **Corrected**: status line rewritten, points to this audit |
| `docs/architecture/tech-stack.md` | 24, 93 | "no server runtime" | `npm run api` starts a `node:http` server | Kept |
| `docs/architecture/application.md` | 31 | "no server runtime needed" | same | Kept |
| `docs/planning/file-plan.md` | 390 | "If it exists it is one file, `server/index.ts`" | 23 `.ts` files under `server/` | Head has a D-057 dated note; row kept |
| `docs/planning/roadmap.md` | 107 | "conditional `server/` if N5 says so" | already built | Kept |
| `docs/product/artifacts/OPEN-QUESTIONS.md` | 21 | Q-2 production host "gates everything server-side" | settled by D-055 | Kept |
| `docs/development/backend/OVERVIEW.md` | §2 | "Vite middleware today, standalone host later" | both hosts exist | Kept |
| `server/README.md` | 3–4 | "a real host mounts the same handlers later" | both hosts exist | **Corrected**: head and file table rewritten |

Decision records: D-055 (stack), D-056 (session), D-057 (storage), D-058 (chat mode).

## 9. Boundaries for the next phase

- `server/session/source.ts` — the only file to change when CHORD IdP arrives.
- `server/storage/local.ts` — the only file to change when S3 / R2 arrives.
- `server/persistence/client.ts` — the only place `DATABASE_URL` is used.
- Contracts stay in `src/lib/`; no schema DSL, no codegen
  (`ENGINEERING-STANDARDS.md:22`). One field rename breaks `npm run check` on both
  sides.
- No empty scaffolding directories. `server/wam/` appears only with a real WAM API.
