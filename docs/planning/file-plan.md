# Thylas — Source File Plan

**Status:** proposed. Nothing here is written yet.
> **Superseded on 2026-11-13 by [`../development/backend/P1-6.md`](../development/backend/P1-6.md) (D-057)** for the upload path: §2 `services/files/upload.ts`, §3 and M2 describe a signed-URL/resumable flow that Phase 1 does not ship. P1-6 streams bytes to a local `STORAGE_DIR`; presigned direct upload is deferred.
**Date:** 2026-11-07
**Depends on:** `docs/architecture/application.md` (stack, layering, state ownership), `docs/product/definition.md` (capabilities).
**Rule for this document:** a file earns a line by having a non-obvious responsibility or a boundary. Files whose job is obvious from their name and directory are grouped into one rule.

---

## 0. Baseline

Assumed at the root, from `docs/architecture/application.md`:

- Vite 6 + React 19 + TypeScript strict
- `src/` at the root, not `app/` or `packages/`
- CSS Modules, one per component directory
- **127 source files** in v1 (excluding tests and the 9 root files). Nine screens, one canvas, one editor, one shell.

**[?]** The repository currently has no `package.json`. Creating one is the first act of implementation, not part of this plan.

---

## 1. Repository root

Nine files, each with a distinct reason. Anything else at the root is a mistake.

| File | Contains | Does not contain | Phase |
| --- | --- | --- | --- |
| `index.html` | The one HTML entry: `#root`, font preloads, `<title>`, theme colour meta | Any inline script or style beyond a pre-paint background | M0 |
| `package.json` | Dependencies, `dev` / `build` / `test` / `e2e` / `lint` scripts | Version numbers of internal packages (there are none) | M0 |
| `tsconfig.json` | `strict`, `noUncheckedIndexedAccess`, path alias `@/*` → `src/*`, DOM lib | Project references (single project) | M0 |
| `vite.config.ts` | React plugin, `@` alias, dev proxy `/api` → WAM/BFF, build target | Business logic, env validation | M0 |
| `vitest.setup.ts` | jsdom, MSW server lifecycle, `matchMedia` stub | Per-test fixtures | M1 |
| `playwright.config.ts` | One project, chromium, base URL, webServer command | Device matrix (desktop only, Q10) | M2 |
| `eslint.config.js` | **`import/no-restricted-paths` encoding the layering rules** | Formatting rules (Prettier owns those) | M0 |
| `.env.example` | `VITE_API_BASE`, `VITE_WAM_MODE` (`mock` \| `live`) | Secrets | M0 |
| `.gitignore` | Already exists; add `dist/`, `.env.local`, `test-results/` | — | M0 |

**Why the layering rules live in `eslint.config.js` and not in a document.** A document cannot fail a build. The five rules in `docs/architecture/application.md` §2 become five `no-restricted-paths` zones at M0, before there is any code that could violate them. Retrofitting this after 60 files is a week of import surgery.

---

## 2. The tree

```
src/
├── main.tsx                        boot: mount, providers, router
├── app/
│   ├── App.tsx                     provider tree + <RouterProvider>
│   ├── router.tsx                  every route, one file
│   ├── providers.tsx               QueryClient, ErrorBoundary, ThemeVars
│   ├── guards.tsx                  RequireAuth, RequireWorkspaceAccess
│   └── error/
│       ├── RouteError.tsx          route-level failure UI
│       └── NotFound.tsx            * route
├── shell/
│   ├── AppShell.tsx                rail + strip + outlet + panel grid
│   ├── AppShell.module.css
│   ├── FeatureBoundary.tsx         per-feature error boundary
│   ├── useTabs.ts                  tab set ↔ sessionStorage ↔ route
│   ├── rail/
│   │   ├── Rail.tsx
│   │   ├── Rail.module.css
│   │   ├── RailNavItem.tsx
│   │   ├── WorkspaceGroup.tsx      collapsible workspace section
│   │   └── WorkspaceSwitcher.tsx   scope badge, role, switch, create
│   ├── strip/
│   │   ├── ContextStrip.tsx
│   │   ├── ContextStrip.module.css
│   │   ├── RoomTabs.tsx            pinned, never closable
│   │   ├── ObjectTabs.tsx          closable, typed glyph, unsaved dot
│   │   └── TabOverflowMenu.tsx     appears after 8 tabs
│   ├── panel/
│   │   ├── ContextPanel.tsx        slot; features fill it
│   │   ├── PanelResizer.tsx        280–480 drag handle
│   │   └── ContextPanel.module.css
│   └── palette/
│       ├── CommandPalette.tsx      ⌘K
│       ├── useCommands.ts          command list from routes + actions
│       └── CommandPalette.module.css
├── layouts/
│   ├── WorkspaceLayout.tsx         workspace context + strip + panel slot
│   ├── NotesLayout.tsx             notes context, narrower panel
│   ├── SettingsLayout.tsx          settings nav + content
│   └── PlainLayout.tsx             Overview, Recently: no strip, no panel
├── features/
│   ├── overview/
│   │   ├── OverviewPage.tsx
│   │   ├── IntentInput.tsx
│   │   ├── ContinueRow.tsx
│   │   ├── NeedsYouRow.tsx
│   │   ├── WorkspaceCards.tsx
│   │   └── overview.module.css
│   ├── recently/
│   │   ├── RecentlyPage.tsx
│   │   ├── RecentRow.tsx
│   │   ├── TypeFilter.tsx
│   │   └── useRecent.ts
│   ├── files/
│   │   ├── FilesPage.tsx
│   │   ├── FileTree.tsx
│   │   ├── FileTable.tsx
│   │   ├── FilePreviewPage.tsx
│   │   ├── FilePanel.tsx
│   │   ├── useFiles.ts
│   │   └── files.module.css
│   ├── whiteboard/
│   │   ├── BoardsPage.tsx          board index, three cards + new
│   │   ├── BoardPage.tsx           board context, loads scene
│   │   ├── BoardPanel.tsx
│   │   ├── useBoards.ts
│   │   ├── canvas/
│   │   │   ├── Canvas.tsx          scene root, scale-to-fit
│   │   │   ├── CanvasViewport.tsx  pan/zoom container, wheel + space-drag
│   │   │   ├── SectionBox.tsx
│   │   │   ├── CardNode.tsx
│   │   │   ├── EdgeLayer.tsx       SVG paths + labels
│   │   │   ├── SelectionHUD.tsx
│   │   │   ├── Minimap.tsx
│   │   │   ├── ZoomDock.tsx
│   │   │   ├── CanvasToolbar.tsx
│   │   │   └── useCanvasGestures.ts  pointer state machine
│   │   └── board.module.css
│   ├── processes/
│   │   ├── ProcessesPage.tsx
│   │   ├── ProcessTable.tsx
│   │   ├── RunPage.tsx
│   │   ├── ControlBar.tsx          mirrors WAM capabilities
│   │   ├── useRuns.ts
│   │   ├── processes.module.css
│   │   └── bands/
│   │       ├── IntentBand.tsx
│   │       ├── PlanBand.tsx
│   │       ├── ActivityBand.tsx
│   │       └── OutputBand.tsx
│   ├── notes/
│   │   ├── NotesPage.tsx
│   │   ├── NoteList.tsx
│   │   ├── NoteReader.tsx
│   │   ├── NoteEditor.tsx          TipTap instance, save/409
│   │   ├── Outline.tsx
│   │   ├── NotesPanel.tsx
│   │   ├── useNotes.ts
│   │   ├── notes.module.css
│   │   └── extensions/
│   │       ├── ReferenceNode.ts    inline chip node: file / note / process
│   │       └── index.ts            extension array
│   └── account/
│       ├── AccountPage.tsx
│       ├── ProfileSection.tsx
│       ├── PlanSection.tsx
│       ├── UsageSection.tsx
│       ├── KeysSection.tsx
│       ├── PreferencesSection.tsx
│       ├── OrganizationSection.tsx
│       └── account.module.css
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── IconButton.tsx
│   │   ├── Input.tsx
│   │   ├── Popover.tsx
│   │   ├── Tooltip.tsx
│   │   ├── Divider.tsx
│   │   ├── Progress.tsx
│   │   ├── Skeleton.tsx
│   │   └── ui.module.css
│   └── content/
│       ├── TypeGlyph.tsx
│       ├── ScopeBadge.tsx
│       ├── StateChip.tsx
│       ├── EmptyState.tsx
│       ├── InlineError.tsx
│       ├── MeterRow.tsx
│       └── content.module.css
├── services/
│   ├── http.ts                     fetch wrapper, error normalisation
│   ├── queryClient.ts              defaults: staleness, retry policy
│   ├── auth/
│   │   ├── client.ts
│   │   └── useSession.ts
│   ├── wam/
│   │   ├── types.ts                WAM DTOs — never imported outside this dir
│   │   ├── client.ts               submit / getRun / act / capabilities
│   │   ├── stream.ts               subscribe: SSE, WS, or poll
│   │   └── map.ts                  DTO → Thylas domain types
│   ├── files/
│   │   ├── client.ts
│   │   └── upload.ts               signed URL flow, resumable
│   └── workspace/
│       └── client.ts
├── lib/
│   ├── ids.ts                      branded id types, parse/format
│   ├── routes.ts                   typed URL builders
│   ├── tabs.ts                     reconcile(set, activeRoute), add, close
│   ├── dates.ts                    Today / Yesterday / Earlier grouping
│   ├── format.ts                   bytes, credits, relative time
│   └── types.ts                    domain types: Workspace, File, Note, Board, Run
└── styles/
    ├── tokens.css                  @import of ../../design/tokens.css
    ├── base.css                    reset, body, focus ring, scrollbars
    └── utilities.css               max 10 classes
```

**File count:** 127 source files (`.tsx` / `.ts` / `.css`) — 1 entry, 6 `app`, 20 `shell`, 4 `layouts`, 60 `features`, 16 `components`, 11 `services`, 6 `lib`, 3 `styles`. Plus 9 root files. Tests and the conditional `server/` are counted separately.

**Why it is not more.** 20 of the 127 are `*.module.css` that exist only because the project does not use a utility framework (architecture §1.2). The 60 feature files are 9 screens plus a canvas of 10 parts; there is no per-feature `index.ts`, no `types.ts` per feature (domain types are in `lib/types.ts`), and no `constants.ts` anywhere.

---

## 3. Detailed responsibilities

Only the files where a reviewer would otherwise ask "why is this separate?". Everything else follows §4.

### 3.1 Application layer

| File | Responsibility | Must not contain | Depends on | Phase |
| --- | --- | --- | --- | --- |
| `main.tsx` | `createRoot(...).render(<App/>)`. Import `styles/base.css` and `styles/tokens.css`. Nothing else | Providers, router config, any conditional logic | `app/App`, styles | M0 |
| `app/App.tsx` | Compose `<Providers><RouterProvider router={router}/></Providers>` | Route definitions, layout markup | `providers`, `router` | M0 |
| `app/router.tsx` | **All 15 routes in one file**, each with its `element`, `errorElement`, and lazy import. Includes the two redirects and the `*` route | Loader logic, data fetching, auth checks (those are in `guards`) | `layouts/*`, `features/*`, `error/*` | M0 |
| `app/providers.tsx` | `QueryClientProvider`, `ErrorBoundary`, a `ThemeVars` component that does nothing yet (tokens are static) | Feature state, session fetching | `services/queryClient` | M0 |
| `app/guards.tsx` | `RequireAuth` (redirects with return path), `RequireWorkspaceAccess` (403 page, not an empty list) | Actual permission computation — it reads a flag the server returned | `services/auth` | M1 |
| `app/error/RouteError.tsx` | Renders the normalised error: what failed, retry, copy request id | Logging, telemetry wiring | `components/ui` | M0 |
| `app/error/NotFound.tsx` | 404 with a link to Recently | Search UI | `components/ui` | M1 |

**Why `router.tsx` is one file and not one `routes.tsx` per feature.** With 15 routes it fits on one screen and can be read as the product structure. The design plan's rule — *every visible sidebar row maps to a URL* — can only be checked by reading the list in one place. Splitting it into eight route fragments makes that check an eight-file audit and is how dead sidebar rows appear.

**Why `guards.tsx` is a separate file from `router.tsx`.** The guards are the only place where a redirect decision is made, and B1 says they are a courtesy, not a control. Keeping them in one 40-line file makes it obvious that they check a server-provided flag rather than compute access.

### 3.2 Shell

| File | Responsibility | Must not contain | Depends on | Phase |
| --- | --- | --- | --- | --- |
| `shell/AppShell.tsx` | The four-zone CSS grid: rail 240 / work / panel. Owns collapse and panel-width application from the UI store | Any feature content, any data fetching | `ui` store, `rail/*`, `strip/*`, `panel/*` | M0 |
| `shell/useTabs.ts` | **The only writer of the tab set.** `reconcile()` on route change, `open()`, `close()`, `reopenLast()`, persistence to `sessionStorage` keyed by user + workspace | Rendering, keyboard handling (that is in the strip) | `lib/tabs`, `lib/routes` | M1 |
| `shell/rail/Rail.tsx` | The five areas, the collapsible workspace group, profile row. Collapsed state = 56px icons | Workspace CRUD, feature data | `WorkspaceGroup`, `WorkspaceSwitcher`, `RailNavItem` | M0 |
| `shell/rail/WorkspaceSwitcher.tsx` | Scope badge, role, switch between workspaces the user can access, "new workspace". The one control that changes the URL's workspace segment | Permission checks, list fetching beyond `['workspaces']` | `services/workspace`, `content/ScopeBadge` | M1 |
| `shell/strip/ContextStrip.tsx` | Composes room tabs, divider, object tabs, overflow, and the panel toggle. One strip per context | Tab state mutation (delegates to `useTabs`) | `RoomTabs`, `ObjectTabs`, `TabOverflowMenu` | M1 |
| `shell/strip/RoomTabs.tsx` | Three pinned rooms; renders as plain text in the Notes context (no room tabs there — design plan §7.4 decision) | `×` affordance, any closing behaviour | `lib/routes` | M1 |
| `shell/strip/ObjectTabs.tsx` | Closable tabs: glyph, name, unsaved dot that becomes `×` on hover, active underline | Overflow logic | `useTabs`, `content/TypeGlyph` | M1 |
| `shell/panel/ContextPanel.tsx` | A `<div>` slot plus collapse; features render into it via a layout prop, not a context | Feature-specific content | `PanelResizer` | M1 |
| `shell/palette/useCommands.ts` | Builds the command list: navigate to each workspace/room, open recent objects, app actions. One array | Search ranking, semantic search | `lib/routes`, `services/*` | M4 |

**Why the panel is a slot and not a context.** A context provider would let any feature write into the panel from anywhere, which is how two features end up fighting over one surface. With a layout prop, the route owns the panel content and the ownership is visible in the route table.

### 3.3 Features — the parts that carry a decision

| File | Responsibility | Must not contain | Phase |
| --- | --- | --- | --- |
| `features/overview/IntentInput.tsx` | The one text input. Collects text + workspace + attached refs, calls `submit`, then navigates to the new run tab | Any interpretation of the text. No parsing, no suggestions from a model, no local intent classification | M3 |
| `features/files/FileTree.tsx` | Folders, indentation, counts (off by default, Q9), drag target | File rows, preview, selection | M2 |
| `features/files/FileTable.tsx` | Five columns, row selection, double-click to open, keyboard navigation | Upload, folder creation (toolbar owns those) | M2 |
| `features/files/FilePreviewPage.tsx` | A tab that renders PDF/image/text; unknown types get a download card | Editing, annotation | M2 |
| `features/files/useFiles.ts` | Query hooks: tree, list by folder, entity, upload mutation, move | UI state | M2 |
| `features/whiteboard/canvas/Canvas.tsx` | Scene root: fixed logical size, `scale(k)` fit, children positioned absolutely | Gesture handling (that is `useCanvasGestures`), data fetching | M3 |
| `features/whiteboard/canvas/useCanvasGestures.ts` | One pointer state machine: idle → panning → marquee → dragging. Escape returns to idle. Owns `pointerdown/move/up` | Rendering, selection policy (it emits selection, does not decide what is selectable) | M3 |
| `features/whiteboard/canvas/EdgeLayer.tsx` | Computes anchor points from card geometry and draws paths + labels in one SVG | Card rendering, layout | M3 |
| `features/processes/ControlBar.tsx` | Renders `capabilities()` ∩ `['pause','resume','stop','answer','approve','rerun']`. **Absent capability ⇒ absent button** | Disabled states standing in for missing capabilities | M4 |
| `features/processes/bands/ActivityBand.tsx` | Chronological steps, collapsible groups, artifacts inline as rows | Deriving status from steps (status comes from the run snapshot) | M4 |
| `features/notes/NoteEditor.tsx` | TipTap instance, block schema, save on idle 800ms, 409 diff dialog, `beforeunload` guard | Note metadata, scope changes, the list | M3 |
| `features/notes/extensions/ReferenceNode.ts` | An inline node: `{ kind, id, label }`, renders a chip, opens the target on click | Resolving the reference's current title (the label is stored at insert time and refreshed by a background query) | M3 |
| `features/account/UsageSection.tsx` | Plan name, meters, "what the last run cost". Displays returned numbers | Computing or enforcing quota (B3) | M5 |

### 3.4 Services

| File | Responsibility | Must not contain | Phase |
| --- | --- | --- | --- |
| `services/http.ts` | One `fetch`: base URL, `credentials: 'include'`, JSON, request id, normalise to `ApiError { kind, message, retryable, requestId }` | Retry policy (that is `queryClient`), any endpoint knowledge | M1 |
| `services/queryClient.ts` | Defaults from the architecture doc §6: staleness per key prefix, GET retry 2 / writes 0, refetch on focus | Hooks | M1 |
| `services/wam/types.ts` | The wire shapes. The **only** file that knows WAM field names | Domain logic, React | M1 (mock) |
| `services/wam/map.ts` | `WireRun → Run`, `WireArtifact → Artifact`. Tolerates missing optional fields | Fetching, caching | M1 |
| `services/wam/client.ts` | `submit`, `getRun`, `act`, `capabilities`. Cache `capabilities()` for the session | React state, event handling | M1 (mock) / M4 (live) |
| `services/wam/stream.ts` | One `subscribe(runId, cb)` with three implementations selected by `VITE_WAM_MODE`: SSE, WebSocket, poll. Reconnect with backoff, `Last-Event-ID` when available | Parsing domain events (it passes raw, `map.ts` converts) | M4 |
| `services/files/upload.ts` | Signed URL flow, chunked for >100MB, progress events, cancel | UI, retry UI | M2 |
| `services/auth/useSession.ts` | `['me']` query, sign-in redirect, sign-out, session expiry handling | Permission logic | M1 |

**Why `services/wam/types.ts` is a separate file rather than inline types in `client.ts`.** It is the file to delete when WAM's contract changes. Having one file that can be rewritten in an afternoon is the difference between an API change costing a day and costing a week. The rule — no other file imports it — is enforced by ESLint, not by review.

### 3.5 Lib

| File | Responsibility | Notes |
| --- | --- | --- |
| `lib/types.ts` | Domain types. `Run`, `Note`, `Board`, `File`, `Workspace`, `Scope`, `RunState` | Named to match `design/…plan.md` Appendix B. `Process` is the object, `Run` is one execution |
| `lib/ids.ts` | `type FileId = string & { __brand: 'FileId' }` plus constructors | Prevents passing a note id where a file id is expected — a real class of bug on a canvas with four id kinds |
| `lib/routes.ts` | `routes.workspace(id).files()`, `routes.notes.note(id)`. Every URL built here, never by string concatenation in a component | The route table and this file must change together; that is the point |
| `lib/tabs.ts` | `reconcile(set, activeTab)`, `addTab`, `closeTab`, `reopenStack`. Pure | Tested without React. This is where the "close a tab, do not lose the object" rule is actually implemented |
| `lib/dates.ts` | Today / Yesterday / Earlier this week / Older | Used by Recently and Notes |
| `lib/format.ts` | bytes, credits, relative time, pluralisation | — |

### 3.6 Styles

| File | Responsibility |
| --- | --- |
| `styles/tokens.css` | **One line: `@import '../../design/tokens.css';`** |
| `styles/base.css` | Reset, `body` on `--bg-app`, focus ring on `--accent`, scrollbar styling, `::selection` |
| `styles/utilities.css` | `.row .stack .center .fill .label .mono .truncate .hairline .gap-2 .gap-3` — ten, no more |

**Why `src/styles/tokens.css` imports from `design/` instead of the tokens moving.** `design/prototypes/hi-fi.html` links `../tokens.css` and the design plan cites it as the single source. Copying the file creates two values that drift; moving it breaks the prototype. A one-line re-export keeps one source and both consumers. At M6, when the prototype stops being maintained, the file moves into `src/` and the prototype references the built CSS.

---

## 4. Rules that replace ~50 table rows

These apply to every file not listed in §3. They are the reason the plan does not have a row per checkbox.

| Rule | Applies to |
| --- | --- |
| One `*.module.css` per component directory, imported only by that directory's components | All `features/**`, `shell/**`, `components/**` |
| Every `use*.ts` exports hooks only, returns `{ data, isLoading, error, actions }`, contains no JSX | `features/*/use*.ts` |
| Every `*Section.tsx` in `account/` is a pure presentational block that receives data as props | `account/*` |
| Every `bands/*.tsx` in `processes/` is read-only: it renders a snapshot, emits nothing | `processes/bands/*` |
| Feature pages (`*Page.tsx`) only compose: read params, call a hook, arrange children. If a page exceeds 150 lines it is doing work that belongs in a child | `features/**/*Page.tsx` |
| Components over 200 lines are split, unless the length is JSX for a table with distinct columns | All |
| No barrel files (`index.ts` re-exporting a directory), except `notes/extensions/index.ts` which is a plugin array | All |

---

## 5. Dependency graph

```
                    main.tsx
                       │
                     app/App
                    ┌──┴──┐
              providers  router ──────────────┐
                  │        │                   │
                  │     layouts/*         error/*
                  │        │
                  │   shell/AppShell
                  │    ┌───┼────────┬──────────┐
                  │  rail  strip   panel    palette
                  │    └───┴───┬────┘          │
                  │        useTabs              │
                  │            │                │
                  └────────────┴────────────────┘
                               │
                          features/*
                        ┌──────┴──────┐
                 components/content  services/*
                        │              │
                  components/ui    services/http
                        │              │
                     styles/*       lib/*
```

**Cycles that must not appear**, and what creates them in practice:

| Cycle | Created by | Prevention |
| --- | --- | --- |
| `features/notes` ↔ `features/files` | A note wanting a file picker; a file panel wanting backlinks | Both go through `components/content` + `services/*`. No direct import. ESLint zone |
| `shell` ↔ `features` | The rail wanting to show a run count | Rail shows a flag from a `['badges']` query owned by `services`, not by `features/processes` |
| `services/wam` ↔ `lib/types` | WAM map needing domain types, domain types importing wire types | `lib/types` imports nothing; `wam/types` imports nothing; only `map.ts` imports both |

---

## 6. Build order

Each milestone creates a complete slice, not a layer. The order is chosen so that the riskiest unknown (WAM's shape) is stubbed before it is needed and the largest unknown (canvas) is not on the critical path to a demo.

| Milestone | Files created | Running result | Gate |
| --- | --- | --- | --- |
| **M0 · Shell** | 25 src + 9 root = 34: `main` + `app/*` minus guards (5) + `shell/AppShell` (2) + `rail/*` (5) + `layouts/Plain` (1) + `components/ui` minus Skeleton (8) + `styles/*` (3) | Five rail areas navigate; nine routes render placeholder text; 1440×900 with no page scrollbar | `npm run dev` starts; clicking every rail row changes the URL and the view; ESLint passes with the layering rules on |
| **M1 · Tabs + session** | 27: `app/guards` + `shell/strip/*` (5) + `panel/*` (3) + `useTabs` + `FeatureBoundary` + `services` (7: http, queryClient, auth×2, wam/types, wam/map, wam/client) + `lib/*` (6) + `layouts` (3) | Tabs open, close, persist across reload; a mock run renders; 401 redirects | Reload restores the strip; closing an object tab returns to the room index; a mocked 500 shows the route error, not a blank screen |
| **M2 · Files + Recently** | 21: `features/files/*` (7) + `features/recently/*` (4) + `components/content/*` (7) + `files/client` + `files/upload` + `workspace/client` | Upload, list, preview, select; panel follows selection; Recently lists what was touched | A 20MB PDF uploads with progress and survives reload; double-click opens a tab; deleting the file closes or tombstones the tab |
| **M3a · Notes** | 10: `features/notes/*` (8) + `extensions/*` (2) | Write a note, reference a file | Note survives reload; a reference chip opens the file; 8,000 words keep keystroke latency under 16ms |
| **M3b · Board** | 15: `features/whiteboard/*` (5) + `canvas/*` (10) | Pan/zoom a board, move a card, draw an edge | 60 cards hold 30fps while panning (design plan §8.2 floor); edges follow moved cards; Escape returns to idle |
| **M4 · Processes live + Overview** | 20: `features/processes/*` (10) + `features/overview/*` (6) + `wam/stream` + `shell/palette/*` (3) | Submit an intent, watch state change, see an artifact land | A real run reaches `succeeded` with no manual refresh; a missing capability removes the button; an artifact appears in Files with `produced_by` |
| **M5 · Account** | 8: `features/account/*` | Plan, usage, keys, preferences | Numbers match the metering service exactly; nothing is computed locally |
| **M6 · Production** | 1: `components/ui/Skeleton` (added late, tuned here) + fixes in existing files | — | Lighthouse ≥ 90 on the shell; keyboard-only path through J1 and J4; no console errors on any route |

**Total: 127 source files + 9 root files.** Overview and Recently are not "shell" work: both need real data (a run, a file) before they can be anything but a mock, which is why they land in M4 and M2 rather than M0.

---

## 7. Files deliberately not created

Each of these is a plausible-looking file that would be written by default. Naming them is cheaper than rejecting them in review later.

| Not created | What would go in it | Why not |
| --- | --- | --- |
| `src/store/index.ts` (global store) | Current workspace, open tabs, selection, panel state | Navigation in a store duplicates the URL (architecture §3). The remaining transient state is two small Zustand slices created where they are used |
| `src/features/search/` | A search page, results, filters | Search is the palette, which overlays. A search *page* implies search is a destination, and the capability model has no such activity |
| `src/lib/permissions.ts` | `canEdit(user, workspace)` | B1: authorization is checked by the resource owner at execution. A client-side permission module becomes the place where the real check is forgotten |
| `src/api/generated.ts` | A typed client generated from OpenAPI | No schema exists. A generated file that is hand-maintained is worse than a hand-written one |
| `src/components/ui/Table.tsx` | A generic table with column config | Three lists (files, processes, recently) have different behaviours: row height, keyboard model, selection semantics, sticky headers. A generic table grows 14 props and gets forked anyway |
| `src/hooks/` | `useAuth`, `useDebounce`, `useLocalStorage` | The first two belong to `services/auth` and `lib`; a `hooks/` directory with three files becomes the place everything goes |
| `src/features/tools/` or `services/` | A catalogue of available tools/models | Tool selection is WAM's. A catalogue in Thylas duplicates `capabilities()` and will drift |
| `src/i18n/` | A translation layer | v1 is English-only. It is not free: Chinese typography needs different line-heights, punctuation, and a serif that has CJK coverage. Adding it later is a `t()` sweep, not an architecture change. **[?]** confirm the language requirement before M3 |
| `server/` | A BFF | Conditional on N5. If it exists it is one file, `server/index.ts`, at M4, not a directory |
| `src/features/overview/StatsCards.tsx` | Counts, trends, a chart | The Overview's job is orientation. This is the first file a SaaS-minded contributor adds and the one the product definition rejects (§5.1) |
| `src/lib/analytics.ts` | Event tracking | No analytics requirement exists. When it does, it is one file and it does not belong in `lib` |

---

## 8. Conventions

| Thing | Convention | Example |
| --- | --- | --- |
| Component files | `PascalCase.tsx`, one component per file, named export matching the filename | `export function FileTable()` |
| Hooks | `useThing.ts`, camelCase, one hook family per file | `useFiles.ts` |
| CSS Modules | Same basename as the directory's primary component, kebab-case class names | `.file-table` |
| Domain types | `lib/types.ts`, one place. No `interface Props` sharing across features | `type RunState` |
| Ids | Branded, constructed only in `lib/ids.ts` | `asFileId(raw)` |
| Route paths | Built by `lib/routes.ts`, never by template literals in components | `routes.workspace(wsId).file(fileId)` |
| Test files | Beside the source, `*.test.ts(x)`; e2e in `e2e/` at the root | `lib/tabs.test.ts` |
| Query keys | Array factories exported from the feature's hook file | `filesKeys.list(wsId, folderId)` |

---

## 9. What the first commit contains

M0 only. Nine root files plus 25 source files: `main.tsx`, `app/*`, `shell/AppShell`, `shell/rail/*`, `layouts/PlainLayout`, `components/ui`, `styles/*`.

It is a demoable shell with placeholder screens and no data. That is the correct first commit: it proves the four-zone layout holds at 1440, it proves the router covers every sidebar row, and it makes the layering rules enforceable before there is anything to violate them.
