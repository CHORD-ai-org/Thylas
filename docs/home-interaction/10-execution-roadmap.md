# 10 — Execution Roadmap

**Status:** [P] phased plan. Tasks are labelled by readiness:
**MVP-essential** / **valuable** / **future** / **blocked (needs a decision from 09)**.
Dependency verification first (audit §6): model completion ✅, LLM extraction pattern ✅
(`server/profile/extract.ts`), file storage ✅, conversation transcripts ✅, notes ✅
(client-local), artifact persistence ❌, GSC ❌, tool execution ❌ (WAM).

## Phase 0 — Foundation (low-risk, independent, do first)

### T0.1 Invocation core (`src/lib/invoke.ts`)
- Objective: pure token parsing + ranking + `toReference` (02 §10).
- User-visible: none yet (library).
- Deps: none. Files: new `src/lib/invoke.ts`; precedent `src/pages/notes/NoteEditor.tsx:28-50`.
- Backend: none. Contracts: `InvokeItem/InvokeQuery` types.
- Acceptance: unit tests (trigger detection incl. CJK/e-mail non-trigger, ranking order, chip conversion).
- Risk: none. Independent: yes.

### T0.2 Composer token + chip model
- Objective: `@` trigger in `Composer` (textarea caret token), palette popover, reference chips incl. **draft** conversations (fixes `Composer.tsx:34-36` gap).
- User-visible: type `@` → pick an object → chip binds to the thread (invocation only; binding honest).
- Deps: T0.1. Files: `Composer.tsx`, `ContextBar`; reuse chip/popover chrome.
- Backend: none (binding writes `conversation.context` as today).
- Acceptance: e2e — `@` opens palette, selection inserts a finished chip, Esc cancels, non-member objects absent.
- Risk: low-medium (textarea caret handling). Independent: yes.

### T0.3 Block contract extension (types + validators only)
- Objective: add interaction block kinds to `lib/chat.ts` (`proposal|candidates|evidence-view|compare|diff|structured-editor|approval`) + `isBlock` cases + tests.
- User-visible: none (contract). Deps: none. Risk: low — shared contract; do it in one pass.
- Acceptance: client+server compile; existing chat tests green.

## Phase 1 — MVP extraction & review (the demo in 08 §4)

- **T1.1 Source discovery block** — list notes/conversations/files by date/name filter; multi-select. Files: new block component; data from `state/notes.ts`, `state/chat.ts`. UI prototype first (no backend).
- **T1.2 Extraction over selected sources** — reuse `extract.ts` pattern (prompt + parse, typed candidates with evidence spans). Backend: extend `/api/ai` usage; **labelled simulated if no artifacts store**. Risk: A5 (no structured-output channel) → prompt-parse, honestly labelled.
- **T1.3 CandidateList block** — reuse `ProfileInit` candidate card (accept/reject/edit, batch select) + per-type editors for Conceptual/Structural first.
- **T1.4 Commit + provenance + history** — client-local artifacts store commit (idempotent content key, append-only history, never silent overwrite) mirroring `store.ts:198-242`; **must be labelled "local prototype"** until Q7 settles.
- **Acceptance (MVP demo):** diary+conversation sources → candidates → edit/reject → approve → persisted with provenance + history, end-to-end in UI.
- Valuable (not blocking the demo): T1.5 evidence span viewer; T1.6 dedupe pass (compare block); T1.7 **Home Conversation merge** — unify the Overview intent input into the conversation surface (01 §1, founder decision 2026-11-21); task card in 11.

## Phase 2 — Governance & profile loop

- T2.1 MutationIntent + approval inline blocks (06) shared by profile + artifact paths.
- T2.2 "Update my profile from the conversation" (08 §6) — wires the shipped profile pipeline to conversation blocks. Low risk, real persistence today.
- T2.3 `/api/ai*` session authz (A2) — required before any agent-op is real.
- T2.4 Minimal retrieval for bound context (or explicitly keep bindings inert + labelled) — depends on A1/Q3.

## Phase 3 — Evolution & conflicts

- T3.1 Revision proposals + hunk diff (extend Notes "Show both"), apply with `expectedVersion`.
- T3.2 Compare/dedup block + `contradicts`/`supersedes` relations (08 §7).
- T3.3 Artifact server persistence (tables per `schema.ts` Phase-4 note) + commit endpoints of 04 §5.
- T3.4 Chat conflict replay (A3) before multi-surface editing ships.

## Future / Deferred (explicitly not planned now)

- GSC service + retrieval ranking (03) — GSC has no code; Q3/Q8 first.
- Delegation grants / standing commit authority (Q4).
- Tool execution & real agent loops — WAM's responsibility.
- Semantic/voice invocation, embedding search, multi-coworker thread views.

## Blocked on decisions (do not start)

| Task | Blocked by |
| --- | --- |
| Landing of the merged Home Conversation | Q1 (restated) |
| `/` action palette (vs single `@`) | Q2 |
| Working-context persistence | Q3 |
| Coworker commit delegation | Q4 |
| Batch-commit UX | Q5 |
| Where structured blocks live | Q6 |
| Artifacts server tables for MVP | Q7 |
| GSC scope model | Q8 |

## Task card template (for each implementation task)

Objective · User-visible outcome · Dependencies · Existing files · Backend changes ·
Frontend changes · Contracts · Acceptance criteria · Risks · Independent?

## Implementation rules applied (brief §6)

Low-risk, independently testable first; UI prototypes allowed where backend is not ready;
no speculative domain models; no irreversible mutations; no new dependencies; no unrelated
refactors; no duplicated GSC/Artifact implementations; simulated interactions labelled;
tests green + full suite verified after each task.
