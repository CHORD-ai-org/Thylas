# Backend architecture — overview

Status: accepted in force (D-052). Companion to `AUDIT.md`.

## 1. The one-sentence architecture

Thylas's backend is a **thin application server**: it holds secrets, talks to external
model APIs, and (as the product grows) persists application-domain data. It is not an
agent framework — that is WAM's job — and it never re-implements WAM internals.

## 2. Target directory structure

What exists today is kept; what is listed is the **agreed home** for future work, not
scaffolding to create now. Directories appear only when the first real file lands.

```
server/                     # the backend (Vite middleware today, standalone host later)
  ai.ts                     # EXISTS — model API middleware (/api/ai, /api/ai/stream, /api/ai/status)
  config.ts                 # FIRST EXTRACTION (implemented): env reading + typed config, one reader
  README.md                 # EXISTS — what belongs here, what never does
  # Future — each directory appears with its first real module, never empty:
  #   persistence/           # data access for conversations, artifacts, history
  #   routes/                # one module per API surface (chat.ts, artifacts.ts, …)
  #   wam/                   # the ONLY place WAM integration code may live
src/lib/                    # EXISTS — wire contracts shared by server and client
  ai.ts                     # the pattern to copy: types both sides import
src/state/                  # EXISTS — client-side stores; the read()/validate() pattern
docs/development/backend/   # EXISTS — this documentation set
```

Rules:

1. A `server/routes/<domain>.ts` module is created when its API surface gets its second
   endpoint, not when someone predicts it.
2. `server/wam/` is created **only** when a concrete WAM integration exists. Until then
   WAM appears in this documentation as a boundary, never as code.
3. `src/lib/` stays the single home of wire contracts. Server modules import the
   contract; they never define ad-hoc response shapes.
4. No `utils/`, no `helpers/`, no `common/`. Shared logic gets a named module.

## 3. Module responsibilities

| Module | Owns | Never does |
| --- | --- | --- |
| `server/ai.ts` | model API calls, key handling, error classification, SSE passthrough | persistence, prompt policy, WAM |
| `server/config.ts` | reading and typing env vars once per process | anything else |
| `src/lib/*.ts` (contracts) | wire shapes shared server/client | server or client logic |
| `src/state/*.ts` (client stores) | client-side session state, envelope validation | server truth |
| future `server/persistence/` | durable truth for conversations, artifacts, history | rendering decisions |
| future `server/routes/<domain>.ts` | HTTP surface for one domain | domain logic of other routes |
| future `server/wam/` | talking to WAM | re-implementing WAM's planning/context/orchestration |

## 4. Dependency direction

```
client (src/pages, src/state, src/services)
   →  src/lib/<contract>   ←  server (server/*.ts)
```

- The client never imports from `server/`; the server imports only its contracts from
  `src/lib/` plus node built-ins. One shared contract file per surface.
- Domain logic flows one way: UI intent → client store → API call → server → external
  service. The server never calls back into the client except through responses.
- When server persistence arrives, `src/state/*` stores keep their envelope shapes and
  swap their `localStorage` backing for API calls behind the same `read()`/validation
  interface — UI code does not change.

## 5. Data flow (implemented today)

1. `Ask` (Overview): intent input → `POST /api/ai` → middleware reads env → DeepSeek
   `stream:false` → typed `AiOk`/`AiErr` → panel states (idle/sending/done/error).
2. `Chat`: composer → `POST /api/ai/stream` (`{prompt, history}`) → middleware validates
   and calls DeepSeek `stream:true` → **byte-for-byte SSE passthrough** → client parses
   OpenAI chunks → chat store appends blocks → conversation envelope persists.
3. `Status`: `GET /api/ai/status` answers `{configured, model}` without touching the key.

## 6. API boundaries

- Every endpoint validates its body against the shared contract (sizes, kinds, history
  caps) **server-side**, regardless of client-side checks.
- Failures are typed (`AiErrorKind`), carry a reader-facing `message` and an honest
  `retryable`; HTTP status comes from `statusFor()` (only `contract` is 4xx).
- New endpoints follow the same trio: `POST <path>`, `GET <path>/status` where a probe
  makes sense, and a contract module in `src/lib/`.
