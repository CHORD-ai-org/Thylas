# Engineering standards — backend

The standards the existing code already follows; new backend work inherits them by
default. Deviations require a dated decision in `docs/development/ui-mvp/DECISIONS.md`.

## 1. Naming

- Files `kebab-case.ts`; exports PascalCase for types/components, camelCase for
  functions; store modules export `use<Domain>()` + verb-named actions
  (`appendDelta`, `disconnectInstance`).
- Domain keys: `thylas:<domain>:v<version>`; route builders live in `src/lib/routes.ts`
  and are the only place a URL string exists.

## 2. Types and schemas

- **Contracts in shared modules**: every wire shape lives in `src/lib/<domain>.ts`,
  imported by both the server handler and the client — a field change is a compile
  error on the other side (D-006 pattern).
- **Validation at the boundary**: every persisted envelope has a validating `read()`
  that drops malformed entries instead of crashing; sizes and caps are re-checked
  server-side even when the client also checks.
- No schema DSL, no codegen. TS types + small shape-check functions (`isAiBody`,
  `isAiHistory`) are the schema. If a real DB arrives, migrations become the schema of
  record and the contract module maps to it — the client never learns SQL.

## 3. Error handling

- Typed failure values (`AiErr` shape: kind / message / retryable), never thrown
  across the client boundary; seven kinds, each answering "what should the reader do".
- Server: pre-stream failures are JSON with `statusFor(kind)` (only `contract` is 4xx);
  mid-stream failures surface as whatever the stream protocol allows.
- `retryable` must be honest: a retry only helps when a second attempt can end
  differently.

## 4. Logging

- The key (and any secret) is scrubbed from every log line (`scrub()` in `server/ai.ts`).
- Log decisions and observable operations, not dumps. Client state changes that matter
  are recorded in their domain store's log (see `state/compute.ts`, `state/connect.ts`).
- No telemetry exists; if one arrives it follows the opt-out pattern OpenResearch uses —
  coarse, opt-out, never content.

## 5. Testing

- Pure logic in `src/lib` and `src/data` gets unit tests (Vitest) — ranking, filtering,
  validation, tombstones.
- Stores get state tests: **hand-edited payloads, version mismatches, caps, reloads** —
  the ways state actually breaks.
- Server handlers get level-1 integration tests over real HTTP (see
  `stream.integration.test.ts`) — start a stub upstream, assert the bytes.
- UI gets `scripts/ui-checks.mjs` (CDP e2e) with a local stub for every external
  dependency; failure states are deterministic (`unreachable.host` never answers), never
  random.
- Every feature ships with its tests; `npm run e2e` must be green before a feature is
  called done.

## 6. Configuration and secrets

- Server config is read once per process in `server/config.ts` (typed); overrides from
  `.env` files lose to real shell env vars (test determinism).
- Secrets only ever in `.env.local` / server env — never in client code, never in a
  log, never in a URL. The `/status` endpoint answers `configured: true|false` and
  nothing more about a key.
- Client code that needs "is this possible" asks a status endpoint; it does not infer.

## 7. Simulation honesty

Prototype behavior is labelled in the UI where it happens, and every simulated fact is
listed in the feature's `MOCKED-AND-FUTURE.md`. A prototype that fails at random or
reports success it did not earn is a defect, not a shortcut.

## 8. Documentation

- Each feature directory: `AUDIT.md` (facts before work) → `SPEC.md` (product + UI,
  with boundaries and known limitations) → `MOCKED-AND-FUTURE.md` (simulated vs real vs
  backend-required).
- Cross-feature decisions get dated entries (`D-0xx`) in `docs/development/ui-mvp/
  DECISIONS.md`; superseded docs get a header note, never silent deletion.
