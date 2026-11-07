# Decisions

Every deviation from the brief, from `docs/architecture/tech-stack.md`, or from an earlier plan. A decision is only "accepted" when the founder says so; until then it is in force because it is reversible and cheap to argue with.

Format: **status · context · decision · alternative · consequence**.

---

## D-001 · Keep the Vite SPA; do not adopt Next.js App Router

**Status:** accepted (in force since commit `2171d90`; brief's table contradicts it).
**Context:** the brief's stack table names Next.js App Router; the repo is a working Vite SPA (41 files, 15 routes, 8 surfaces), and `tech-stack.md` (2026-11-07) rejects Next on three grounds: no public surface, RSC creates a second authorisation path, and the canvas/editor are client islands.
**Decision:** keep Vite + React 19. Router upgraded to `react-router` 8 when the founder approves (T1 in `tech-stack.md`).
**Alternative:** re-platform to Next. Cost: rewrite `app/`, `shell/`, 15 routes, all page CSS; no product capability gained.
**Consequence:** no SSR. If marketing pages or SEO ever need the same codebase, that is a separate app, not a migration of this one.

## D-002 · Notes use CodeMirror 6, superseding Tiptap in ADR-008

**Status:** proposed (needs founder sign-off; changes one dependency).
**Context:** `tech-stack.md` chose Tiptap 3 for a block schema; the new brief makes Notes **Markdown-first** with wikilinks and backlinks (Obsidian model). In a Markdown-first product the document *is* the text; a block editor imposes a schema on it.
**Decision:** CodeMirror 6 with a Markdown language extension, `[[wikilink]]` decoration, and a derived backlink index. Documents reuse the same editor with a reading preset.
**Alternative:** Tiptap 3 (named in ADR-008). Better for rich blocks, worse for Markdown fidelity and for link syntax the user types.
**Consequence:** no block-level schema; formatting is Markdown; the reference-chip pattern becomes `[[...]]` plus a rendered preview. Smaller bundle than ProseMirror+Tiptap and a simpler save path.

## D-003 · Whiteboard stays custom DOM+SVG; tldraw is not adopted for the board

**Status:** accepted.
**Context:** brief lists tldraw "subject to validation"; `tech-stack.md` ADR-009 rejects it for a structured board; `HeptaBase RE/Plan/06` documents exactly which engine behaviours matter (pointer-anchored zoom, one pointer state machine, hit areas compensated by zoom, anchors on hover, edge labels above cards).
**Decision:** keep the custom scene model, rebuild the interaction layer to that bar in SP-06.
**Alternative:** tldraw 5.6 — freehand-first, own visual identity, licence terms to verify; it would fight the board's card/section/live-binding model.
**Consequence:** we own hit-testing, snapping, undo. The HeptaBase measurements (150 cards, P95 43 ms in *their* implementation) are the bar, not a guarantee.

## D-004 · Keep the hand-drawn icon set; do not adopt Lucide yet

**Status:** accepted (revisit in SP-09).
**Context:** brief lists Lucide; the app has 21 icons at 16px/1.2px stroke, which is the brand's geometry. Lucide defaults to 2px, 24px grid.
**Decision:** keep the local set; if an icon is missing, draw it in the same geometry. Adopt Lucide only if the set exceeds ~40 icons or a11y/consistency argues for a standard set with a stroke override.
**Alternative:** Lucide everywhere + `strokeWidth={1.2}` + size overrides. One dependency, a second geometry risk.
**Consequence:** ~20 minutes per new icon; no second visual language.

## D-005 · No Supabase (or any backend) in this MVP

**Status:** accepted.
**Context:** brief says "Supabase where required"; nothing in the MVP requires persistence beyond the browser, and auth/authz ownership is unresolved (`N2`).
**Decision:** local persistence (`localStorage`/`sessionStorage`) for notes, boards, drafts, preferences. Mock data for files and processes.
**Alternative:** stand up Supabase for notes → introduces an auth model that would then conflict with CHORD's IdP.
**Consequence:** everything is single-device and labelled as such in the UI. Migration to a real API is the `services/` seam, not a rewrite.

## D-006 · DeepSeek goes through a local Node middleware now, a real server later

**Status:** proposed.
**Context:** the brief forbids exposing keys in browser code and forbids fabricating backend functionality. A static SPA has no server.
**Decision:** add `server/ai.ts` (Vite dev middleware + `vite preview` plugin) exposing `POST /api/ai`. The key comes from `DEEPSEEK_API_KEY`; absent key ⇒ the endpoint returns a typed "not configured" error that the UI renders honestly. The client never sees a key.
**Alternative:** call DeepSeek from the browser (forbidden); skip AI (fails acceptance #8).
**Consequence:** the MVP AI path is real but local-only. Production needs a host; that is one file plus deployment, not an architecture change.

## D-007 · `plan/` is retired; subplans supersede it

**Status:** accepted.
**Context:** `plan/` (12 files, 20-day sweep) was written before Notes/Whiteboard/AI were in scope. Keeping both programs would guarantee drift.
**Decision:** `docs/development/ui-mvp/` is the program of record. The parts of `plan/` that still apply (shell typing, tab overflow, states, honesty, verification) are carried into SP-00…SP-04 and SP-09; `plan/` is deleted in the same commit.
**Consequence:** one plan, one progress file. Line-level anchors from `plan/` live on in the subplans that absorbed them.

## D-008 · Mock data must be labelled per surface, not in a footnote

**Status:** accepted.
**Context:** brief requires mocked functionality to be distinguishable.
**Decision:** every surface backed by mock/local data carries one visible line stating so (already the pattern: palette footer, board header, file sheet). The AI panel states "dev endpoint".
**Alternative:** a global banner — becomes wallpaper and stops being read.
**Consequence:** slightly more copy; no ambiguity about what is real.

## D-009 · Router 8 migration is queued, not done silently

**Status:** needs founder approval (T1 in `tech-stack.md`).
**Context:** v8 removes `react-router-dom`, requires ESM + React ≥19.2.7 (both satisfied).
**Decision:** do it as one isolated commit before SP-03 (which depends on routing semantics), with the tab suite as the gate.
**Alternative:** stay on 7.18.5 (patched). Nothing in the MVP depends on v8 APIs.

## D-010 · TanStack Query, Zod and Radix stay off until a trigger fires

**Status:** accepted.
**Context:** brief lists all three; there is no network and no overlay beyond the palette.
**Decision:** Query at the first real endpoint (SP-07's AI result is a single request, not a cache), Zod at the same boundary, Radix only if a dialog/menu lands that the local primitives cannot carry accessibly.
**Consequence:** fewer dependencies; the seams exist (`services/`, `components/ui`).

## D-011 · Tests are Vitest + a real-browser suite driven by CDP/Playwright

**Status:** accepted.
**Context:** the repo already has a 16-assertion CDP script in `.workbuddy/tmp` that runs headless Chrome; brief wants Playwright.
**Decision:** Vitest for pure logic (tabs, routes, markdown link parsing); Playwright for the three user paths once SP-01 stabilises. Until then the CDP script is the regression net and is committed in SP-00.
**Consequence:** no test runner in the MVP build path until SP-00 adds Vitest; the E2E harness starts its own server, so it works from a clean clone.

## D-012 · Overview's intent input does not pretend to reach an agent

**Status:** accepted.
**Context:** WAM is deferred; DeepSeek is a completion API, not a planner.
**Decision:** the input is real (state, validation, keyboard), and until SP-07 it is `disabled` with a reason. In SP-07 it sends to `/api/ai` and renders a completion, labelled "DeepSeek · dev endpoint". It never claims to start a process.
**Consequence:** no false affordance; the AI path is honest about being a completion, not a run.

**Clarified in SP-02 (2026-11-07):** "it is disabled" means the **Start control**, not the field. The field stays editable and keeps typed text; Start is disabled with `title` + `aria-describedby` pointing at a persistent reason line. See D-017.

## D-016 · Two-level planning: parents keep the spec, units do the work

**Status:** accepted.
**Context:** the first decomposition produced ten subplans, four of which were 1.5–5 days of work with a single acceptance list. That hides the work: "SP-06 Whiteboard, 5 days" cannot be started, finished or reviewed — it can only be attempted.
**Decision:** split the remaining parents into 16 units of ≤ 1.5 days (`subplans/SP-0Xx-*.md`). Parents keep UX/visual/technical specification; units carry tasks, acceptance and validation, and name the parent section they implement. `subplans/INDEX.md` is the canonical list; `PROGRESS.md` tracks units.
**Alternative:** keep ten subplans and use their §G task tables as the unit of work (rejected: the task tables have no acceptance of their own, so "done" stays a judgement).
**Consequence:** more files, one more indirection when reading; in exchange every commit maps to a unit whose acceptance can be checked, and a unit that overruns is visible after a day rather than after a week.

## D-013 · Browser-reserved shortcuts are not bound

**Status:** accepted (found during SP-01).
**Context:** the interaction contract proposed `⌘W` to close a tab and `⌘⇧[`/`]` to cycle. Chrome consumes all three before the page sees them.
**Decision:** no binding. Tabs close through their control, cycling goes through the palette, and the contract's keyboard table is updated rather than silently ignored.
**Alternative:** `⌥W`/`Ctrl+Alt+…` — invents a private protocol nobody guesses.
**Consequence:** keyboard users need one extra stop per close; the contract no longer promises a shortcut the browser owns.

## D-014 · Tab overflow count is measured, not fixed

**Status:** accepted (SP-01).
**Context:** "overflow after 8" was a guess from the prototype. At 1280 with the rail open, eight tabs did not fit, so the strip scrolled — the exact failure the rule was meant to prevent.
**Decision:** `ResizeObserver` on the strip computes a limit between 3 and 8; hidden tabs go to `+N`; the active tab is rotated into view.
**Consequence:** the strip never scrolls, the count changes with viewport and rail state, and two measurement bugs (content-width feedback, menu clipping) are documented in SP-01's result.

## D-015 · Roving tabindex deferred

**Status:** accepted, revisit in SP-09.
**Context:** the contract proposes one Tab stop for the rail. Implementing roving across a dynamically expanded workspace list is easy to half-finish — a `tabIndex` that changes without focus following makes Tab look broken.
**Decision:** ship arrow-key traversal (`↑↓ Home End → ←`) with native tab order; revisit in the a11y sweep with a test.
**Consequence:** Tab through the rail takes up to a dozen presses until SP-09.

---

## D-017 · Start is disabled regardless of the text

**Status:** accepted in force (SP-02); supersedes the "disabled until text" wording in SP-02 §D.
**Context:** the interaction contract §6 requires the reason to be visible *before* the click, and classifies a service-missing submit as "render the control disabled with `title`". Enabling Start once the field has text would create exactly the fake control the audit set out to remove: a button that looks available and does nothing.
**Decision:** field editable, Start `disabled` at all times, one persistent caption ("Submission needs the WAM service — not connected in this build. Nothing is sent."), no `sent` state, no post-click banner. SP-07a/07b enable it when there is a real endpoint.
**Alternative:** enable on text and show a persistent (not post-click) reason. Rejected: the button still has no behaviour, so its enabled state is a claim the app cannot keep.
**Consequence:** the reason is announced with the field via `aria-describedby`; a disabled button is not a Tab stop, so "Tab to Start" in SP-02 §I is replaced by a DOM assertion on `disabled` + `aria-describedby`. The Overview has no accent of its own until SP-07 — accent is a state marker, not decoration.

## D-018 · The 6px index tick is a shared primitive, not a page style

**Status:** accepted in force (SP-02).
**Context:** SP-02 §E asked Overview section labels to use `grammar.label`, but `SectionLabel` is shared and `grammar.module.css` had no consumer. Copying the tick into `overview.module.css` would have created a second visual language on the other eight surfaces.
**Decision:** `ui.module.css .sectionLabel` composes `grammar.label`; `SectionLabel` gains no new prop. The tick now appears on every surface that uses the shared label.
**Alternative:** per-page tick (rejected: nine copies), or adding a `tick` prop to `SectionLabel` (rejected: a brand constant is not a per-call option).
**Consequence:** one CSS Modules `composes` dependency from `components/` to `styles/`; verified by build and by Files/Notes/Overview screenshots. The grammar file's header now says which recipes remain for SP-04.

## D-019 · The settings route is deleted, not stubbed

**Status:** accepted in force (SP-03b).
**Context:** `routes.workspaceSettings` and the `'settings'` tab type existed, but no router element, no link and no surface ever produced one. SP-03b T4 allowed "ship a minimal surface or delete the route".
**Decision:** delete the builder and the tab type. `workspaceRoom` has no settings case; a path to it falls back to Files.
**Alternative:** ship a placeholder settings page. Rejected: it would be a control with no behaviour and would need a sidebar row nobody asked for.
**Consequence:** acceptance §4 of SP-03b is verified by two static checks (router children and route module contain no `settings`). If a real settings surface is needed, it is a later decision with its own scope.

## D-020 · Scroll restoration is one shell component with named regions

**Status:** accepted in force (SP-03b).
**Context:** SP-03b §F proposed a `useScrollRestore` hook called by each list surface in `useLayoutEffect`. Five surfaces would repeat the same save/restore lifecycle, and index-based keys would drift when the panel opens or closes.
**Decision:** `shell/ScrollRestoration.tsx` owns a capture-phase scroll listener and one layout effect; surfaces only add `data-scroll-region="name"`. Offsets live in `lib/scroll.ts` (memory + sessionStorage v2).
**Alternative:** a hook per page. Rejected: duplicated lifecycle, five places to get the timing wrong.
**Consequence:** adding a scrollable list is one attribute, and no page imports a scroll hook. The board canvas is not yet a region — SP-06 owns its viewport.

## D-021 · A deleted object has exactly one owner: its tab

**Status:** accepted in force (SP-04b).
**Context:** SP-04b §F proposed adding a tombstoned file to `data/mock.ts` to demonstrate the state. That creates two dismissal owners (a row flag and a tab flag), invents a delete action with no service, and can leave an orphan tab.
**Decision:** Files derives tombstone rows from `tabs['ws:<id>']` entries that reconcile marked `missing`. The panel's Dismiss and the tab's close both call `closeObjectTab`; one action removes the row and the tab together. No sample data was added.
**Alternative:** a `deleted?: boolean` field on `FileItem` plus local row-dismissal state. Rejected: two truths, and a control that looks like deletion but is not.
**Consequence:** a tombstone appears only for an object that was actually open, which is the honest condition. A file deleted while no tab was open simply is not listed — nothing was lost from the user's working set.

## D-022 · A missing service gets a quiet limit line, not an accent banner

**Status:** accepted in force (SP-04b).
**Context:** `grammar.banner` is accent-tinted and was written for transient failures. Files needed a permanent sentence explaining why Upload and New folder are unavailable.
**Decision:** add `grammar.limit` — one 1px rule, the 6px index tick, `--ink-2` text, no accent. Disabled controls carry `title` + `aria-describedby` pointing at it. The post-click notice state and its banner are deleted.
**Alternative:** keep `grammar.banner` for the reason. Rejected: a permanent terracotta strip on the most-used surface is neither quiet nor a state marker.
**Consequence:** one more recipe in the grammar file; the three remaining page-local `.notice` recipes (account, boards, processes) still use accent and are owned by SP-06/07/08.

## D-023 · SP-06a ships the store, not the wiring

**Status:** accepted in force (SP-06a).
**Context:** the unit asks for a versioned board schema and a local adapter. It also promises "no user-visible change". Wiring `BoardStore` into `BoardDetailPage` would mean the board suddenly saves (or fails to save) with no editing UI — a claim the interface cannot yet make.
**Decision:** `store.ts` is complete and unit-tested, but `BoardDetailPage` still reads the sample boards. SP-06b/c connect load/save alongside the gestures they justify.
**Alternative:** wire it now and show a "saved" indicator. Rejected: no write action exists yet, so the indicator would be a fake success state.
**Consequence:** "persistence works" is true only of the module, not of the product. This line exists so nobody reads the unit as delivered persistence.

## D-024 · One numeric source for scene size, including the coincidental ones

**Status:** accepted in force (SP-06a).
**Context:** four page stylesheets each declared `max-width: 560px`, a value that happens to equal the board scene height. Acceptance §4 requires no `1032|560` outside `scene.ts`; changing four unrelated layouts by eye would have been worse than leaving the grep dirty.
**Decision:** inject scene size as CSS variables on the canvas container and collapse those four widths into `--w-sheet: 35rem` (still 560px computed, and now reader-font-relative).
**Alternative:** narrow the acceptance grep to the boards scope and leave four duplicates. Rejected: the duplicates were a real inconsistency, and a literal gate is cheaper to keep honest.
**Consequence:** custom properties only inherit downwards, so the variables must be injected on the container that owns the dot grid. Injecting on `.scene` removed the grid; the before/after screenshot md5 caught it.

## D-025 · The viewport commits imperatively, never through React state

**Status:** accepted in force (SP-06b).
**Context:** the plan allowed the viewport to be committed to React state once per animation frame. Even one render per frame re-renders every card, which is the second measured engine bug in the reference (150 cards: P95 43ms).
**Decision:** `view` is a ref; wheel and pointer handlers mutate it synchronously and schedule one `requestAnimationFrame`. The frame writes four DOM properties (`scene.transform`, `stage` size, grid size/position, dock label). A no-dependency `useLayoutEffect` re-applies the same ref after any unrelated render.
**Alternative:** one `setState` per frame. Rejected: it satisfies "at most once per frame" but still re-renders the whole scene, and acceptance #3 explicitly forbids it.
**Consequence:** viewport state is not visible to React DevTools and cannot drive JSX. Anything that needs the zoom value must read the dock label or the scene transform. Measured: 0 card mutations during wheel pan, 150-card P95 16.7ms.

---

## Open questions (need a human, not a default)

| # | Question | Blocks | Default until answered |
| --- | --- | --- | --- |
| Q-1 | D-002: is CodeMirror 6 approved over Tiptap? | SP-05 dependency list | CodeMirror |
| Q-2 | D-006: acceptable that AI works only against a local dev server? | SP-07 acceptance | yes, labelled "dev endpoint" |
| Q-3 | Documents as a separate surface, or Notes only? | SP-05 scope | Notes only |
| Q-4 | Is board persistence in `localStorage` acceptable for the MVP? | SP-06 | yes, one board per workspace |
| Q-5 | Router 8 now or after the MVP? | SP-03 | after SP-02, as its own commit |
