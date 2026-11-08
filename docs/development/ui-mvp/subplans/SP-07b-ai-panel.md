# SP-07b · Overview AI panel and its states

**Parent:** [SP-07](SP-07-ai-and-processes.md) · **Days:** 0.75 · **Status:** Completed 11-08 · **Depends:** SP-07a, SP-02

## Objective

Turn the Overview intent input into a real, single-turn AI surface — and make sure that what it does is unmistakable: it answers a question, it does not start work.

## Scope

**In:** submit → panel states (idle, sending, answer, error); footer `model · endpoint kind · latency`; retry when `retryable`; input cap message; keyboard (`⌘↵` submits, `esc` clears); panel scroll for long answers.
**Out:** streaming, multi-turn, history persistence, prompt templates, claims about running processes.

## UX

Parent §D. Detail:

- Before submit the panel says what this is: "Answers one question with DeepSeek. It does not start a process."
- While sending: three static bars, input disabled, send button shows `Stop` only if a request can be aborted (it can — `AbortController`).
- Answer: plain text in 16/26, code in mono; footer states model, `dev endpoint`, milliseconds.
- Errors map 1:1 to the taxonomy: not configured names `DEEPSEEK_API_KEY`; rate limited states retry-after; timeout offers retry; contract errors say "unexpected response shape".
- The answer is not persisted (nothing to persist yet); leaving the page discards it.

## Visual

Panel content in `--t-read`; footer `--t-mono-s` `--ink-3`; error uses `grammar.banner` with `role="alert"`. No accent except the send button; no avatar, no chat bubbles.

## Technical plan

- `src/pages/Overview.tsx`: local state `{ status: 'idle'|'sending'|'done'|'error', answer?, error? }`; `AbortController` for cancel.
- Panel renders via `ContextPanel` (workspace layout already supports `panel`); on Overview use a right-hand region that only exists when a question is asked.
- `services/ai/client.ts` returns the discriminated union from SP-07a; the component switches on `kind`, never on message text.

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Submit flow + abort | `⌘↵` asks, `esc`/Stop cancels |
| T2 | Four states | idle/sending/answer/error all drawn |
| T3 | Footer meta | model, dev endpoint, ms |
| T4 | Error → action | retry only when retryable |
| T5 | Input rules | 8k cap message, disabled send when empty |

## Result

| # | Task | Result |
| --- | --- | --- |
| T1 | Submit flow + abort | done — `⌘↵` (and `Ctrl+↵`) asks, `Stop` and `esc` abort; the late return of an aborted request is ignored so it cannot overwrite the idle state |
| T2 | Four states | done — idle, three static bars, answer, error; no spinner anywhere |
| T3 | Footer meta | done — `deepseek-chat · dev endpoint · 384 ms`, mono, tabular, above a hairline that ends the answer |
| T4 | Error → action | done — the message comes from the server, the next step from a `/kind/` table in the page; `Ask again` appears only when `retryable` |
| T5 | Input rules | done — empty disables send, 8001 characters states the limit and disables it, the client refuses before the round trip |

**Beyond scope, present:** `GET /api/ai/status` and `probe()` (D-039), a `focus`/typing trigger for the panel, fenced-code rendering in mono, panel width kept in its own context (`ask`, 360px) so dragging it does not resize the workspace panel.

**Deviations:** (1) The panel exists once the field is *used* (clicked or typed into), not only after a question is submitted — the spec wants the idle explanation visible before the first ask, and an always-present panel would put 360px of empty column on every visit. (2) Retry follows the contract's `retryable` field, so an `upstream` 5xx also offers `Ask again`; the spec's list named three kinds, the field knows better than a hard-coded list. (3) The check runs a stub *upstream* behind the real middleware instead of a `VITE_AI_MODE` branch inside it — the surface is then tested against the code that ships, with no test-only path in `src/`.

**Not verified:** a live answer from DeepSeek. The stub proves the surface, the middleware and the error taxonomy; it does not prove the model.

## Acceptance

1. With the stub endpoint: submit shows bars, then an answer with footer; `ms` matches the stub's delay ±20%. — met: 384 ms against a 350 ms stub (+10 %), and the check asserts the value sits between 250 and 2000 rather than being a constant.
2. Missing key: the send control is disabled with the env var named; no request is made. — met twice over: the control is disabled and the reason names `DEEPSEEK_API_KEY` (e2e, second server with an empty key), and the endpoint refuses without calling upstream (ai-checks, stub hit count 0).
3. Abort mid-flight leaves no answer and no error (state returns to idle). — met: after `Stop` the panel has an idle block and neither an answer nor a `role="alert"`.
4. Each of the six error kinds renders a distinct, actionable message; only `rate_limited`/`timeout`/`network` show retry. — met by construction: `NEXT_STEP` is a `Record<AiErr['kind'], string>`, so a new kind does not compile until it has a sentence; `rate_limited` is exercised end to end, the rest carry the server's typed message. Retry follows `retryable` (see deviation 2).
5. The panel never says "running", "started", or "process" in a way that implies execution. — met: the panel text is asserted against `\b(started|is running|process is)\b` and returns false, with the idle copy saying "It does not start a process".

## Validation

`npm run e2e` — fifteen new assertions on the AI surface: panel absent, opened by a real click, idle copy, disabled send, bars, answer, mono code, footer shape and value, no execution claim, Stop, esc, rate-limit banner with retry, the 8000-character refusal, and a second dev server with no key. `npm test` — `probe()` cases, including that an unreachable endpoint returns `null` and therefore leaves the control enabled. Screenshots in `.workbuddy/shots/sp07b-{idle,sending,answer,error}.png`.

## Risks

- Copy drift is the real risk: a helpful-sounding sentence can turn a completion into a promise. The five banned words are checked in review, not by a test.
- Long answers overflow the panel; scroll inside the panel only, never the page.
