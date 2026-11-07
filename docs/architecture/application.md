# Thylas — Application Architecture

**Status:** proposed. No application code exists in this repository yet.
**Date:** 2026-11-07
**Depends on:** `docs/product/definition.md` (state ownership), `design/thylas-ui-design-plan.md` (screens, tabs, canvas).
**Labels:** [C] confirmed · [P] proposed · [?] open · [A] assumption.

> **Superseded in part on 2026-11-07 by [`tech-stack.md`](tech-stack.md)**, which is grounded in the implemented app and in versions verified against the registry. Where the two disagree, `tech-stack.md` wins. The deltas:
>
> | Topic | This document | `tech-stack.md` |
> | --- | --- | --- |
> | Router | `react-router-dom` 7 | `react-router` **8** (`react-router/dom` for `RouterProvider`); `react-router-dom` is removed in v8 |
> | Vite | 6 | 6.4 now, 8.x after a timeboxed spike |
> | TanStack Query / Zustand | "Recommended", installed at M1 | **Deferred** until the first real endpoint; context state only |
> | Editor | Tiptap **2** | Tiptap **3** (latest) |
> | Module layout | 127 files, `features/` | 41 files, `pages/` (what exists) |
> | Type system | serif display + grotesque UI | no serif; Plex/Noto contract (`typography.md`) |
>
> Everything else here — layering intent, state ownership, B1–B3, the WAM interface sketch — still holds and is carried forward.

---

## 1. The stack, and the cost of each choice

There is no `package.json`, no `src/`, no framework in the repository. This is a greenfield choice, not a migration, so it needs a reason rather than a precedent.

**[P] Recommended:**

| Layer | Choice | Version | Reason it wins here |
| --- | --- | --- | --- |
| Build | Vite | 6 | Dev server start and HMR on a canvas-heavy app; no server runtime needed |
| UI | React | 19 | Team familiarity (Lemma, ISDB); the ecosystem for block editors and canvas hit-testing |
| Language | TypeScript | 5.x, `strict` | Route params, entity ids, and the WAM boundary are all typed surfaces |
| Routing | React Router | 7, data router, SPA mode | Nested layouts match rail/workspace/room nesting; `errorElement` per route gives the boundary in §7 |
| Server state | TanStack Query | 5 | Caching, staleness, retries, and "refetch on focus" are exactly the run-state problem |
| Client state | Zustand | 5 | ~3 small stores (tabs, panel, palette). Nothing else |
| Styling | CSS Modules + `tokens.css` | — | See §1.1 |
| Editor | TipTap (ProseMirror) | 2 | Block editor with custom nodes for file/note/process references. Building this is 3+ weeks |
| Canvas | Hand-built DOM + SVG | — | See §1.2 |
| Test | Vitest + Testing Library + Playwright | — | — |
| API mock | MSW | 2 | Same handlers in dev, Storybook-less component tests, and Playwright |

### 1.1 Why not Next.js

Three reasons, in order of weight.

1. **There is no public surface.** Every screen is behind sign-in. SSR buys nothing, and static prerendering of a logged-in shell is a build step that produces nothing.
2. **RSC would create a second authorization path.** Server components need the user's credentials on the server. That is a second place where "who may read this" is decided, and boundary B1 says authorization is decided once, by the resource owner, at execution time. A server data layer invites a local check that looks authoritative.
3. **The canvas and the editor are the app.** In Next they are `'use client'` islands; if 70% of the tree is a client island, the RSC boundary is pure overhead.

**Cost accepted:** no SSR, so first paint after sign-in is a JS bundle. Mitigation: route-level code splitting, and the shell renders from tokens before any data arrives. Cold start on a warm CDN should stay under 1.5s on a normal connection; this is a target, not a measurement.

### 1.2 Why not Tailwind, tldraw, or Excalidraw

**Tailwind.** `tokens.css` already encodes the visual system as CSS variables: 1px hairlines, a 4/8/12/16/24/32/48 spacing scale, four type ramps in three families, row heights by role. Tailwind adds a second scale with different defaults (`0.25rem` steps, its own palette, its own radius set). Two scales drift: someone writes `p-3` where the design means `--s3`, and the 12px becomes 12px by coincidence until it isn't. The prototype was built with hand-written CSS against tokens and reads correctly; keeping that removes a translation layer.

**Cost accepted:** more CSS to write, no utility shorthand. Mitigation: a `styles/utilities.css` capped at ten classes (`.row`, `.stack`, `.label`, `.mono`, `.truncate`, `.hairline`, `.fill`, `.center`, `.gap-*`). If it grows past ten, the component should own the style instead.

**tldraw / Excalidraw.** Both are freeform drawing tools. Thylas's board is structured: named sections, typed cards, labelled edges, live cards bound to a run. Its look must come entirely from tokens, and its interaction model must match the HeptaBase findings in `design/…plan.md` §8.2. Both libraries ship their own CSS, their own gesture vocabulary, and their own visual identity; overriding them costs more than the parts we would reuse (pan, zoom, selection box). Licensing is a secondary concern but real: tldraw's free tier places a watermark.

**Cost accepted:** we write hit-testing, marquee selection, edge routing, and zoom. Estimate 3–4 weeks for a usable v1 canvas, and it is the largest single risk in the roadmap. If that estimate doubles, the fallback is to ship the board read-only (render only, no editing) and revisit.

### 1.3 Conditional: a thin BFF

**[?]** Whether the browser can call WAM directly is unknown. Two paths:

| If | Then | Consequence |
| --- | --- | --- |
| WAM exposes a public API with user-delegated auth (OIDC / cookie) and CORS | Browser calls it directly. `vite.config.ts` proxies in dev only | No server in this repo. Deployment is static files |
| WAM requires a service credential, or must not be public | A single-process BFF: reverse proxy + session cookie + identity forwarding | One more deployable, one more place where B1 is enforced. ~300 lines. Appears at M4 |

**Default assumption [A]:** the second. It is the safer assumption for a platform that runs agents with the user's authority, and building the client against a same-origin `/api` path works in both cases.

---

## 2. Layering

Five layers, strict one-way dependencies. An arrow means "may import from".

```
  styles/tokens.css
        │
  components/ui            primitives, zero product knowledge
        │
  components/content       file glyph, scope badge, state chip, empty state
        │
  shell/                   rail, strip, tabs, panel, palette — present on every route
        │
  features/*               one directory per product area
        │
  layouts/                 compose shell + feature outlet
        │
  app/                     router, providers, bootstrap
        │
  main.tsx
```

`services/` and `lib/` sit beside this stack and may be imported by any layer above `components/ui`:

```
  services/http.ts ──▶ services/wam/*, services/files/*, services/auth/*
  lib/*            ──▶ pure functions and types, imported by everything
```

**Rules, with the failure each prevents:**

| Rule | Failure it prevents |
| --- | --- |
| `components/ui` imports nothing from `features/`, `shell/`, or `services/` | A button that knows about runs cannot be reused in Account |
| A feature imports another feature only through `components/content` or `services/` | `notes` importing `whiteboard`'s store creates a cycle in month two |
| `shell/` never imports a feature | The shell would need to know every area; adding an area becomes a shell change |
| `lib/` imports nothing from `src/` | Pure functions stay testable without jsdom |
| No component imports a WAM DTO | The API can change shape without touching 40 components (see §5) |

Enforcement: an ESLint `import/no-restricted-paths` block, not a convention in a document. It is written in `eslint.config.js` at M0.

---

## 3. Where state lives

The core architectural decision, and the one that most often goes wrong: **navigation state is in the URL, not in a store.** A second copy of "where am I" is how a sidebar and a tab strip end up disagreeing.

| State | Home | Lifetime | Truth |
| --- | --- | --- | --- |
| Signed-in user, roles | Query `['me']` + route guard | Session | Identity provider |
| **Current workspace** | URL segment `/w/:workspaceId` | Route | Thylas |
| **Active tab** | URL (the route itself) | Route | Thylas |
| **Open tab list** | `sessionStorage`, key `tabs:v1:<userId>:<workspaceId>` | 30 days, cleared on sign-out | Thylas client |
| Panel width, rail collapsed | `localStorage`, `ui:v1` | Permanent | Thylas client |
| Canvas viewport per board | `localStorage`, `board:v1:<boardId>` | Permanent | Thylas client |
| File tree, notes list, board content | Query cache | `staleTime` 30s, refetch on focus | Thylas API |
| Run snapshot, activity | Query cache, appended by event stream | View lifetime | WAM |
| Unsaved note draft | Component state + `beforeunload` guard | Tab lifetime | Thylas client |
| Palette open, dialog open | Zustand (`uiStore`) | Transient | Thylas client |
| Editor selection, canvas marquee | Component state | Transient | Thylas client |

**Why the tab list is not in the URL.** Encoding 12 tabs in a query string makes URLs unshareable, breaks history (every tab switch is a history entry unless replaced), and grows without bound. The URL carries the active tab; the strip carries the set. On load: read the set, read the active tab from the route, discard entries whose object no longer exists.

**Why the tab list is not only in a store.** A reload or a crash must not lose the workspace. `sessionStorage` survives reload and same-tab navigation, and it is not shared across tabs of the browser, which matches the mental model.

**[?] N6** — two browser tabs editing the same note. v1 behaviour: last write wins, with a version number in the save payload; a 409 shows "this note changed elsewhere — review" and offers a diff. This is decided here only to have a default; it needs confirmation.

---

## 4. Routes

URLs are the product structure. This table is also the acceptance test for `design/…plan.md` §4.2 "every visible sidebar row maps to a URL".

| Path | Renders | Notes |
| --- | --- | --- |
| `/` | Redirect | To last workspace's Files, else `/overview` |
| `/overview` | Overview | No workspace scope |
| `/recently` | Recently | Cross-workspace |
| `/w/:workspaceId` | Redirect | To `/files` |
| `/w/:workspaceId/files` | Files index | Room tab, pinned |
| `/w/:workspaceId/files/:fileId` | File preview | Object tab |
| `/w/:workspaceId/boards` | Board index | Room tab |
| `/w/:workspaceId/boards/:boardId` | Board canvas | Object tab |
| `/w/:workspaceId/processes` | Process list | Room tab |
| `/w/:workspaceId/processes/:runId` | Run detail | Object tab |
| `/w/:workspaceId/settings` | Workspace settings | Object tab, admin only |
| `/notes` | Notes list + last opened note | Context: Notes library |
| `/notes/:noteId` | Note detail | Object tab |
| `/account` | Redirect to `/account/profile` | — |
| `/account/:section` | `profile` · `plan` · `usage` · `keys` · `preferences` · `organization` | `organization` is admin-only |
| `*` | Not found | Suggests Recently |

**No route for**: search results (the palette overlays, it does not navigate), process creation (a dialog on Overview or the room), board nesting (Q2 default: flat).

---

## 5. The WAM boundary

**[P] Proposed.** This is not an established contract. It is the narrowest shape that satisfies the product definition, written down so that the first conversation with WAM has something concrete to reject.

```ts
// [P] Proposed interface. Not implemented, not agreed.
type Ref = { kind: 'file' | 'note' | 'board'; id: string };

type Intent = {
  text: string;               // verbatim, stored by Thylas
  workspaceId: string;
  refs: Ref[];
};

type RunState =
  | 'queued' | 'running' | 'needs_input'
  | 'succeeded' | 'failed' | 'stopped';

type RunAction = 'pause' | 'resume' | 'stop' | 'answer' | 'approve' | 'rerun';

interface WamClient {
  submit(intent: Intent): Promise<{ runId: string }>;
  getRun(runId: string): Promise<RunSnapshot>;        // state, plan, activity, artifacts, credits
  subscribe(runId: string, onEvent: (e: RunEvent) => void): () => void;
  act(runId: string, action: RunAction, payload?: unknown): Promise<void>;
  capabilities(): Promise<WamCapabilities>;           // which actions exist, per type
  searchSemantic(query: string, scope: string): Promise<Ref[]>;
}
```

Three properties that matter more than the shape:

1. **`capabilities()` is what makes the "mirrored controls" rule implementable.** The UI renders a button only if the capability list contains it. Without this call, the rule degrades into a hard-coded list that lies after the first WAM release.
2. **`subscribe` is the only streaming surface.** Whether it is SSE, WebSocket, or long-poll is an adapter detail (§5.1). No component knows.
3. **No DTO crosses into `features/`.** `services/wam/map.ts` converts `RunSnapshot` into `Run` (a Thylas type). If WAM renames a field, one file changes.

### 5.1 Transport is unresolved (N1)

| If WAM offers | Adapter implementation | UI consequence |
| --- | --- | --- |
| SSE | `EventSource` + reconnect with `Last-Event-ID` | None |
| WebSocket | One socket, topic-per-run, resubscribe on reconnect | None, but presence later gets cheaper |
| Poll only | 3s polling while the run is visible, 30s otherwise | Show "updated 4s ago"; the design plan's live dot becomes approximate |
| Nothing | Manual refresh | The Processes area is not viable. This is the one outcome that reopens the product |

The fallback in every case except the last: poll, and say so.

### 5.2 Artifact ingestion (B2 in the product doc)

WAM does not write Thylas tables. Two acceptable forms, both proposed:

- **Push:** `POST /api/workspaces/:id/artifacts` with `{ runId, kind, name, content | storageRef }`. Thylas assigns id, scope, placement, and `producedBy`.
- **Pull:** WAM emits `artifact.created`; Thylas fetches and stores.

Push is simpler and makes provenance mandatory at the call site. Pull survives a Thylas outage. **[P]** Start with push, add pull only if the event stream already exists.

### 5.3 Rym and external providers

**[C]** Thylas has no Rym client. WAM calls Rym. Thylas has no provider API keys. The only credential Thylas holds is the user's session; the only credential it forwards is the user's identity.

This is worth stating because the alternative — a "model picker" in Thylas — is a natural-looking feature that would duplicate WAM's tool selection and put a second set of provider keys in a browser-adjacent service.

---

## 6. Data access conventions

| Concern | Convention |
| --- | --- |
| Query keys | `['files', wsId, folderId]`, `['note', noteId]`, `['runs', wsId, filter]`, `['run', runId]` — array, most general first |
| Staleness | Lists 30s; entities 60s; run snapshot 0 (always live); account 5min |
| Mutations | Optimistic for rename/move/reorder; pessimistic for create/delete (ids come from the server) |
| Errors | `services/http.ts` normalises to `{ kind, message, retryable, requestId }`. Components never see status codes |
| Retries | GET: 2, exponential. POST/PATCH/DELETE: 0. A retried write can double-charge credits |
| Auth failure | 401 → redirect to sign-in with return path. 403 → route-level "no access" page, never an empty list |
| WAM unavailable | Keep the last cached run, show "last updated N ago", never blank the screen |

**Why POST is not retried.** A run submission costs credits. A retry after a timeout can start two runs. Idempotency keys are the correct fix and are proposed in `submit` as an optional header, not assumed.

---

## 7. Failure, loading, and emptiness

Four levels, because a single global boundary produces a blank app when one panel fails.

| Level | Component | Catches |
| --- | --- | --- |
| Route | `app/error/RouteError.tsx` via `errorElement` | Render errors, loader errors for the whole route |
| Feature | `shell/FeatureBoundary.tsx` | One feature crashing inside a working shell; the rail stays usable |
| Panel | Inline in `shell/ContextPanel.tsx` | Panel data failing while the main surface works |
| Mutation | `components/content/InlineError.tsx` | A save that failed, next to the field, with retry |

**Loading [P]:** skeletons appear after 300ms, not before. A fast response should not flash a grey rectangle. Lists show 3 skeleton rows; the canvas shows the section outlines only, then cards.

**Empty states [C]** must answer "where did it go", not "there is no data". The design plan's rule — *"Closed the tab — the board is still in Whiteboard"* — generalises: every empty state names the container the thing would be in, and the action that creates one.

---

## 8. Testing

Proportional to a product with one user and no backend in this repo.

| Level | What | Count target | Why |
| --- | --- | --- | --- |
| Unit | `lib/` (url builders, date grouping, tab reconciliation), `services/*/map.ts` | 60–80 | Pure, cheap, and where mapping bugs live |
| Component | `components/ui`, plus three interaction-heavy pieces: tab strip, note save, canvas selection | 15–20 | The parts where a regression is invisible until a user hits it |
| Integration | One test per feature route, against MSW | 8 | Proves the route renders, loads, and errors |
| E2E | Three paths: sign in → open file → close tab; submit run → state changes → artifact appears; switch workspace → strip swaps | 3 | These are the product |
| Not doing | Visual regression, canvas pixel tests, a11y automation | — | The prototype is the visual reference; automated a11y comes at M6 |

---

## 9. Technical open questions

| ID | Question | Blocks | Default |
| --- | --- | --- | --- |
| **N1** | WAM transport: SSE, WS, or poll? | `services/wam/subscribe` and the live-state UI | Poll at 3s, say "updated N ago" |
| **N2** | Who owns authentication and authorization, and can Thylas forward user identity? | Every request; B1 enforcement | CHORD IdP + a shared authz service; Thylas holds a session cookie only |
| **N3** | Upload path: direct-to-storage signed URLs, or through the API? | Files, and the size ceiling | Signed direct upload, 5GB ceiling, 100MB through-API fallback |
| **N4** | Does the storage service already model folders? | Whether Thylas owns the file tree (product matrix #6) | Thylas owns folders; storage is flat |
| **N5** | Can the browser reach WAM directly? | Whether this repo contains a server (§1.3) | No; a thin BFF at M4 |
| **N6** | Concurrent edits to one note | The save path | Version number, 409 with a review dialog |
| **N7** | Is there an existing design-system package in CHORD to reuse? | `components/ui` | Assume no; tokens.css is the source |

---

## 10. What this architecture deliberately does not have

| Not present | Why |
| --- | --- |
| A global store holding the navigation state | §3. The URL is the location. Two copies disagree |
| A server-side rendering layer | §1.1 |
| A local queue / retry for runs | Boundary. That is orchestration |
| A model provider client | §5.3 |
| A generic "plugin" or "extension" system | No requirement exists; every extension point so far has exactly one implementation |
| Micro-frontends, module federation | One app, one team |
| A separate design-system package | `components/ui` plus tokens is enough until a second consumer exists |
| Storybook | The prototype is the visual reference. Add it when there are consumers outside this repo |
