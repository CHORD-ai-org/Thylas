# SP-07a · AI middleware, client, error taxonomy

**Parent:** [SP-07](SP-07-ai-and-processes.md) · **Days:** 1.0 · **Status:** Not Started · **Depends:** SP-03b

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

## Acceptance

1. With a key: `curl -X POST /api/ai -d '{"prompt":"hi"}'` returns `{ok:true,text,model,ms}`.
2. Without a key: `{ok:false,kind:'not_configured'}` and HTTP 503; no upstream call is attempted.
3. Bad key: `kind:'unauthorized'`, `retryable:false`.
4. 31st second: `kind:'timeout'`, `retryable:true`.
5. `grep -r "sk-" dist` → 0; `grep -rn DEEPSEEK src` → only the client's `/api/ai` path string.
6. Input over 8k chars: `kind:'contract'` with the limit stated.

## Validation

`curl` for each branch (unset key, bad key, stubbed 429, stubbed timeout); a stub server for 429/timeout so the test needs no real key; bundle grep.

## Risks

- **Network**: DeepSeek may be unreachable from this machine (Google Fonts and jsDelivr are). If so, the stub proves the contract and the live call is recorded as *unverified*, not "working".
- Dev middleware is not production; the same handler must be mounted elsewhere later (Q-2, D-006).
- Prompt injection is out of scope for a single-turn completion, but the input cap and the absence of tools keep the blast radius small.
