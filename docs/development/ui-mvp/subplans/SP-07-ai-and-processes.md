# SP-07 · AI and processes

**Status:** Not Started · **Depends:** SP-03 · **Blocks:** SP-09
**Absorbs:** plan/07, and the AI path required by the brief §1.G.

**Units:** [SP-07a](SP-07a-ai-endpoint.md) — middleware, client, error taxonomy (1d) · [SP-07b](SP-07b-ai-panel.md) — Overview AI panel and states (0.75d) · [SP-07c](SP-07c-process-states.md) — process states, controls, simulator (0.75d).

## A. Objective

Give the product one honest AI capability — a question answered by DeepSeek through a server-side endpoint — and finish the process interface so delegated work can be inspected. No agent orchestration, no fabricated runs.

## B. Scope

**In:** `POST /api/ai` (Node middleware for dev and preview) calling DeepSeek chat completions; typed request/response; error taxonomy (no-key, 401, 429, timeout, network, bad-contract); an AI panel reachable from the Overview intent input; process list + run detail with five states, filters, capability-gated controls; a *simulated* run stepper for demonstration, clearly labelled.
**Out:** WAM, streaming (deferred), tool calling, multi-turn memory, artifact ingestion, retries of runs.

## C. Dependencies

SP-03, `services/http.ts` contract, `DEEPSEEK_API_KEY` availability (absent ⇒ honest disabled state).

## D. UX specification

- Overview: type a question → `Ask DeepSeek` (enabled only when the endpoint is configured). The answer appears in the right panel with a mono footer: `deepseek-chat · dev endpoint · 812 ms`. No claim that a process started.
- Failures are legible and typed: "not configured" (with the env var name), "rate limited, retry in 20 s", "timed out after 30 s", "network unreachable". Each has a retry where retry is meaningful.
- Processes: filters (all/running/needs you/done); run detail bands; controls appear only for capabilities the run exposes. A "simulate" control is labelled `simulate` and never pretends to be WAM.
- Empty/loading: three static bars, no spinner; a run with no events says so.

## E. Visual specification

AI answer: 16/26 at the panel's measure, code in mono 12/18. Footer 11/16 mono `--ink-3`. Error banner uses `grammar.banner` with `role="alert"`. Process states use the five words and tones from `selectors.ts`; never colour a whole row.

## F. Technical plan

- `server/ai.ts` — `createAiMiddleware()` for Vite: reads `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL` (default `https://api.deepseek.com`), `DEEPSEEK_MODEL` (default `deepseek-chat`); 30 s timeout; maps upstream errors to `{ kind, message, retryable }`; never logs the key; size-caps the prompt.
- `vite.config.ts` — `plugins: [react(), aiMiddleware()]`, applies in `dev` and `preview`.
- `src/services/ai/client.ts` — `ask(prompt): Promise<Answer>`; `services/ai/types.ts` for the wire shape; `map.ts` to a domain `Answer`.
- `src/pages/Overview.tsx` — replace the disabled reason with the real call; panel renders answer/error.
- `src/pages/Processes.tsx` — remove the last post-click apologies; disabled-with-reason where a service is missing; add the labelled simulator.
- Env: `.env.example` gains `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`; `.env.local` is gitignored.

## G. Implementation tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Middleware + error taxonomy | `curl -X POST /api/ai` returns typed JSON, no key leak |
| T2 | Client + types + mapper | UI never sees a raw upstream body |
| T3 | Overview ask flow + panel | One answer, footer shows model+latency |
| T4 | Error states + retry | 5 error kinds each render distinctly |
| T5 | Process states + controls | Capability rule holds; simulator labelled |
| T6 | Secret gate | `grep -r "DEEPSEEK" src` → only the client path string |

## H. Acceptance criteria

1. Key present: a question returns an answer; footer states model, endpoint kind, latency.
2. Key absent: the control is disabled with `DEEPSEEK_API_KEY` named; no request is made.
3. No key material appears in `dist/` (`grep -r "sk-" dist` → 0) or in any client bundle.
4. Upstream 429/timeout/network each map to a distinct message; retry only where `retryable`.
5. Process controls mirror capabilities; removing `pause` from mock removes the button.
6. A simulated run is labelled `simulate` in the UI and in code comments.

## I. Validation

`curl` against the middleware for each error branch (key unset, bad key, timeout via a local stub); e2e with `VITE_AI_MODE=stub` for the happy path; bundle grep for secrets; screenshots of answer + three errors.

## J. Risks and open questions

- **Network**: DeepSeek may be unreachable from this machine; then implement the stub and prove the path with it, recording that the live call is unverified (not "working").
- Dev middleware is not production. The same handler must be mounted by the eventual host; that is one file and a deployment decision (Q-2).
- Prompt size and cost: cap input at ~8k chars and say so in the UI.
