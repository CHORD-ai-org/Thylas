# Chat — repository audit

Written 2026-11-09, before implementation.

## 1. What exists and is reusable

**AI endpoint (SP-07a, D-006).** `POST /api/ai` mounted by Vite in dev *and* preview
(`server/ai.ts`), with `GET /api/ai/status` answering `{ configured, model }`. The key
lives server-side only (`DEEPSEEK_API_KEY` in `.env.local`); the client sees a typed body.
The wire contract lives in `src/lib/ai.ts`, imported by *both* sides, so a field change is
a compile error. Seven error kinds, each with an honest `retryable` flag. **Not
streaming** — the server sends `stream: false` and the doc says so on purpose.

**AI client (SP-07b).** `services/ai/client.ts`: `probe()` (disable-before-click) and
`ask()` (never throws; every failure is a value). Overview renders it as a one-turn Ask
panel with abort, stop, retry-by-kind. Its `AnswerText` renders prose + fenced code with
**no markdown engine and no HTML injection** — the house pattern.

**e2e.** The harness starts a local stub as `DEEPSEEK_BASE_URL` with a stub key; tests
steer it via `aiMode` (`ok | slow | ratelimit`). Any new endpoint must be stubbable the
same way.

**Shell.** `.work` is a flex column (`rail · work(surface·panel)`). `ContextPanel` shows
the house resize pattern: a `panelGrip` with pointer capture, width per context clamped to
280–480, persisted in `thylas:ui:v2`. Rail: global nav (Overview, Recently, Compute,
Connect) + library nav (Notes, User). Palette "Go" group.

**State conventions.** `useSyncExternalStore` + versioned localStorage envelopes
(`thylas:<domain>:v1`), validated on read, seeds untouched, session facts only.
**Markdown:** none anywhere; Notes are structured blocks, not markdown sources.

## 2. Missing capabilities

1. **Streaming** — must-have for Chat, absent by design in SP-07a. Plan: a *new* sibling
   endpoint `POST /api/ai/stream` (SSE) in the same middleware, same contract module,
   same key handling, same error kinds; `/api/ai` stays untouched so the Ask panel and
   existing tests keep working. DeepSeek is OpenAI-compatible (`stream: true`).
2. **Conversation state** — Overview's ask is one turn, nothing saved. Chat needs a
   conversation store (new domain envelope).
3. **Markdown rendering** — needs a small safe renderer (headings, lists, tables, code
   fences, inline marks, links). No new dependency; no `dangerouslySetInnerHTML`.
4. **Attachments/upload** — no upload service exists. Honest scope: "attach" means
   attaching *workspace materials that really exist* (files, notes, boards) as context
   sources; a real upload flow is future work.

## 3. Integration points

- **Context sources**: workspaces (`state/workspaces`), files/notes/boards (data +
  stores), connected integrations (`state/connect` — display-only, retrieval not
  implemented, and the UI says so).
- **Artifacts**: a fenced code block can be saved as a **real note** through
  `state/notes` — the one persistence the build can honestly perform.
- **Embedded surface**: a dock rendered by `AppShell` beside the Outlet, grip-resized
  like `ContextPanel` (wider clamp: 300–640), state persisted in the chat envelope.
  Available on every route — the workspace is where it will be used, not a special case.
- **Model selector**: `probe()` returns the server-pinned model; alternatives render
  disabled with the reason (`DEEPSEEK_MODEL`), because the server owns routing.
