# Backend — repository audit

Written 2026-11-11, before any backend structuring. Facts verified against the code.

> **Snapshot only.** Superseded on 2026-11-12 by `PHASE-1.md` P1-1 (D-055): the
> backend now has 5 files, a standalone Node host, and `server/ai-handler.ts` as
> the single implementation of the three endpoints. This file stays as the 11-11
> record; `PHASE-1.md` P1-8 rewrites the audit against the running code.

## 1. What the backend actually is today

The entire backend is **one Vite middleware file: `server/ai.ts`**. It is mounted by
`vite.config.ts` in both `dev` and `preview` (where a real host would mount the same
handler later — open question Q-2 in the AI subplan). It serves:

| Endpoint | Purpose | Contract |
| --- | --- | --- |
| `POST /api/ai` | one-shot DeepSeek completion | `src/lib/ai.ts` (`AiOk` / `AiErr`, 7 error kinds) |
| `POST /api/ai/stream` | SSE passthrough of DeepSeek streaming | same error kinds pre-stream; the 200 body is the model's own OpenAI SSE (D-051) |
| `GET /api/ai/status` | `{configured, model}` probe | `AiStatusBody` |

Key handling: `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` /
`DEEPSEEK_TIMEOUT_MS` from env; the key never reaches the client (D-006).

## 2. What does not exist (verified, not assumed)

- **No database.** No ORM, no migrations, no SQL. Every write is a versioned
  localStorage/sessionStorage envelope (`thylas:<domain>:v1|v2`) with a validating
  `read()` in the domain's store module (`src/state/*`).
- **No authentication.** The identity provider (CHORD) is named in the UI as
  "not connected"; nothing checks credentials.
- **No file storage.** Files, boards, processes are seed data in `src/data/*`; notes
  persist client-side only.
- **No long-running execution.** Processes/runs are simulated (700 ms); compute runs are
  queued-not-started by design.
- **No API surface beyond the three AI endpoints.**

## 3. Conventions worth preserving (these ARE the house style)

1. **The contract lives in a shared module both sides import** (`src/lib/ai.ts`), so a
   wire change is a compile error on the other side (D-006). This is the pattern any new
   backend surface should follow (`server/` handler + `src/lib/<domain>.ts` contract).
2. **Typed failures, not exceptions.** Seven error kinds with an honest `retryable`
   flag; every client function returns a value the UI can render.
3. **Secrets server-side only.** Env vars read in `server/`, never shipped.
4. **Versioned envelopes with validated reads.** Malformed payloads lose bad entries,
   never the library.
5. **Deterministic simulation over random failure.** e2e steers via a local stub
   (`DEEPSEEK_BASE_URL` → `scripts/ui-checks.mjs` stub); UI failure states must be
   reproducible.
6. **Docs per feature under `docs/development/<feature>/`** with AUDIT / SPEC /
   MOCKED-AND-FUTURE and a dated decision in `docs/development/ui-mvp/DECISIONS.md`.

## 4. Domain state today (where each entity lives)

| Entity | Where it lives now | Persistence |
| --- | --- | --- |
| User / prefs | `state/user.ts` | `thylas:user:v1` |
| Workspaces | `state/workspaces.ts` + seeds | `thylas:workspaces:v1` |
| Files / Boards / Processes | seed data, read-only | none (client-only demo) |
| Notes | `state/notes.ts` | `thylas:notes:v1` |
| Conversations / Messages | `state/chat.ts` | `thylas:chat:v1` |
| Context sources | inside conversations | same envelope |
| Artifacts | chat code blocks → Save as note | notes envelope |
| Integrations | `state/connect.ts` | `thylas:connect:v1` |
| Backends / Instances / Workloads | `state/compute.ts` | `thylas:compute:v2` |
| AI calls | `services/ai/*` | none |

## 5. What WAM Joshō will need that has no home yet

1. **Server-side persistence** for conversations, artifacts and artifact history —
   today client-only; the chat envelope cannot carry multi-coworker state.
2. **An artifact domain model** (type, version, history, state transitions) — today
   only an implicit one inside chat blocks.
3. **A Coworker entity** and per-coworker WAM connection records.
4. **A toolset registration/execution interface** — today nothing executes.
5. **A WAM integration boundary** — today nothing knows about WAM, which is correct;
   the boundary must be designed before any code imports WAM concepts.

## 6. Disposition

The backend is one file; "reorganizing" it would be churn. What is missing is **the
documented architecture** that tells future work where things belong, and a small,
justified extraction (server config) — not scaffolding. See `OVERVIEW.md` for the target
structure and `DOMAIN-MODELS.md` for the implemented/proposed split.
