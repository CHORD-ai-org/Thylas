# Thylas — Technology Stack & Architecture

**Status:** proposed, for founder review. No dependency installed, no source changed.
**Date:** 2026-11-07
**Supersedes:** `docs/architecture/application.md` where the two disagree. That document stays as the pre-implementation proposal; this one is grounded in what was actually built (`src/`, 41 files, commit `cf01df0`) and in versions verified against the registry today.
**Reading order:** §1 summary → §5 stack → §6–§9 architecture → §11 roadmap. §3–§4 are the evaluation; skip if you trust the verdicts.

---

## 1. Executive summary

Thylas is a **single-page, authenticated workspace** with a handful of resource surfaces, one rich-text editor, one structured canvas, and a live view of work that another system executes. Almost every technical decision follows from three facts:

1. **There is no public surface.** Every screen is behind sign-in. SSR, RSC and SEO buy nothing and add a second authorisation path.
2. **The location is the product.** Tabs, panels and workspaces are spatial, so the URL must be the single truth for "where am I" and the tab strip must be a persisted *view* of that truth, not a second router.
3. **Thylas does not execute anything.** WAM plans and runs; Thylas sends commands, subscribes to events, and files the results. That boundary is enforced by module structure, not by convention.

### The stack in one table

| Layer | Selected | Class | One-line reason |
| --- | --- | --- | --- |
| Language | TypeScript 5.9, `strict` | **Core** | Route params, ids, WAM DTOs are all typed surfaces |
| UI | React 19.3 | **Core** | Installed, stable; the ecosystem for editor + canvas is here |
| Build | Vite (6.4 now → 8 after MVP) | **Core** | Dev server + HMR on a canvas-heavy app; no server runtime |
| Router | `react-router` 8 (`react-router/dom` for `RouterProvider`) | **Core** | Data router, nested layouts, `errorElement`; replaces `react-router-dom` 7 |
| Styling | CSS Modules + token files | **Core** | One numeric scale; Tailwind would add a second |
| Primitives | Hand-built; React Aria only when overlays land | **Conditional** | Behaviour without a second visual identity |
| Server state | TanStack Query 5 | **Conditional** (on first endpoint) | Caching/retry/refetch are exactly the run-state problem |
| Client state | React context + `useState`; Zustand only if measured | **Core** (as built) | Three small stores' worth of state does not justify a library |
| Editor | Tiptap 3 | **Conditional** (notes milestone) | Schema + reference nodes; ProseMirror underneath |
| Canvas | Custom DOM + SVG | **Core** (as built) | Structured board, not freehand; visual control is the product |
| Validation | Zod 4 at the HTTP boundary | **Conditional** | Never trust WAM's wire shape |
| Testing | Vitest 5 + Testing Library + Playwright; MSW when a server exists | **Core** for the first two | The tab model is pure logic and must be tested first |
| BFF | None; a ~300-line proxy only if N5 requires it | **Conditional** | The browser may be able to hold the user's identity |

**Explicitly rejected:** Next.js, Tailwind, tldraw, Excalidraw, Redux, a plugin system, micro-frontends, a design-system package, i18n framework (v1), Sentry (until a DSN owner exists).

### The five decisions that matter

| # | Decision | Why it is consequential |
| --- | --- | --- |
| D1 | SPA on Vite; no SSR/RSC | Removes a second auth path and a server runtime; costs first-paint bundle |
| D2 | URL is location; tabs are a persisted view with one writer | Every navigation bug in this class of app comes from two sources of truth |
| D3 | No global store; three state categories with different homes | Prevents the "everything in one store" refactor that never ends |
| D4 | WAM contract: commands in, events out, artifacts through one ingestion point | Keeps Thylas from becoming a scheduler; makes provenance mandatory |
| D5 | Identity is forwarded per request; authorisation is enforced by the resource owner | A hidden button is not a boundary |

---

## 2. Product and technical requirements

Classification: **MVP** = must exist for the first release; **Next** = the following milestone; **Later** = designed for, not built.

| Capability | What the product needs | Technical behaviour | When | Depends on | Consequential risk |
| --- | --- | --- | --- | --- | --- |
| App shell | Persistent rail, content, panel; nothing reflows on navigation | Nested layouts, one scroll owner per region, no global scroll | MVP | Router | Layout regressions when a zone changes width |
| Multi-tab | Rooms pinned, objects closable, per-context sets, survive reload | URL = active tab; ordered set persisted per user+workspace; one writer | MVP | Router + storage | Restoration after deletions/renames |
| Workspace switching | Same room in the new scope; no object leaks | Context-scoped state keyed by workspace id | MVP | Router + tabs | Cross-scope data leak if keys are not scoped |
| Panels | One per surface, resizable, collapsible, never a second panel | Route supplies content; width persisted per app | MVP | Shell | Layout shift while resizing |
| Files | Tree, table, preview, selection, upload | Signed upload; metadata CRUD; preview by mime | MVP (metadata) | Storage (N3/N4) | Upload path and folder ownership unknown |
| Notes | Read, write, reference other objects | Block editor, autosave, 409 conflict, dirty-tab guard | Next | Editor + persistence | Silent data loss; save ordering |
| Whiteboard | Structured cards, sections, labelled edges, live cards | Pan/zoom, hit-testing, selection, read-only bindings | MVP read-only; Next editing | Canvas + persistence | Frame budget at 60 cards; undo semantics |
| Processes | List, filters, run detail, mirrored controls | Submit; subscribe; render capabilities; never retry locally | Next | WAM (N1/N2) | No event stream ⇒ refresh button product |
| Artifacts | Results land in the workspace with provenance | One ingestion surface; Thylas assigns id/scope/placement | Next | WAM + resources | WAM writing tables directly (B2) |
| Account | Profile, plan, usage, keys, preferences | Read provider/metering values; never compute quota | MVP (thin) | Metering, keys | Display drifting into enforcement (B3) |
| Organisations | Members, roles, membership-gated UI | Server-returned flags; re-check at execution | Later | Authz service (N2) | J8 unusable on first contact |
| Search | Command palette; lexical search over own content | Client index for names/text; semantic search is a WAM call | MVP (palette); Next (lexical) | Storage | Making search a destination |
| Keyboard | Reach everything; `⌘K`, `⌘\`, `esc`, table arrows | One escape stack; roving tabindex in the rail | MVP | Shell | Shortcut collisions |

**Non-requirements, stated so they can be refused:** SSR, public pages, mobile shell, offline editing, real-time collaboration, plugin execution, tenant isolation beyond CHORD's own services, analytics dashboards.

---

## 3. Candidate evaluation

Versions verified against the npm registry on 2026-11-07; installed versions from `npm ls`.

### 3.1 Frontend foundation

| Candidate | Version | Fit | Verdict |
| --- | --- | --- | --- |
| **React** | 19.3.1 installed | Editor and canvas ecosystem, team familiarity, concurrent rendering | **Selected** |
| Vue | 3.x | Excellent SPA ergonomics; weaker editor/canvas ecosystem for this specific shape | Rejected |
| Svelte | 5 | Smallest runtime; would discard the existing 41-file implementation and its contracts | Rejected |
| Solid | 1.x | Fast, but no advantage here; ecosystem risk | Rejected |

The choice is not a bet: the application exists. Re-platforming would cost the UI MVP without changing any requirement in §2.

### 3.2 Build and rendering

| Candidate | Version | Fit | Verdict |
| --- | --- | --- | --- |
| **Vite** | 8.3.6 latest; **6.4.5 installed** | SPA, instant HMR, static output, no server runtime | **Selected**; upgrade to 8 is a separate spike (§11 T1b) |
| Next.js | 16.x | SSR/RSC/route handlers — all three are liability here: no public surface, a second auth path, and 70% of the tree would be `'use client'` | Rejected |
| Remix / React Router framework mode | 8.x | Same server model as Next without the market; adds a server we do not need | Rejected |
| Astro | 5.x | Content sites; the app is interaction | Rejected |

**Vite 8 costs, measured not assumed:** requires Node ^20.19 or ≥22.12 (this machine: 22.22.2 ✓) and pairs with `@vitejs/plugin-react` 6.x, whose peer list includes an oxc transform. That is a build-toolchain change, not a version bump; hence "after MVP".

### 3.3 Language

**TypeScript, selected**, with two caveats found today:

- Installed `5.7.3`; latest 5.x is `5.9.3`. Upgrade to 5.9 now (low risk, dev-only).
- `typescript@7.0.2` is `latest` (native compiler). **Not adopted yet**: it is a compiler change with ecosystem lag, and this project's value is not type-check speed at 41 files. Revisit when the app exceeds ~200 files.

### 3.4 Styling

| Candidate | Fit | Verdict |
| --- | --- | --- |
| **CSS Modules + token files** | One numeric scale, scoped classes, zero runtime, tokens are the contract (`design/tokens.css`, `src/styles/typography.css`) | **Selected** (already built) |
| Tailwind 4 | Fast to write, but installs a second scale beside the tokens; the audit already found drift when two scales exist | Rejected |
| Vanilla Extract | Type-safe tokens, zero runtime, good for a large design system; adds a build step and a second authoring model for a 41-file app | Deferred (revisit at a design-system package) |
| CSS-in-JS (styled-components/emotion) | Runtime cost, serialisation, and a third way to express a token | Rejected |

### 3.5 UI primitives

The requirement is *behaviour* without *appearance*: focus traps, popover positioning, menu keyboard model, `aria-*` correctness.

| Candidate | Version | Fit | Verdict |
| --- | --- | --- | --- |
| **Hand-built primitives** | — | 8 components, 1 icon set, no third-party CSS; the app already passes its interaction suite | **Selected for now** |
| React Aria (hooks / components) | 1.22.1 | Best accessibility model; unstyled; hooks compose with CSS Modules | **Conditional** — adopt for menu, dialog, combobox, tooltip when they land |
| Radix UI | 1.3.x | Unstyled and popular; ships its own animation/data-state conventions; two primitive systems would be one too many | Rejected while React Aria is the candidate |
| Base UI | 1.0.0-rc | Promising, still RC | Rejected (not on a release candidate for a product surface) |
| shadcn/ui, MUI, Ant | — | Pre-designed; fights the visual contract | Rejected |

Rule: **one primitive system.** If React Aria is adopted in T4, the hand-built `Popover`/`Tooltip` are deleted, not kept alongside.

### 3.6 Routing

| Candidate | Version | Fit | Verdict |
| --- | --- | --- | --- |
| **`react-router` 8** | 8.5.1 | Data router (`createBrowserRouter`), nested layouts, `errorElement`, `NavLink`, `useSearchParams`; already the shape of the app | **Selected** |
| `react-router-dom` 7 (current) | 7.18.5 installed | Works; **the package is removed in v8**, imports split between `react-router` and `react-router/dom` | Migrate |
| TanStack Router | 1.170.46 | Typed routes and search-param schemas are genuinely better; but it is a full re-platform of 15 routes and the tab model for a typing benefit we can approximate with `lib/routes.ts` | Rejected (revisit if route params grow) |
| Wouter | 3.x | Too little for nested layouts | Rejected |

**Verified migration facts** (v8.0.0 changelog, package inspection): ESM-only; `react-router-dom` removed; `RouterProvider` from `react-router/dom`; everything else from `react-router`; Node ≥ 22.22.0; React ≥ 19.2.7; middleware always on; `target/lib` ES2022. Our installed React is 19.3.1 and Node is 22.22.2, so the peer constraints are already satisfied. `createBrowserRouter` is still exported (`index.d.ts`).

### 3.7 Data and state

| Candidate | Version | Fit | Verdict |
| --- | --- | --- | --- |
| **TanStack Query** | 5.107.1 | Cache, staleness, retries, refetch-on-focus, mutation states; exactly the run-snapshot problem | **Conditional**: install with the first real endpoint (T4) |
| **React context + local state** | — | Current `state/app.tsx`: rail/panel/tabs/palette. 120 lines, no prop drilling beyond one level | **Selected now** |
| Zustand | 5.1.0 | Small; justified when three unrelated subtrees need the same transient state | Conditional (measured need only) |
| Jotai | 3.0.1 | Atom-per-value is elegant for editors, not for this | Rejected |
| Redux Toolkit | 2.14.0 | Ceremony without a requirement | Rejected |

**Why not Query today:** there is no network. A cache in front of `src/data/mock.ts` would simulate latency and teach the UI to depend on a cache that has nothing to cache. The seam is designed (§7) so adding it is one provider plus hook rewrites, not an architecture change.

### 3.8 Editing

| Candidate | Version | Fit | Verdict |
| --- | --- | --- | --- |
| **Tiptap** | 3.33.0 | ProseMirror schema, custom inline nodes (file/note/run chips), headless rendering, Yjs path later | **Conditional** (notes milestone) |
| Lexical | 0.53.0 | Fast, React-native mental model; custom node API is younger, collaboration story narrower | Rejected |
| ProseMirror raw | — | Maximum control, weeks of schema/view work for no product difference | Rejected |
| Markdown textarea | — | Cheap, but the product's claim is authored structure with references | Rejected |

Note: `application.md` proposed Tiptap **2**; latest is **3**. The migration is within the same schema model, but the notes milestone must pin 3 and check the reference-node API.

### 3.9 Canvas

| Candidate | Version | Category | Verdict |
| --- | --- | --- | --- |
| **Custom DOM + SVG** | — | Structured board: named sections, typed cards, labelled edges, live bindings | **Selected** (built) |
| tldraw | 5.6.0 | Freehand whiteboard SDK with its own visual identity, gestures and licence terms | Rejected for the structured board; a *freehand* mode later could use it |
| Excalidraw | 0.18.1 | Hand-drawn aesthetic — the opposite of Quiet Computationalism | Rejected |
| React Flow | 12.12.1 | Node-graph (ports, handles, auto-layout idioms); good for flow diagrams, not for a spatial board with sections | Rejected; revisit only if the board becomes a graph editor |

The board is 60 cards, not 6,000. DOM+SVG at that size holds 60fps if hit-testing is a pointer state machine rather than per-node listeners — which is how it is written (`useCanvasGestures`). A `<canvas>` renderer is the fallback if the 30fps floor fails (§12 R3).

### 3.10 Interaction

| Candidate | Version | Fit | Verdict |
| --- | --- | --- | --- |
| **Pointer events (hand-written)** | — | Canvas pan/marquee/drag; 1:1 tracking, no library in the hot path | **Selected** |
| dnd-kit | 6.3.1 | Accessible list reordering, keyboard dragging | Conditional — for **lists** (tree, tab overflow), never for the canvas |
| cmdk | 1.1.1 | Command menu; our palette already works with 60 lines and needs `aria-activedescendant` | Rejected (would replace working code with a dependency) |

### 3.11 Testing and quality

| Tool | Version | Class | Notes |
| --- | --- | --- | --- |
| Vitest | 5.1.0 | **Core** | Peer supports Vite 6/7/8; unit tests for `lib/tabs`, `lib/routes`, mappers |
| Testing Library | 16.3.3 | **Core** | Three interaction-heavy components only |
| Playwright | 1.65.0 | **Core** | Three E2E paths; the CDP script already in `.workbuddy/` becomes a real suite |
| MSW | 3.0.4 | Conditional | With the first endpoint; also lets the WAM adapter be tested before WAM exists |
| ESLint + `no-restricted-imports` | — | **Core** | The layering rules must fail a build, not live in a doc |
| axe / Playwright a11y | — | Deferred | After the state matrix lands |

### 3.12 Infrastructure

| Concern | Decision | Class |
| --- | --- | --- |
| API client | one `fetch` wrapper normalising `{kind, message, retryable, requestId}` | Core (built) |
| Schema validation | Zod 4.6.7 at the boundary, parse-not-cast | Conditional (T4) |
| Error monitoring | Sentry or equivalent | Deferred — needs a DSN owner and a privacy position |
| Logging | structured `console.error` with request ids | Core (as built) |
| i18n | none in v1; Chinese is *rendered*, not translated | Deferred (M6) |
| Deployment | static files on a CDN + SPA fallback rewrite | Core |
| Package manager | npm, single package | Core; pnpm/turbo rejected (one app) |

---

## 4. Recommended stack

| Layer | Technology | Version | Responsibility | Why |
| --- | --- | --- | --- | --- |
| Runtime | Node | 22.22.2 | dev/build only | Meets both Vite 8 and RR8 floors |
| Language | TypeScript | 5.9.x, strict, `noUncheckedIndexedAccess` | types everywhere | Cheap correctness at the boundaries |
| UI | React | 19.3.x | rendering | Installed; ecosystem |
| Build | Vite | 6.4 (now) → 8.x (T1b) | dev server, bundling | Static SPA |
| Router | react-router | 8.x | URL, layouts, loaders/errors | Data router fits the shell |
| Styling | CSS Modules + tokens | — | visual system | One scale, zero runtime |
| Primitives | hand-built → React Aria | 1.22 (cond.) | behaviour | A11y without a second look |
| Server state | TanStack Query | 5.107 (cond.) | cache, retries | Run snapshots |
| Client state | context + `useState` | — | shell state | Small and local |
| Editor | Tiptap | 3.33 (cond.) | notes | Schema + custom nodes |
| Canvas | DOM+SVG, custom | — | board | Structured, controlled |
| Validation | Zod | 4.6 (cond.) | wire parsing | Do not trust WAM |
| Unit test | Vitest + RTL | 5.1 / 16.3 | logic + 3 components | Fast, Vite-native |
| E2E | Playwright | 1.65 | 3 user paths | Real browser |
| Lint | ESLint flat config | — | layering zones | A build must fail |

**Deferred, with the trigger that unblocks each:** Query (first endpoint), Zod (same), React Aria (first overlay beyond the palette), Tiptap (notes milestone), dnd-kit (list reorder), MSW (endpoint contract), Sentry (DSN owner), i18n (locale decision), Vite 8 + plugin 6 (post-MVP spike), TypeScript 7 (200+ files).

---

## 5. Application architecture

### 5.1 Layers, and what may import what

```
styles/  ──────────────────────────────┐  tokens, fonts, grammar
components/ui      (no product knowledge)
components/content (file glyph, state chip, notice, menu)
shell/             rail · strip · panel · palette
pages/             one directory per surface
data/              sample model + selectors (replaced by services/ when endpoints exist)
services/          http · auth · wam · files   ← the only place that knows a wire shape
lib/               pure functions + types + routes
```

Rules, each with the failure it prevents:

| Rule | Failure prevented |
| --- | --- |
| `components/*` imports no `pages/`, `shell/`, `services/` | A button that knows about runs cannot be reused |
| `shell/` imports no `pages/` | Adding an area stops being a shell change |
| `pages/*` do not import each other | Cross-feature cycles (notes ↔ files) |
| Only `services/*` imports a wire type | A field rename touches one file, not forty |
| `lib/` imports nothing from `src/` | Pure functions stay testable without jsdom |
| No component holds a run's *decision* state (retry, priority, estimate) | Re-implementing WAM |

Enforced by `eslint.config.js` zones (T2), because a document cannot fail a build.

### 5.2 Module map against the current tree

| Layer | Today | Change required |
| --- | --- | --- |
| `app/` | router, providers, error | Router 8 import split |
| `shell/` | rail, strip, panel, palette, layouts | Tab type glyphs + overflow (plan 02) |
| `pages/` | 9 surfaces | State matrix, type steps (plan 03–10) |
| `data/` | mock + selectors | Becomes `services/` + Query hooks at T4; types move to `lib/types.ts` |
| `state/` | tabs, rail, panel, palette | Add density preference; keep the one-writer rule |
| `styles/` | fonts, typography, tokens, base | Add `grammar.module.css` (plan 06) |
| `services/` | absent | `http.ts`, `auth/`, `wam/{types,map,client,stream}`, `files/` |
| `lib/` | routes, tone | Add `tabs.ts`, `ids.ts`, `format.ts` when the editor lands |

Deliberately absent: a `hooks/` directory, per-feature `types.ts`, barrel files, a design-system package. Each would be a home for things that belong elsewhere.

---

## 6. Routing and workspace state model

### 6.1 Three kinds of state, three homes

| Kind | Examples | Home | Lifetime |
| --- | --- | --- | --- |
| **URL** | workspace, room, active object, account section | path + params | shareable, back-button correct |
| **Persisted view** | open tab set per context, rail collapsed, panel width, density | `sessionStorage` / `localStorage` | reload → same working set |
| **Transient** | selection, palette open, intent draft, notices | component state | while mounted |

**Rule:** nothing that the URL can express may live in a store. The tab *set* is the one thing the URL cannot express (12 tabs would make URLs unshareable and grow without bound), so it is persisted — but the *active* tab is always the route.

### 6.2 Tab lifecycle

| Event | Behaviour |
| --- | --- |
| Open object | `useRegisterTab` writes once; existing path ⇒ no duplicate |
| Close active | navigate to the room index of that type; never an empty surface |
| Close inactive | remove only |
| Context switch | separate set per `ws:<id>` / `notes`; never carry an object across scopes |
| Reload | restore set + active route; drop entries whose object no longer resolves |
| Object deleted | tombstone tab until dismissed (surface says it is gone) |
| Dirty buffer | close/switch opens an inline save/discard/cancel in the strip — **required before the editor ships** |

### 6.3 Panels

One per surface, content supplied by the route (not by a context), width persisted per app, 280–480, `⌘\` toggles. A panel is never a second navigation column and never nests.

### 6.4 Restoration

`sessionStorage` (not `localStorage`) for tabs: it survives reload and same-tab navigation, is per browser tab, and clears with the session. That matches the mental model of a working set, and it prevents two browser windows fighting over one tab list.

---

## 7. Data and persistence architecture

### 7.1 The seam

```
page ── hook (useRuns/useFiles) ── services/<domain>/client ── http.ts ── network
                                        │
                                     map.ts  (wire → domain)
```

- **Wire types** live only in `services/*/types.ts`; **domain types** in `lib/types.ts`; `map.ts` is the only file importing both.
- **Validation** (T4): `schema.parse(payload)` at `client.ts`; a parse failure is a normalised `ApiError{kind:'contract'}`, not an exception in a component.
- **Errors** are normalised once: `{kind, message, retryable, requestId}`. Components never see status codes.
- **Retries**: GET 2 with backoff; writes 0 — a retried run submission can start two runs and charge twice. Idempotency keys are a WAM-side question (R2).

### 7.2 Caching (when Query arrives)

| Key | Staleness | Notes |
| --- | --- | --- |
| `['me']` | 5 min | identity |
| `['files', wsId, folderId]` | 30 s | lists |
| `['note', id]` | 60 s | entity |
| `['run', id]` | 0 | always live; appended by events |
| `['runs', wsId, filter]` | 15 s | table |

Optimistic updates only for rename/move/reorder; creations are pessimistic because the server owns the id.

### 7.3 Persistence matrix

| Data | Where | Why |
| --- | --- | --- |
| Preferences (density, panel width, rail) | `localStorage` `thylas:ui:v1` | device-local, no account service needed |
| Open tabs | `sessionStorage` `thylas:tabs:v1` | working set, per browser tab |
| Board viewport | `localStorage` per board | orientation, cheap |
| Note drafts | in-memory + `beforeunload` guard (MVP); IndexedDB later | drafts must not silently vanish, but also must not become a second source of truth |
| Resource data | never local-first in v1 | the workspace is the truth; offline editing is out of scope |

Explicitly not persisted: palette state, selections, scroll positions of transient lists, intent drafts beyond the session.

---

## 8. WAM integration architecture

### 8.1 The boundary in four verbs

| Verb | Direction | Thylas does | Thylas never does |
| --- | --- | --- | --- |
| **Submit** | → WAM | send intent text + workspace + refs; keep the verbatim text | interpret, rewrite, or "improve" the intent |
| **Subscribe** | ← WAM | render state/plan/activity/artifacts from events | derive state from event history as truth |
| **Act** | → WAM | render only capabilities the run exposes | invent a control, or retry a failed run locally |
| **Ingest** | ← WAM | accept an artifact through one endpoint; assign id/scope/placement/provenance | let WAM write Thylas tables |

### 8.2 Transport: a decision, not a preference

| WAM offers | Adapter | UI consequence |
| --- | --- | --- |
| SSE | `EventSource` + `Last-Event-ID` | none |
| WebSocket | one socket, topic per run, resubscribe | presence becomes cheap later |
| Poll only | 3 s visible / 30 s hidden | show "updated 4s ago"; live dot becomes approximate |
| Nothing | manual refresh | Processes is not viable; this reopens the product |

**Recommendation:** write `services/wam/stream.ts` as an adapter with one interface `subscribe(runId, cb): () => void` and a `mode` switch. Ship the poll implementation first (it works against every backend), add SSE when WAM confirms it. UI code must never branch on transport.

### 8.3 Event handling rules

- **Ordering:** events carry a monotonic `seq` per run. A lower `seq` than the last applied is dropped. Without `seq`, order by timestamp with a 2 s window and accept reordering inside it.
- **Deduplication:** `(runId, seq)` is the key; replay after reconnect is safe.
- **Resume:** `Last-Event-ID` when available; otherwise fetch a snapshot and continue.
- **Gaps:** if a snapshot's `seq` is ahead of the last event, discard the event stream and refetch the snapshot (never patch a gap).
- **Never derive:** the run's state comes from the snapshot field, not from "the last event was a tool call".

### 8.4 Artifacts

`POST /api/workspaces/:id/artifacts` with `{runId, kind, name, content|storageRef}`. Thylas assigns identity and placement; WAM supplies content and a proposed name. Push first, pull (`artifact.created` → fetch) only if the event stream already exists. Provenance (`producedBy`) is mandatory at the call site, so a result can never appear without a run to blame.

### 8.5 Assumptions requiring WAM confirmation

| # | Assumption | If false |
| --- | --- | --- |
| A1 | A run exposes a capability list | Controls become a hard-coded, ageing list |
| A2 | An event stream exists (any transport) | Poll-only product; `needs you` cannot pull attention |
| A3 | Events are ordered or sequence-numbered | Client-side ordering window; possible flicker |
| A4 | A snapshot is fetchable independently of the stream | Reconnect cannot reconcile |
| A5 | Identity can be forwarded per request | BFF required (§9.3) |
| A6 | Artifact ingestion can be a Thylas endpoint | Provenance and placement are lost (B2) |

---

## 9. Security and service integration

### 9.1 Authentication

Sign-in and session belong to CHORD's identity provider. Thylas holds a session and renders identity. It does not store provider credentials, does not refresh tokens itself beyond the cookie, and does not implement password flows.

### 9.2 Authorisation

- The **owner of the resource** re-checks at execution time (B1). A hidden rail row is a courtesy.
- Every WAM request carries the acting user's identity. A service token that impersonates the user's authority is forbidden.
- Client-side permission helpers are forbidden: they become the place where the real check is forgotten.
- Permission-aware UI reads **flags returned by the server**, never computes them.

### 9.3 Direct vs BFF

| If | Then | Cost |
| --- | --- | --- |
| WAM accepts a user-scoped session and CORS from the app origin | browser calls it directly; `vite.config.ts` proxies in dev only | no server in this repo |
| WAM needs a service credential or must not be public | one BFF (~300 lines): reverse proxy, session cookie, identity forwarding | one deployable, one more place to get identity right |

**Default assumption (N5 = no direct access):** build the client against a same-origin `/api` path, which works in both worlds. Do not build the BFF until an actual endpoint refuses the browser.

### 9.4 Cross-service identity

Storage upload uses signed URLs scoped to the user; metering and billing are read-only; Rym is never called from Thylas (WAM is its caller). The only credential Thylas forwards is identity.

---

## 10. Compatibility review

Individually good libraries do not compose. The pairs that matter here:

| Pair | Conflict | Resolution |
| --- | --- | --- |
| Router 8 × tab strip | Tabs look like a second router | Strip is derived from `location`; one writer (`useRegisterTab`); closing navigates, never mutates history |
| Router 8 × persisted tabs | Stale paths after rename/delete | Reconcile on mount against the current route table; drop unresolvable entries; tombstone deleted objects |
| Router 8 migration × current imports | `react-router-dom` is removed in v8 | Import split: `RouterProvider` from `react-router/dom`, the rest from `react-router`; ESM-only is already satisfied (`"type":"module"`) |
| React Aria × CSS Modules (if adopted) | Two styling models (data attributes vs classes) | Use React Aria **hooks** (`useMenu`, `useDialog`) with our own markup, not its components; its `data-*` state attributes are styled from our modules |
| Tiptap × persistence | Editor state vs React Query cache vs draft | Editor owns the buffer; save is a mutation with a version; 409 → review dialog; drafts never enter the query cache |
| Tiptap × tabs | Dirty buffers + close | Tab close/switch consults a dirty registry; explicit save/discard/cancel; `beforeunload` as backstop |
| Canvas × panels | Resizing the panel reflows the canvas, fit-scale jumps | Fit is `min(1, …)` on the *stage*, not the scene; resize observer debounced; viewport persisted per board |
| Canvas × dnd-kit | Two pointer systems in one surface | dnd-kit only in lists; the canvas keeps its own pointer state machine |
| Query × WAM stream | Two writers into the same cache | Events patch the query cache through one updater; snapshots replace, events append-and-dedupe by `seq` |
| Auth × cross-service | Two places deciding access | One identity, forwarded; no client ACL module; 403 renders "no access", never an empty list |
| Vitest × router | jsdom + data router needs a memory router | Pure `lib/tabs` tests first (no router); route tests use `createMemoryRouter` |
| Vite 8 × plugin-react | Peer requires plugin 6 + oxc transform | Upgrade as one spike; do not mix Vite 8 with plugin 4 |
| TypeScript 7 × ecosystem | Native compiler, type-only ecosystem lag | Stay on 5.9 until 200+ files or a concrete blocker |

**Dependency budget:** 3 runtime dependencies today. The ceiling before the first backend is ~8 (add Query, Zod, Tiptap when their triggers fire; not before).

---

## 11. Implementation roadmap

Stages are architectural, not calendar estimates. Each has an exit criterion that can be checked.

| Stage | Objective | Technologies | Depends | Deliverable | Validation | Exit criterion |
| --- | --- | --- | --- | --- | --- | --- |
| **T0** | Type + token foundations | self-hosted fonts, CSS Modules | — | `src/styles/{fonts,typography}.css` | font request trace | English screen 4 requests, 0 CJK (done: plan 01) |
| **T1** | Router 8 migration | `react-router` 8 | T0 | import split, package swap | `npm run build`; 15 routes render; tab suite green | zero `react-router-dom` imports; E2E green |
| **T1b** | Build upgrade spike (branch, timeboxed) | Vite 8 + plugin 6 | T1 | branch only | dev + build + HMR on the canvas route | equal or better build time; no runtime regression |
| **T2** | Shell + tab model | router, context store, ESLint zones | T1 | typed tabs, `+N`, rail keyboard, zone rules | keyboard-only pass; 9-tab overflow | plan/02 gate G1 |
| **T3** | Resource surfaces | + editor later | T2 | files/notes/board/processes at contract quality | screenshots 1280/1440; state matrix | plan/03–09 gates G2–G3 |
| **T4** | HTTP boundary | fetch wrapper, Query, Zod, MSW | first real endpoint | `services/http.ts`, typed clients, mappers | contract tests against MSW | parse failures normalised; no DTO in `pages/` |
| **T5** | WAM adapter | Query + stream adapter | T4, A1–A6 answered | submit/subscribe/act + artifact ingestion | fake WAM server: reconnect, gap, dedupe, no-capability | live run reaches `succeeded` with no refresh |
| **T6** | Notes editor | Tiptap 3 + save path | T4, dirty-tab guard | editor, references, 409 flow | two-tab edit, offline-ish latency, reload | no data loss in the conflict test |
| **T7** | Board editing | pointer state machine, undo | T3 | drag, edges, tools | 60 cards @30fps, 4× CPU throttle | frame budget holds, or `<canvas>` fallback |

**Order rationale:** T1 before T2 because the tab model is written against router APIs; T4 before T5 because the stream needs the client seam; T6 last among features because it introduces the first write path and the first real data-loss risk.

---

## 12. Technical risks

### R1 · WAM has no event stream or capability list
**Why it matters:** Processes is the product's claim; without a stream it becomes a refresh button, and without capabilities the control bar lies.
**Assumption:** A1, A2.
**Validate:** a 150-line fake WAM (MSW or a local server) exposing `submit/getRun/subscribe/capabilities`; build T5's adapter against it *before* WAM is ready.
**Fallback:** poll every 3 s while a run is visible, label "updated Ns ago", and treat `needs you` as a list badge rather than a live interruption.

### R2 · Nobody owns authorisation (N2)
**Why it matters:** J8, organisation workspaces and every `403` in the UI depend on it; a member's first sign-in is currently unspecified.
**Assumption:** a shared authz service exists and can forward identity.
**Validate:** one spike that signs in through the real IdP and calls one WAM endpoint with a forwarded identity; if the endpoint cannot tell who is calling, the BFF is mandatory.
**Fallback:** BFF that terminates the session and forwards identity; org features ship without a UI (absence, not fake).

### R3 · Canvas frame budget and scope creep
**Why it matters:** hand-built hit-testing is the largest estimate and the only surface that can absorb a month silently.
**Assumption:** 60 cards + 3 sections + edges stay under 16 ms/frame in DOM.
**Validate:** stress fixture (200 cards, 40 edges) at 4× CPU throttle before building editing.
**Fallback:** `<canvas>` renderer behind the same scene model; or read-only board shipped and editing deferred.

### R4 · Editor save path loses work
**Why it matters:** the first write path in the app; conflicts, tab close and autosave interact.
**Assumption:** version-number + 409 review is enough for a single user across two tabs.
**Validate:** two-tab edit test, close-during-save test, reload-during-save test; network throttled to 400 ms.
**Fallback:** pessimistic save with a blocking inline spinner (slower, never lossy); disable multi-tab editing with an explicit message.

### R5 · Router 8 migration destabilises the tab model
**Why it matters:** ESM-only, `react-router-dom` removed, middleware always on; the strip depends on `location` semantics.
**Assumption:** the import split is the whole migration for data-router usage.
**Validate:** migrate on a branch; run the 16-assertion suite plus reload/back-button cases before merging.
**Fallback:** stay on 7.18.5 (patched) and revisit; nothing in the architecture depends on v8 APIs.

---

## 13. Unresolved decisions

| # | Question | Owner | Blocks | Default if unanswered |
| --- | --- | --- | --- | --- |
| U1 | Who owns auth/authz, and can identity be forwarded? (N2) | CHORD platform | J8, org UI, BFF shape | assume yes; build against `/api` |
| U2 | Can the browser reach WAM directly? (N5) | WAM | deployment shape | assume no; same-origin `/api` |
| U3 | Upload path: signed direct or through API? (N3) | storage | Files | signed direct, 5 GB ceiling |
| U4 | Does storage model folders? (N4) | storage | file tree ownership | Thylas owns folders |
| U5 | Artifact ingestion: push or pull? | WAM + Thylas | provenance | push |
| U6 | Is real-time collaboration in scope for v2? | product | editor engine (Yjs), board model | no; keep the save path version-based |
| U7 | Does the board ever become freehand? | product | canvas engine | no; structured only |
| U8 | Chinese as a translated locale? | product | i18n, Noto subsetting | render-only |

---

## 14. Architecture decision records

**ADR-001 · SPA on Vite, no SSR/RSC** — *Status:* accepted (proposed).
Context: every route is authenticated; the app is a workspace. Decision: client-rendered SPA, static hosting with a fallback rewrite.
Alternatives: Next.js (rejected: no public surface, second auth path, RSC boundary overhead), Remix/React Router framework mode (rejected: server we do not need).
Consequences: bundle on first paint (127 KB gzip today); no server data layer to leak authorisation; deployment is files.

**ADR-002 · URL is the only location truth** — *Status:* accepted.
Context: rail + strip + panel can disagree. Decision: route is the active tab; tab *set* is persisted per context; one writer.
Alternatives: global navigation store (rejected: two truths), tabs in query string (rejected: unshareable URLs, history noise).
Consequences: closing a tab navigates; reconciliation logic must be tested first.

**ADR-003 · No global state manager** — *Status:* accepted; revisit if measured.
Context: shell state is small and local. Decision: context + `useState`; three categories of state with distinct homes.
Alternatives: Zustand now (rejected: no measured need), Redux (rejected: ceremony).
Consequences: some prop passing through layouts; a clear rule for where new state goes.

**ADR-004 · CSS Modules over a utility framework** — *Status:* accepted.
Context: the visual system is a token file with one numeric scale. Decision: CSS Modules composing tokens; a shared `grammar.module.css` for repeated recipes.
Alternatives: Tailwind (rejected: second scale, drift), Vanilla Extract (deferred: build complexity for one app), CSS-in-JS (rejected: runtime).
Consequences: more CSS authoring; no class-name guessing; tokens remain enforceable by grep.

**ADR-005 · Router 8, `react-router` package** — *Status:* proposed (T1).
Context: `react-router-dom` is removed in v8; v8 requires React ≥19.2.7 (installed 19.3.1). Decision: migrate imports, not routing model.
Alternatives: stay on 7.18.5 (acceptable fallback), TanStack Router (rejected: re-platform for typing).
Consequences: ESM-only (already), middleware always on (unused), one afternoon of import surgery.

**ADR-006 · Hand-built primitives; React Aria as the conditional behaviour layer** — *Status:* accepted.
Context: 8 primitives, no third-party CSS. Decision: keep hand-built until overlays demand focus management; then adopt React Aria hooks only.
Alternatives: Radix (rejected: two systems), Base UI (rejected: RC), component kits (rejected: visual conflict).
Consequences: we own keyboard models; deleting hand-built Popover/Tooltip when React Aria lands.

**ADR-007 · TanStack Query deferred until the first endpoint** — *Status:* proposed.
Context: no network today. Decision: design the seam, install at T4.
Alternatives: install now (rejected: a cache over mocks teaches the wrong dependency), manual hooks forever (rejected: retries/staleness get reimplemented badly).
Consequences: one provider + hook rewrites; cache keys specified in advance.

**ADR-008 · Tiptap 3 for notes, and nothing else** — *Status:* proposed (T6).
Context: notes need a schema with custom inline reference nodes. Decision: Tiptap 3, one editor, version-based saving.
Alternatives: Lexical (rejected: younger custom-node story), ProseMirror raw (rejected: weeks for no product gain), markdown (rejected: loses structure).
Consequences: editor bundle (~100 KB) only on note routes; schema migration discipline.

**ADR-009 · Custom structured canvas, not tldraw** — *Status:* accepted.
Context: the board has sections, typed cards, labelled edges, live cards. Decision: DOM + SVG + a pointer state machine.
Alternatives: tldraw (own identity/licence), Excalidraw (hand-drawn aesthetic), React Flow (graph idioms).
Consequences: hit-testing is ours; `<canvas>` fallback if frames drop.

**ADR-010 · WAM contract: commands in, events out, artifacts through one door** — *Status:* proposed, needs WAM agreement.
Context: risk of WAM writing Thylas tables or Thylas retrying runs. Decision: four verbs (§8.1); transport behind one adapter; `capabilities()` gates every control.
Alternatives: shared database (rejected: two owners), generic event bus (rejected: untyped, unattributable).
Consequences: ingestion is a real endpoint; WAM integration needs a contract review before T5.

**ADR-011 · Identity forwarded; no client ACL** — *Status:* accepted (product B1).
Context: hiding a row is not access control. Decision: re-check at execution; flags in, not computed.
Alternatives: client permission module (rejected: becomes the forgotten check), service token impersonation (forbidden).
Consequences: needs an authz service that understands the user; until then org UI ships without admin surfaces.

**ADR-012 · Quality gate in the build, not in a document** — *Status:* proposed (T2).
Context: layering and typographic rules decay unless a command fails. Decision: ESLint zones + a `gates` script (greps + runtime checks) in CI.
Alternatives: review-only conventions (already failed once — the audit found six copies of one banner).
Consequences: rules must be maintained as code; false positives cost time and must be fixed, not ignored.

---

## 15. What this document does not decide

- **Delivery dates.** Stages are ordered by dependency, not calendar.
- **WAM's API shape.** Assumptions A1–A6 are questions for the WAM owner, not decisions.
- **Pricing, plans, quotas.** Display-only in Thylas; the numbers come from a metering service.
- **Dark mode, mobile, collaboration, freehand canvas.** Out of v1 by product decision.
- **Sentry, i18n, analytics.** Deferred until an owner and a privacy position exist.
