# Chat — product & UI specification

Status: accepted in force (D-051). Companion to `AUDIT.md`.

## 1. Product definition

Chat is Thylas's contextual conversational interface. It answers questions and discusses
work **in the environment the work happens in**. It is not an agent runtime: no
orchestration, no scheduling, no compute management, no shared-context semantics. One
sentence governs it: **Chat should understand the workspace, not replace it.**

## 2. One system, two surfaces

`ChatCore` is the whole interaction (header, stream, composer). It renders in:

- **Independent** — route `/chat` (+ `/chat/:conversationId`): a conversations sidebar
  (the Notes page layout), a full reading column, the Composer pinned to the bottom.
- **Embedded** — `ChatDock`: an AppShell-level right panel beside any route, including
  every workspace room. Grip-resized (300–640px, persisted), independently scrolling,
  same active conversation, same store. Toggled from the tab strip and the palette; no
  separate navigation system.

State lives once, in `state/chat.ts` (`thylas:chat:v1`): conversations, messages,
context sources, active id, dock `{open, width}`. Presentation differs; nothing else does.

## 3. Message model — blocks, not strings

```ts
type Block =
  | { kind: 'text'; text: string; streaming?: boolean }        // markdown
  | { kind: 'artifact'; title: string; artifactKind: 'code' | 'note'; content: string;
      savedAs?: string }                                        // save-as-note is real
  | { kind: 'evidence'; name: string; sourceType: string; route?: string }  // what the user attached
  | { kind: 'status'; label: string; state: 'active' | 'done' | 'failed' };
type Message = { id, role: 'user' | 'assistant', at, blocks: Block[], error?: AiErr };
```

- **Text** renders through a small safe markdown renderer: headings, lists, tables,
  blockquotes, fenced code (language label + copy + **Save as note**, which writes a real
  note via the notes store), inline code, bold/italic, links (http(s) or in-app routes
  only). No HTML injection anywhere; math is out of scope and documented.
- **Evidence** appears under a *user* message: the materials that were actually attached.
  The assistant never fabricates citations — there is no retrieval in this build, and the
  composer says so.
- **Status** is used sparingly: "Stopped before completing." on a partial answer, nothing
  during ordinary generation.
- **Actions**: proposed/running action blocks are **not implemented** — there is no tool
  runtime. The type exists in the model; the UI does not fake one.

Message actions: hover-revealed Copy on every message; Regenerate on the last user
message (resends; the failed answer is removed). No toolbars under messages.

## 4. Composer (highest priority)

Multiline `<textarea>`, auto-height to ~9 lines then scroll. **Enter sends,
Shift+Enter newlines.** Empty sends do nothing. While generating, the send control
becomes **Stop** (aborts; partial text is kept with a "Stopped before completing"
status). Char count appears only past 6,000; the hard cap is the contract's 8,000.

Above the input, the **Context Bar**: chips for the conversation's context sources —
workspace (type: name), attached files/notes/boards, connected integrations (marked
"connected · retrieval not implemented"). Chips expand to a popover with per-source
remove; "+ Add context" opens a picker over *real* workspace materials; a workspace
picker sets the conversation's workspace source. Attached sources are what the user
message cites as evidence; nothing implies automatic access to everything.

**Model selector**: a compact control in the composer toolbar showing the server-pinned
model from `probe()`. Alternatives (deepseek-reasoner) render disabled with "pinned by
DEEPSEEK_MODEL on the server". If the probe fails, the control says "endpoint unknown"
and sending stays enabled (the request will report `network`).

**Toolbar**: Add context · Attach (same picker, lands as context + evidence) · Model ·
Send/Stop. No Web Search / Deep Research / Voice — the buttons would lie.

## 5. Streaming contract (new, sibling to D-006)

`POST /api/ai/stream` — body `{ prompt, history? }` (history = last turns, capped and
trimmed server-side). Response: SSE. Events: `{start,model}` → `{"delta":"…"}*` →
`{done,model,ms}` → `data: [DONE]`; failures arrive as `{error:{kind,message,retryable}}`
with the same seven kinds and HTTP statuses as `/api/ai`. Client abort closes the
upstream request. The key never reaches the client; `/api/ai` is unchanged.

Runtime states: idle → sending (user message placed, composer holds nothing back) →
generating (deltas append to one streaming text block; scroll follows only while the
reader is at the bottom) → done (footer line `model · dev endpoint · Ns`) or error
(message + next-step, retryable ones offer Regenerate). A mid-stream failure keeps the
partial text and marks the block failed — no fake completion.

## 6. MVP boundaries

Must-have list from the brief, minus what no infrastructure supports: artifacts save as
real notes (preview + copy + save); no upload, no tool execution, no branching, no
multi-model routing, no WAM. Conversations persist locally (last 20, newest kept);
"Clear conversation" clears messages of the active one with inline confirm; rename and
delete in the sidebar.

## 7. Known limitations

No retrieval (context is declared, not read); no memory beyond the trimmed history
window; no streaming on the Ask panel (unchanged, single-turn); markdown math unsupported;
attachments are workspace references, not uploads; the dock is one shared conversation —
opening it mid-conversation shows exactly what `/chat` shows.
