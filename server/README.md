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
