# SP-07a · AI middleware, client, error taxonomy

**Parent:** [SP-07](SP-07-ai-and-processes.md) · **Days:** 1.0 · **Status:** Completed 11-08 · **Depends:** SP-03b

## Objective

One server-side path to DeepSeek, with a typed contract, a key that never reaches the browser, and failures a person can act on.

## Scope

**In:** `server/ai.ts` middleware mounted by Vite in dev and preview; `POST /api/ai`; env (`DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`); client `services/ai/{client,types,map}.ts`; error taxonomy; `.env.example`; secret gate script.
**Out:** streaming, tool calling, conversation history, prompt library, an AI surface (SP-07b).

## UX

No UI. The contract it must satisfy: a missing key is a *configuration* error, not a network error, and it is distinguishable in the response.

## Visual

Not applicable.

## Technical plan

```ts
type AiRequest = { prompt: string };
type AiOk = { ok: true; text: string; model: string; ms: number };
type AiErr = { ok: false; kind: 'not_configured' | 'unauthorized' | 'rate_limited' | 'timeout' | 'network' | 'upstream' | 'contract'; message: string; retryable: boolean };
```

- Middleware: 8k-char input cap, 30s timeout via `AbortSignal.timeout`, maps upstream status to `kind`, never logs the key, returns 4xx/5xx with JSON.
- Base URL default `https://api.deepseek.com`, endpoint `/chat/completions`, model default `deepseek-chat`.
- Client: `ask(prompt)` → parses with the same shape; a non-conforming body becomes `kind: 'contract'`.
- `scripts/gates.mjs` (SP-09a) gains a rule: no `sk-` in `dist/`, no `DEEPSEEK_API_KEY` in `src/`.

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Middleware + plugin wiring | `curl` works in dev and preview |
| T2 | Error mapping | 6 kinds, table in code comments |
| T3 | Client + types + mapper | UI never sees a raw body |
| T4 | Timeout + input cap | Long input refused with a message |
| T5 | `.env.example` + gitignore | Key never committed |

## Result

| # | Task | Result |
| --- | --- | --- |
| T1 | Middleware + plugin wiring | done — `server/ai.ts` mounted by `configureServer` **and** `configurePreviewServer`; both proven over HTTP, not just in dev |
| T2 | Error mapping | done — seven kinds in `src/lib/ai.ts`; the upstream status → kind table lives in `handleAiRequest` |
| T3 | Client + types + mapper | done — `services/ai/{types,map,client}.ts`; `toAnswer` refuses anything that is not the contract, so no raw body reaches a component |
| T4 | Timeout + input cap | done — 30 s via `AbortSignal.timeout`, 8000 characters, plus a 64 KB wire cap that fires before the character check |
| T5 | `.env.example` + gitignore | done — `.env`, `.env.local`, `.env.*.local` are ignored; the example names every variable and says why none is `VITE_`-prefixed |

**Beyond scope, present:** `GET /api/ai` answers 405 instead of 404; the upstream error text is echoed back scrubbed of the key, so a person can read what DeepSeek actually said; `scripts/ai-checks.mjs` (`npm run ai`, 35 assertions) drives a stub upstream through every branch with no key and no network.

**Deviations:** (1) The kind list is seven, not six: the spec prose counted `not_configured` outside the upstream failures, but it is a distinct `kind` in the type and gets its own status. (2) `DEEPSEEK_TIMEOUT_MS` exists so the timeout branch costs 1.5 s in the check rather than 30 (D-038). (3) Failures the *endpoint* detects return gateway statuses, never 4xx (D-037).

**Not verified:** a live completion from DeepSeek. This machine has no key, so the contract is proven against a stub and the live call is recorded as **unverified** — not as working.

## Acceptance

1. With a key: `curl -X POST /api/ai -d '{"prompt":"hi"}'` returns `{ok:true,text,model,ms}`. — met against a stub upstream: 200, `text: "Stub answer."`, `model: "deepseek-chat"`, a numeric `ms`.
2. Without a key: `{ok:false,kind:'not_configured'}` and HTTP 503; no upstream call is attempted. — met; the stub recorded zero hits while the keyless server was up, and the message names `DEEPSEEK_API_KEY`.
3. Bad key: `kind:'unauthorized'`, `retryable:false`. — met (stub 401), HTTP 502.
4. 31st second: `kind:'timeout'`, `retryable:true`. — met at the configured bound: the check runs it at 1.5 s and measures ~1.5 s, returning 504; the default is 30 s.
5. `grep -r "sk-" dist` → 0; `grep -rn DEEPSEEK src` → only the client's `/api/ai` path string. — met: a key-shaped string appears in neither `src/` nor `dist/`, and no source file in `src/` mentions the variable at all — the message that names it is built on the server.
6. Input over 8k chars: `kind:'contract'` with the limit stated. — met: `The prompt is 8001 characters; the limit is 8000.`

## Validation

`npm run ai` — 35 assertions over HTTP against two real dev servers and one real preview server, with a stub upstream answering 200 / 401 / 429 / 500 / garbage / never. Unit tests: `src/lib/ai.test.ts` (completion parsing, the shape guard, the status table), `src/services/ai/map.test.ts` (a raw body never becomes an answer). Bundle grep for a key-shaped string in `src/` and `dist/`.

## Risks

- **Network**: DeepSeek may be unreachable from this machine (Google Fonts and jsDelivr are). If so, the stub proves the contract and the live call is recorded as *unverified*, not "working".
- Dev middleware is not production; the same handler must be mounted elsewhere later (Q-2, D-006).
- Prompt injection is out of scope for a single-turn completion, but the input cap and the absence of tools keep the blast radius small.
