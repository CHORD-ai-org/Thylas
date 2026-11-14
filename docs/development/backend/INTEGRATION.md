# Integration design — external systems and future boundaries

What exists, what the boundary will be, and the rules that keep Thylas from absorbing
responsibilities that belong to other systems (AGENT.md §2).

## 1. External model API  **[I]**

- One path to the model: `server/ai.ts` middleware → the provider the request
  resolved to.
  - `POST /api/ai` — completion, `stream:false`.
  - `POST /api/ai/stream` — SSE. **Byte-for-byte passthrough** of the
    provider's own stream for an OpenAI-compatible provider (D-051); Anthropic's
    event stream is re-framed into OpenAI SSE on the server (D-062), so the
    browser parses one shape whatever answered.
  - `GET /api/ai/status` — `{configured, model, default, providers}` probe.
- The provider is a whitelist, not a URL: the browser may name a provider and a
  model, never an endpoint (`server/ai/providers/catalog.ts`, D-061).
- Rules that hold for every provider:
  - the key stays in server env; the client asks a status endpoint, never holds
    secrets;
  - failures are classified into the shared `AiErrorKind` set at the middleware
    edge;
  - the model is an allowlist the operator writes (`*_MODELS`), and a request
    for anything else is a `contract` error;
  - the streaming pipe stays a pipe for OpenAI-compatible providers; only
    Anthropic is translated, and the translation lives in the server.
- Full details — variables, catalogue, provider differences, how to add one:
  [`AI-PROVIDERS.md`](AI-PROVIDERS.md).
- Bring-your-own-key is **not** implemented: it needs real authentication and a
  per-user secret store, which Thylas does not have yet (dev cookie stand-in,
  no database).

## 2. Storage  **[P]**

- Today: no server storage; client envelopes are the source of truth (see
  `DOMAIN-MODELS.md` §cross-cutting rule).
- When server persistence arrives (Joshō's conversations and artifacts need it):
  - a single `server/persistence/` module owns data access — one technology, chosen
    then, not now; the rest of the app talks to it through route modules;
  - client stores swap their `localStorage` backing for API calls behind the same
    validated interface; UI code does not change;
  - artifact versions are append-only; old versions are never mutated.
- Migration order is per-domain (chat first — it is the Joshō-critical surface), never
  a big-bang move.

## 3. WAM integration boundary  **[P]** — the hard line

- **WAM owns**: intent understanding, semantic context, shared context management,
  planning, scheduling, agent selection, execution workflows, task state and continuity.
- **Thylas owns**: the application environment — workspaces, resources, interaction
  surfaces, settings, presentation of WAM's outputs.
- Therefore, in Thylas code:
  1. WAM integration lives only in `server/wam/` (when it exists) and a
     `src/lib/wam.ts` wire contract — never scattered.
  2. Thylas does not re-implement planning, context semantics, or orchestration; a
     surface that needs WAM data renders what WAM reports, labelled as WAM's answer.
  3. No WAM types leak into domain models: an `Artifact` does not carry WAM internals;
     the integration layer maps between the two worlds.
  4. Until a concrete WAM API exists, `server/wam/` stays empty and this boundary stays
     prose. A designed-but-unbuilt abstraction is still premature abstraction.
- Joshō's Chat Context UI is explicitly **not** the WAM Shared Context: the context bar
  declares sources the user picked; it does not implement semantic source mapping.

## 4. Coworker communication boundary (A2A)  **[P]**

- Each Coworker connects to WAM independently; coworker-to-coworker messages run over a
  separate A2A protocol that WAM owns.
- Thylas's responsibility ends at: storing the Coworker record + connection handle,
  rendering conversation and artifact surfaces, and persisting what the protocol
  delivers.
- Thylas does not route, interpret, or broker A2A traffic. If a relay is ever needed
  for transport reasons, it is transport-only (no semantics) and gets its own dated
  decision.

## 5. Compute execution  **[P]**

- Compute v2 is client-side truth with honest simulation. A real executor attaches at
  the boundaries already named in `compute-v2/MOCKED-AND-FUTURE.md` (execution clients,
  provisioning, telemetry) and moves the truth server-side without changing the IA or
  the honesty rules.

## 6. What never becomes an integration

- Knock (developer community) — belongs to the ecosystem, not to Thylas.
- Model capability research (Rym) — ownership undecided at the CHORD level; Thylas
  only consumes whatever serves it through the model API boundary above.
