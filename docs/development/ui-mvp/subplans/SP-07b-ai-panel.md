# SP-07b · Overview AI panel and its states

**Parent:** [SP-07](SP-07-ai-and-processes.md) · **Days:** 0.75 · **Status:** Not Started · **Depends:** SP-07a, SP-02

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

## Acceptance

1. With the stub endpoint: submit shows bars, then an answer with footer; `ms` matches the stub's delay ±20%.
2. Missing key: the send control is disabled with the env var named; no request is made.
3. Abort mid-flight leaves no answer and no error (state returns to idle).
4. Each of the six error kinds renders a distinct, actionable message; only `rate_limited`/`timeout`/`network` show retry.
5. The panel never says "running", "started", or "process" in a way that implies execution.

## Validation

e2e with `VITE_AI_MODE=stub`: happy path, abort, three error kinds; screenshots of all four states; copy review against the honesty rules.

## Risks

- Copy drift is the real risk: a helpful-sounding sentence can turn a completion into a promise. The five banned words are checked in review, not by a test.
- Long answers overflow the panel; scroll inside the panel only, never the page.
