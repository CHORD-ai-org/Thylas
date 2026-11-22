# 00 — Existing system audit

**Date:** 2026-11-21 · **Status:** [I] audit of the current tree. Every claim cites a file.
Method: read-only repository inspection (product docs, `src/`, `server/`, `docs/`). No invented capabilities — anything absent is marked absent.

---

## 1. Home Conversation as shipped

| Item | Fact | Evidence |
| --- | --- | --- |
| Route | `/chat` and `/chat/:conversationId`, inside `AppShell` | `src/app/routerChildren.tsx:64-65` |
| Landing is **not** chat | index redirects to `landingPath(user)` → `/overview` (or `/recently`,`/notes`) | `routerChildren.tsx:44-52`, `src/state/user.ts:162-167` |
| Page | `ChatPage` = conversation sidebar + `ChatCore`; bad id redirects to `/chat` | `src/pages/chat/ChatPage.tsx:15-86` |
| Core | `ChatCore`: header + streaming turns + `Composer`; shared by page and dock | `src/pages/chat/ChatCore.tsx:62-240` |
| Dock | `ChatDock` right-side panel renders the same `ChatCore` ("no second chat system") | `src/pages/chat/ChatDock.tsx:13-53`, `src/shell/AppShell.tsx:25-34` |
| Composer | plain `<textarea>` (rows=1, auto-grow). Enter sends, Shift+Enter newline. `onChange` = `setText` only | `src/pages/chat/Composer.tsx:49-102` |
| Context attach | `+` popover `ContextBar`: click-select workspace / notes / files / boards / connected apps into `conversation.context` chips. Copy states "attached as evidence; retrieval is not implemented in this build" | `Composer.tsx:203-349` |
| Message blocks | 4 kinds: `text` (safe Markdown), `artifact` (code/note card — **no producer yet**), `evidence` (badge row), `status` (state line) | `src/lib/chat.ts:26-30`, `ChatCore.tsx:315-341` |
| In-message actions | Copy, Regenerate, CodeBlock "Save as note" (real note persistence), typed error + next-step copy | `ChatCore.tsx:269-309`, `CodeBlock.tsx:23-47` |
| State | localStorage envelope `thylas:chat:v1`; `VITE_CHAT_SOURCE=api` adds throttled (300ms) background `PUT /api/chat/state`; optimistic `expectedVersion` (409); client does not replay on conflict | `src/state/chat.ts:39-123,177-182`, `server/routes/chat.ts:161-204` |
| Model calls | `POST /api/ai/stream` OpenAI-format SSE passthrough (Anthropic re-framed). **No tool calls, no agent loop** | `src/services/ai/stream.ts:30-183`, `server/ai-handler.ts:271-426` |
| Adjacent non-chat home | `/overview`: single-shot Ask (non-streaming `/api/ai`) + Continue + Needs-you run queue + workspaces + recently | `src/pages/Overview.tsx:164-395` |

**Verdict:** Home Conversation today is split across two surfaces — a *chat transcript with
declarative context chips* (`/chat` + dock) and the Overview intent input. It is not yet a
unified interaction entry point. (Under the 2026-11-21 merge decision, 01 defines their
combined evolution.)

## 2. `@` invocation, resources, intelligent UI — current state

| Capability | State | Evidence |
| --- | --- | --- |
| `@` / mention / slash invocation | **Absent** in composer | `Composer.tsx:93-102` (no token parsing) |
| The one autocomplete in the repo | `[[wiki-link]]` completion in the notes editor (CodeMirror `autocompletion`, `matchBefore`, custom `apply`) — a **reusable trigger pattern** | `src/pages/notes/NoteEditor.tsx:28-50,131-135` |
| Command palette ⌘K | exists; navigation commands only, no content search | `src/shell/CommandPalette.tsx:11-81`, `src/state/app.tsx:270-271` |
| Object reference shape | `Reference {kind: 'file'|'note'|'board'|'process'; id; label}`; chat-side `ContextSource {id, kind: workspace|file|note|board|integration, name, detail}` | `src/data/types.ts:38-43`, `src/lib/chat.ts:18-24` |
| No `Resource` / `ExternalLink` / `ArtifactRef` types | the roles are split across `Reference`, `ContextSource`, `ExternalSource {system: notion|obsidian|github}` | `src/data/artifacts.ts:28` |
| Candidate-list UI | **two mature precedents**: ranked target recommendation (`ComputeRun`) and candidate review with accept/reject/edit (`ProfileInit`) | `src/pages/compute/ComputeRun.tsx:212-317`, `src/pages/user/ProfileInit.tsx:220-261`, `src/lib/profile.ts:44-77` |
| Diff / revision UI | nearest thing: Notes save-conflict "Keep mine / Load theirs / Show both" (whole-text compare); artifact `versions` list; plan revision flags | `src/pages/Notes.tsx:470-508`, `artifacts/ArtifactDetail.tsx:217-221`, `Processes.tsx:345-363` |
| Approval / inline confirm | `RunAction` buttons (`pause|resume|stop|answer|approve|rerun`) rendered per capability; **no modal by decision (D-047)** — confirm expands inline | `src/data/types.ts:123`, `src/pages/Processes.tsx:269-291`, `src/pages/compute/compute.module.css:636-659` |
| Component library | `Button, IconButton, Chip, StatusDot, Badge, Kbd, SectionLabel, EmptyState, Field, TypeGlyph…`; ~40 icons; **no generic Dialog/Popover component** (bespoke popovers) | `src/components/ui.tsx`, `src/components/icons.tsx` |
| Split surfaces | two panel primitives: `ChatDock` (conversation at side) and `ContextPanel` (object at side), both pointer-resizable | `ChatDock.tsx:18-29`, `src/shell/ContextPanel.tsx:8-63` |
| Tabs | `TabType` covers files/boards/processes + object details; **chat is not in the tab model** | `src/lib/tabs.ts:8`, `src/state/app.tsx:226-245` |

## 3. Backend, data, governance

| Item | Fact | Evidence |
| --- | --- | --- |
| Routes | `/api/ai`, `/api/ai/stream`, `/api/ai/status`, `/api/session`, `/api/user` (GET/PATCH displayName), `/api/profile/*` (7 endpoints), `/api/chat/state` (GET/PUT), `/api/conversations` CRUD, `/api/files` (5 endpoints) | `server/router.ts:34-68` |
| DB tables | `conversations`, `messages`, `files` only. `users`, `notes`, `artifacts`, `boards`, `processes`, `integrations` have **no tables** | `server/persistence/schema.ts:6-83`, migrations `0000`–`0002` |
| Identity | CHORD IdP; `SessionUser{id, workspaceIds}`; dev cookie fallback fails closed when `CHORD_ISSUER` set; authz order session→membership→write | `server/session/source.ts:3-49`, `src/lib/session.ts:1-11`, `server/routes/conversations.ts:7-9` |
| **Governance reference implementation** | Profile pipeline: source register → fetch (SSRF-hardened) → **LLM extraction** → `ProfileCandidate` (evidence, `informationType: explicit|inferred`, confidence) → review `pending/accepted/rejected/edited` → `/commit` (idempotent `recordKey` dedupe, **never silently overwrites confirmed records**) → append-only history | `server/profile/{fetch,extract,store}.ts`, `server/routes/profile.ts:109-193`, `src/lib/profile.ts:43-77` |
| AI | provider whitelist (deepseek/openai/anthropic/openrouter/kimi), streaming passthrough, **no tool calling / no agent loop**; `/api/ai*` have **no session check** | `server/config.ts:19,84-90`, `server/ai-handler.ts:12-13`, `server/router.ts:48-50` |
| Storage | flat per-workspace file dir; per-user JSON for user + profile; no ACL copy, no approval concept beyond profile commit | `server/storage/local.ts:6-49`, `server/user/store.ts:30-63` |

## 4. Design system constraints (binding on any UI this project adds)

- Interaction contract: state visible ≠ exists; one writer per state; feedback at the action point; **no fake controls** (real / disabled-with-reason / absent). `docs/design/interaction-contract.md`
- No modal dialogs except the command palette (D-047); confirmations expand inline.
- Quiet Computationalism visual direction (typography, spacing, restraint). `docs/design/visual-system.md`
- Keyboard: ⌘K palette, ⌘\ panel; no single-letter or browser-reserved bindings. `docs/design/interaction-model.md`

## 5. Reusable assets (do not rebuild)

1. **Profile candidate pipeline** (`server/profile/*` + `ProfileInit`) — the candidate → review → commit → history flow this brief needs for Artifacts.
2. **`Block` contract + safe Markdown renderer** (`lib/chat.ts`, `Markdown.tsx`) — structured message rendering, `artifact` block already reserved.
3. **`ContextSource` chips + `ContextBar`** — declarative binding UI (needs a real invocation + retrieval layer behind it).
4. **Panel primitives** (`ChatDock`, `ContextPanel`) — conversation↔object split views.
5. **Candidate/review UI patterns** (`ComputeRun`, `ProfileInit`) and **inline confirm** pattern.
6. **Dual local/api envelope pattern** (`state/user.ts`, `state/chat.ts`) — optimistic local-first persistence with a sync seam.
7. **`Reference` / `ExternalSource`** — existing object-reference vocabulary.

## 6. Missing capabilities (for Home Interaction)

1. `@` invocation (trigger, ranking, categorization, selection, chips) — absent.
2. Retrieval over bound context ("retrieval is not implemented in this build") — absent server-side; no RAG/GSC store.
3. Action invocation / operation requests from the composer — absent (⌘K navigates only).
4. Intelligent UI blocks beyond text/evidence/status — `artifact` block has no producer; no candidates, diffs, approval widgets **inside messages**.
5. Bidirectional structured editing (agent writes into a structured UI the user edits back) — absent; only the profile candidate PATCH is a 2-way structured edit, and it is not conversation-driven.
6. Artifact creation/evolution workflow (source → evidence → candidate → canonical) — product docs exist, **no code** (`docs/product/artifacts/README.md` marks implementation not started).
7. GSC — **manifesto only, zero code** (`docs/product/gsc/MANIFESTO.md`).
8. Mutation/commit authority model reusable across domains — only profile has one.
9. Tool calling / agent runtime — absent by boundary (WAM owns it).

## 7. Documentation to extend (not duplicate)

| Existing doc | Home-interaction doc builds on it |
| --- | --- |
| `docs/product/gsc/MANIFESTO.md` | 03 — must not rewrite terms |
| `docs/product/artifacts/{DEFINITION,TAXONOMY,GOVERNANCE,LIFECYCLE,CANONICAL-REUSE}.md` | 04 — preserve provenance/authority/versioning/governance |
| `docs/product/coworkers/{DEFINITION,WORKING-EXPERIENCE,ARTIFACT-RELATIONSHIP}.md` | 01, 08 |
| `docs/development/backend/PHASE-2-USER.md`, `DOMAIN-MODELS.md` | 03, 06 — profile/user domain already declared |
| `docs/design/interaction-contract.md`, `interaction-model.md` | 05, 07 — binding UI rules |
| `docs/development/chat/SPEC.md` | 01, 07 |

## 8. Conflicts and limitations to resolve (tracked in 09)

- Chat state PUT is whole-envelope replace; conflict is not replayed client-side.
- `/api/ai*` unauthenticated (consumes server key quota).
- Notes/artifacts/boards/coworkers are client-local; only conversations/messages/files are server-durable.
- `ContextSource.detail` strings currently assert things retrieval cannot back ("retrieval is not implemented").
- `artifact` block contract exists without a producer — must not be faked.
