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
| `ai.ts` | Model API middleware: `POST /api/ai`, `POST /api/ai/stream`, `GET /api/ai/status`. Key scrubbed from every log. |

## Where new backend functionality goes

- A new API surface → `routes/<domain>.ts` (created with its second endpoint, not before)
  + its wire contract in `src/lib/<domain>.ts` (the D-006 pattern: both sides import it).
- Durable data → `persistence/` (created when the first server-persisted domain lands).
- WAM integration → `wam/` (created only when a concrete WAM API exists; until then the
  boundary lives in `docs/development/backend/INTEGRATION.md` as prose).

The full architecture, standards, and the implemented/proposed domain split:
`docs/development/backend/`.
