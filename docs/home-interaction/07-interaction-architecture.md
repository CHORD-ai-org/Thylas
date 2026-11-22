# 07 — Interaction Architecture

**Status:** [P] architecture. Layers are *responsibilities*, not a demand for separate
services — most layers are modules inside the existing MVP (audit §1–3). No layer implies a
new agent or a new service.

## 1. The lifecycle

```
Home Conversation
 → Intent & Operation Understanding
 → Object Discovery / Context Retrieval
 → Operation Execution
 → Intelligent UI Presentation
 → Human Review / Interaction
 → Commit and Persistence
```

Each arrow can return to the previous step (clarify, re-retrieve, re-propose). Nothing
commits without passing through Human Review when risk requires it (06 §5).

## 2. Layer responsibilities & boundaries

| Layer | Responsibility | Boundary (must not) | Where it lives today |
| --- | --- | --- | --- |
| **Frontend interaction layer** | composer, invocation palette, chips, blocks, editors | never computes access; never persists domain truth | `src/pages/chat/*`, `src/pages/user/ProfileInit.tsx` |
| **Conversation orchestration** | turn state, message/block assembly, streaming lifecycle, working-context binding | not the model; not a workflow engine | `src/state/chat.ts`, `ChatCore.tsx` |
| **Model integration** | one completion/stream call with bound context in, blocks out | no tool execution, no agent loop (WAM boundary) | `src/services/ai/*`, `server/ai-handler.ts` |
| **Context retrieval** | resolve bindings → Retrieved/Working Context; rank, cite | not a universal store; not auto-injection | **missing** (ContextSource is declarative only) |
| **Domain services** | profiles, artifacts, GSC entries, notes, files — own their rules (validation, versioning) | not UI; not retrieval | `server/profile/*`, `server/routes/*`, `src/state/*` |
| **Mutation & authorization** | MutationIntent validation, approval gating, commit, history | not rendering | profile commit path only (`server/profile/store.ts:198-242`) |
| **Intelligent UI rendering** | block grammar, disclosure, diff/candidate editors | not data ownership | new (05), patterns in `ComputeRun`/`ProfileInit` |
| **Persistence & history** | durable state + append-only history | no silent overwrite | Postgres (`conversations/messages/files`), per-user JSON (profile/user), client-local (notes/artifacts/boards) |

## 3. Key seams (contract points)

1. **Invocation → Reference** (`src/lib/invoke.ts`, 02 §10): pure functions; UI-side.
2. **Reference/ContextSource → Retrieval**: binding set in, Retrieved Context out (03 §5).
3. **Model I/O contract**: extend `lib/ai.ts` request with `context` (bound entries) and the
   response with structured `Block[]` proposals — same shared-contract pattern as `lib/chat.ts`.
4. **Block → MutationIntent**: an approved block maps 1:1 to an intent (06 §2).
5. **Commit API**: domain-owned, idempotent, versioned (profile is the template).

## 4. Current implementation vs proposed vs future

| Concern | Current [I] | Proposed [P] | Future [Deferred] |
| --- | --- | --- | --- |
| Conversation surface | two surfaces: `/chat` + dock (4 block kinds) and the Overview intent input | merged Home Conversation (Overview input + chat unify, 2026-11-21 decision) + interaction blocks (05) | multi-coworker thread views |
| Invocation | none (`ContextBar` click picker) | `@`/`/` palettes + chips (02) | semantic/voice invocation |
| Retrieval | none ("retrieval is not implemented") | bound-context retrieval service | GSC-native ranking, embedding search |
| Execution | model completion only | proposal-producing operations (extract/summarize/revise) | tool execution via WAM |
| Governance | profile candidate→commit | shared MutationIntent across domains (06) | delegation grants, org policy |
| Persistence | mixed (server tables + client envelopes) | artifacts/GSC tables when domains mature | unified history index |

## 5. Compatibility constraints (do not break)

- Shared contracts live in `src/lib/*` and are imported by both sides (D-006). Extend, don't fork.
- Session → membership → write ordering for every new endpoint (`routes/conversations.ts:7-9`).
- Dual local/api envelope pattern for new client stores (`state/user.ts`, `state/chat.ts`).
- No modals (D-047); no fake controls; feedback at the action point.
- WAM owns agent runtime; Thylas stores handles and renders results (`WAM-BOUNDARY.md`).

## 6. Deliberately not designed here

- A message queue/agent scheduler ("do not assume every conceptual layer requires a separate service or agent").
- A new database architecture (03/04 give behavioral contracts only).
- A generic plugin/tool runtime (no tool execution exists; Deferred).
