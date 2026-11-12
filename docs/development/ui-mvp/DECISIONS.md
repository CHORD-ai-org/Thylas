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

## D-026 · Card height is measured, not assumed

**Status:** accepted in force (SP-06c).
**Context:** `BoardScene` needed a height for hit testing and snapping, so SP-06a wrote `h: CARD_DEFAULT_H` (96) into every card. Rendering that as `min-height` made c-5 grow over c-6 and put c-5's resize handle under c-6 — the handle was simply unreachable (found by a CDP probe that logged the pointer target).
**Decision:** `h: 0` means "content-sized". Cards are laid out by their own text; gestures read `offsetHeight` for every card **once per pointer session** into a map, and clamp/drag/resize use that map. A resize writes a real number, which pins the card from then on.
**Alternative:** measure on every pointer move. Rejected: 150 forced layouts per frame. **Alternative:** keep a fixed 96px card. Rejected: it silently clips a live card's extra row.
**Consequence:** geometry can never assume `h > 0`; `rectOf` always takes a height reader. The measurement is taken at pointerdown, so a card that reflows mid-drag (it cannot, no text is edited during a drag) would be off by the difference.

## D-027 · Snap is resolved continuously and applied once, on release

**Status:** accepted in force (SP-06c).
**Context:** SP-06c §UX: "dropping a card within 6px of a neighbour's axis snaps once; there is no magnetic pull while moving". A pull that fights the pointer is the documented failure mode.
**Decision:** every `pointermove` computes `snapMove` against the selection's bounding box and writes the resulting guide line, but the card itself follows the raw delta. `pointerup` applies `dx + snap.dx`, so the drop lands aligned in one step. Only one snap per axis, and only within 6px.
**Alternative:** correct the position live. Rejected: the card would jump ±6px under the cursor, and a drag through a dense area would feel ratcheted.
**Consequence:** the guide can show while the card is up to 6px away — that gap is the point, and it is why the guide is drawn at the *target* line rather than at the card edge.

## D-028 · One command path for every edit, and undo clears the selection

**Status:** accepted in force (SP-06c).
**Context:** drag, resize, delete, create, retitle and keyboard nudges all change the scene. After deleting a card, an undo that restores it while it is still "selected" hides the fact that it came back.
**Decision:** every mutation is a `CardEdit` applied by `applyEdit(scene, edit, 'do' | 'undo')`; the stack holds 50 edits and pushes on release, never per move. Undo and redo clear the selection.
**Alternative:** snapshot the whole scene per edit. Rejected: 150 cards × 50 states of JSON, and it makes "which property changed" unknowable.
**Consequence:** delete-undo restores the original z-order because the edit carries card indexes. The cleared selection is visible in the status bar, which drops back to "No selection".

## D-029 · Card edits persist locally; the viewport still does not

**Status:** accepted in force (SP-06c), under Q-4's default ("localStorage is acceptable for the MVP").
**Context:** Q-4 asked whether board persistence in `localStorage` is acceptable. SP-06a built the versioned store but wired nothing. Q-4's remaining open half is the *viewport*: a saved zoom/pan changes what the next visit looks like, and no one has approved that.
**Decision:** the card scene is written to `thylas:board:v1:<id>` (300ms debounce, `pagehide` flush, quota failure falls back to memory with one console warning). `BoardScene.viewport` is still never read: on load the canvas calls `fit()`, so every visit starts at 100%. "Reset to sample" removes the stored key.
**Alternative:** persist everything the schema holds. Rejected: it makes Q-4 answer itself.
**Consequence:** the header says "edits are kept in this browser" — not "saved", because there is no service and no other device. A reload does not preserve where you were looking.

## D-030 · Sections are frames that own membership by geometry; the capsule is the only handle

**Status:** accepted in force (SP-06c second pass).
**Context:** The board needed the reference's section frames: a tint, a pill with a count, a fold. If a section's body were draggable, a marquee could never start inside one, and a card dropped into a section would drag the whole frame.
**Decision:** a card belongs to the section whose rect holds its centre, recomputed by `reframe()` after every edit — membership is never a separate field to keep in sync. Only the pill drags the frame; the frame's body belongs to the canvas.
**Alternative:** an explicit `sectionId` written on drop. Rejected: it goes wrong the moment a section is resized or a card is dragged out by its corner.
**Consequence:** a card can change section without any command saying so; the counts follow. Deleting a frame keeps its cards, because they only lost their tint.

## D-031 · Snap resolves against frames as well as cards

**Status:** accepted in force (SP-06c second pass).
**Context:** D-027 snaps a drop to a neighbour's axis. With frames on the board, the axis a reader wants is often the frame's edge, not a card's.
**Decision:** `snapMove` is given cards and sections that are not being moved, in one list. A guide may therefore land on a frame edge, and the drop aligns to it.
**Alternative:** cards only. Rejected: dropping a card flush inside a frame then became impossible without pixel-hunting.
**Consequence:** a card inside a frame is 4px from its own frame's mid axis at rest, so a small drag pulls it onto that axis. That is a feature, and it is why the e2e drags 41px rather than 5px to test a free move.

## D-032 · Grips and link dots are screen-sized, not scene-sized

**Status:** accepted in force (SP-06c second pass).
**Context:** Handles lived inside the scaled scene, so at the fitted 56% they were 4px targets, and at 400% they were 32px blobs.
**Decision:** the viewport writes `--hud-shrink` (`1 / zoom`) on the scene element on every commit; `.handles i` and `.anchors i` scale by it. Zoom never re-renders React, so the value is written imperatively beside the transform.
**Alternative:** compute sizes in React from a `zoom` state. Rejected: it would re-render 150 cards per wheel tick, and it goes stale exactly like the status bar did (R21).
**Consequence:** the link dot's target is widened by a pseudo-element that grows *outwards only* — an inwards ring put the card's own header inside a connection target and swallowed the click (R27).

## D-033 · The edge bar is docked above the status line

**Status:** accepted in force (SP-06d).
**Context:** The bar for a selected edge floated 40px above the line's midpoint. The midpoint of a short edge sits near a card, so the bar covered that card's title row — and its buttons ate the click, so the card could not be selected at all (measured: `status` stayed `Edge · …`).
**Decision:** the bar is fixed at the bottom centre of the canvas, 56px above the status line. Shape, arrows and delete stay in it.
**Alternative:** keep it near the line and clamp it away from cards. Rejected: it needs a collision test against every card on every pan, for a bar that only exists while an edge is selected.
**Consequence:** the bar no longer points at the edge it edits; the accent line and the right panel do that job. Copy is fixed: `Edge · <from> → <to>` in the status line.

## D-034 · The edge hit width is compensated by hand

**Status:** accepted in force (SP-06d).
**Context:** The spec asks for a 24px target at 10% and 400%. `vector-effect="non-scaling-stroke"` makes the *rendering* constant but Chromium's hit test still multiplies by the scene scale: measured half-widths were 6px at 56% and 12px at 100% with the attribute applied.
**Decision:** the hit path keeps a transparent stroke of `calc(24px * var(--hud-shrink))`, so `width × zoom` is 24 at any zoom. The visible line keeps `non-scaling-stroke`, so a hairline stays a hairline.
**Alternative:** an invisible `<rect>` per edge. Rejected: it cannot follow a curve.
**Consequence:** measured 12px half-width at 56% and at 100%; the e2e asserts 9px off the line still hits and 20px off does not.

## D-035 · Edge labels are drawn above cards but stay inert

**Status:** accepted in force (SP-06d).
**Context:** The spec wants labels clickable. Making the chip take pointer events made cards underneath unclickable — the first card in the e2e lost its selection to a chip lying over its header.
**Decision:** the label layer stays `pointer-events: none`. The chip is 18px tall and the line passes through its middle, so the line's 24px band covers the whole chip: clicking the label selects the edge without the chip ever intercepting.
**Alternative:** make the chip clickable only when it does not overlap a card. Rejected: the overlap is a rendering fact, not a hit-test hint, and it would flicker as cards move.
**Consequence:** where a card covers a chip, the card wins — the honest outcome. A label on a bent edge (where the line leaves the chip's middle) is only clickable along the line.

## D-036 · A context menu speaks for the selection, not for the object under the cursor

**Status:** accepted in force (SP-06c second pass).
**Context:** Right-clicking inside a three-object selection kept the selection (correct) but offered `Edit card` (opens the first card, not the clicked one) and `Duplicate` / `Delete` that then acted on all three.
**Decision:** single-object items appear only when exactly one object is picked, and the labels carry the count: `Duplicate 3`, `Delete 3`. A right-click on an unselected object selects it first.
**Alternative:** collapse the selection to the clicked object. Rejected: a right-click inside a set is how a reader asks "what can I do with these".
**Consequence:** the menu has three items on a set, five on a single card, four on a frame; the e2e asserts the set case and the single case.

## D-037 · The AI endpoint answers with gateway statuses, not 4xx

**Status:** accepted in force (SP-07a).
**Context:** A rejected key, an unreachable host and a 500 from DeepSeek are all failures *behind* the endpoint. Passing 401/403/500 through would tell a browser its own request was unauthorised or malformed, and any generic fetch wrapper would branch on the wrong thing.
**Decision:** only `contract` is a 4xx (400; 405 for a non-POST). `not_configured` is 503, `rate_limited` is 429 — the caller really is being throttled, just not by us — `timeout` is 504, and `unauthorized` / `network` / `upstream` are 502.
**Alternative:** mirror the upstream status. Rejected: a server-side key problem would then look like a client authorisation problem, and the reader would be pointed at the wrong fix.
**Consequence:** a proxy in front sees a gateway error, which is accurate. The `kind` field, not the status, is what a surface branches on.

## D-038 · The upstream timeout can be shortened by an env var, for checks only

**Status:** accepted in force (SP-07a).
**Context:** The timeout branch has to be proven over the wire, but waiting 30 s for it makes the check something nobody runs. A unit test with a fake clock proves the mapping, not the wiring.
**Decision:** `DEEPSEEK_TIMEOUT_MS` overrides the 30 s default. `.env.example` documents it as a check-time knob; `scripts/ai-checks.mjs` sets 1500 and asserts the answer lands between 1.3 s and 6 s.
**Alternative:** inject a clock into the middleware. Rejected: that edits the thing under test and would never exercise `AbortSignal.timeout`.
**Consequence:** one more variable that could be mis-set and cut real answers short. It only affects the local server, and the default stands when it is absent.

## D-039 · The ask surface learns the configuration before it offers to ask

**Status:** accepted in force (SP-07b).
**Context:** Acceptance 2 wants the send control disabled with the variable named. The browser cannot read `DEEPSEEK_API_KEY`, and the only other way to learn it is to fail a request — which is the "click, then apologise" pattern the earlier defects are about.
**Decision:** `GET /api/ai/status` returns `{ configured, model }`; the page reads it once on mount. A `null` answer — no middleware, offline, a static host — means "cannot tell" and leaves the control **enabled**, so the reader gets a network error with a message instead of a button that can never be pressed.
**Alternative:** always enable, let the first request carry the bad news. Rejected: it spends a round trip to say what the server already knows, and the disabled state is the honest one.
**Consequence:** one more endpoint for the eventual host to mount (Q-2). It states whether a key exists and nothing about the key.

## D-040 · A process control changes a local copy, and `pause` becomes `queued`

**Status:** accepted in force (SP-07c).
**Context:** This unit wants capability-gated controls *and* forbids post-click apologies. Those two together leave no honest option for what a press does: the old behaviour was a notice explaining that nothing had been sent, which is exactly the pattern the acceptance list bans.
**Decision:** every control writes to a local override map (`thylas:runs:v1`), shared by the list and the detail through a `useSyncExternalStore` store. The surface says `simulated` wherever the result is drawn — header label, panel chip, activity line, list column — and `Restore the sample` removes the override. `pause` maps to `queued`.
**Alternative:** add a seventh `paused` state. Rejected: one button would introduce a word the run model does not have and that WAM may never emit; `queued` already says "not moving, waiting to run".
**Consequence:** a clicked state survives a reload, which is what makes "the list reflects it without a reload" a testable claim — and is why the restore control is mandatory rather than decorative.

## D-041 · One radius scale replaces eleven values, and a page is still square

**Status:** accepted in force (SP-10a).
**Context:** The archive said "no corner radius above 4px except overlays" and the audit counted eleven values instead — 1, 2, 3, 4, 6, 8, 9, 11px and 50 % (A10). A 2px corner on a 38px row is not a decision; it is a rounding that failed. The reader asked for rounded corners and a product-grade surface.
**Decision:** four steps and a pill — `--r-xs: 4`, `--r-sm: 8`, `--r-md: 12`, `--r-lg: 16`, `--r-pill: 999`. They are declared in `src/styles/tokens.css` **over the archive's names**, so the forty existing `--r-chip` / `--r-surface` / `--r-overlay` call sites moved without being found and edited one by one. A radius belongs to something you can point at: cards, panels, menus, buttons, inputs, row states. Pages, tables, bands and dividers stay square.
**Alternative:** round everything, table rows and page sheets included. Rejected: a rounded page is a card, and this layout's one strong idea is that content is not a stack of cards.
**Consequence:** `grep -rn "border-radius: [0-9]" src` is 0. Row hover and selection are drawn inset through `grammar.rowState`, so a row gains a corner without losing column alignment.

## D-042 · Inter for the UI, Plex Mono and Noto SC kept

**Status:** accepted (SP-10b), **not yet implemented**.
**Context:** The type contract chose IBM Plex Sans for good reasons (same superfamily as the mono, calm at 13px). Two things it does not give: a wide weight range and the optical quality a product-grade surface needs at 13–16px. The reader asked for better type.
**Decision:** Inter Variable 400–700 for Latin UI and display. IBM Plex Mono stays — its tabular figures are better than Inter's — and Noto Sans SC stays, because it is already subset and its vertical metrics were matched to Plex.
**Alternative:** keep Plex and only re-cut the ramp. Cheaper and lower risk, but it fixes legibility without changing how the product reads.
**Consequence:** Inter's x-height is roughly 4 % taller than Plex, so every mixed-script line shifts unless `size-adjust` on the CJK face is tuned against it. SP-10b measures that before shipping, and the exit criterion is a side-by-side at 13/16/24 rather than a screenshot that "looks fine".


## D-043 · The editor is a lazy chunk, and a conflict compares against the version the edit began from

**Status:** accepted in force (SP-05b).
**Context:** CodeMirror 6 is 174 KB gzip. Imported statically it pushed the shell from 155 to 321 KB, for a surface most visits only read. Separately, the first conflict implementation compared a save against the *latest* stored version — which always matches, so the guard became a silent overwrite wearing a version check.
**Decision:** the editor is `lazy(() => import(...))` behind a `Suspense` boundary and loads on the first **Edit**; `baseVersion` is captured when editing starts and advanced only on a successful save or an explicit Keep mine / Load theirs.
**Alternative:** ship statically and raise the budget. Rejected: a reader would pay 166 KB for a button they may never press.
**Consequence:** the first Edit costs a ~150 ms chunk fetch (a one-line fallback covers it) and the shell stays at 157 KB. A second writer is now actually caught — measured by writing to the store behind a live editor, which then reports `Not saved — this note changed elsewhere`.

---

## D-044 · Product experience is scored, and the reference is used for composition only

**Context:** the founder's 2026-11-09 directive sets Eden-level product maturity as the target. The risk is twofold: treating "polish" as taste, and importing a look that is not Thylas.
**Decision:** adopt `QUALITY-BAR.md` — eight dimensions, 0–3, ship threshold 20/24 with no dimension ≤ 1, artefacts required for a 3. Adopt `interaction-lifecycles.md` as the completeness test. Eden is used for **composition and information design only**; palette, type, radius, shadow and motion stay as decided (D-041, D-042). Where the reference and the brand conflict, the brand wins and the deviation is recorded in the benchmark's §5.
**Alternative:** a subjective "does it look professional" review at SP-09b. Rejected: the 11-09 audit produced four surfaces scoring 16–21/24 with concrete defects; a taste review would have passed all four.
**Consequence:** SP-10 gains a 3.25-day experience phase (10f) and SP-09b gains a scored table and five tests. Two lifecycle mechanics (context chip, compressed trace) are added to a surface marked complete — an amendment, not new scope.

---

## D-045 · A workspace can be created and deleted here, and deleting one takes what is inside it

**Status:** accepted in force (SP-11).
**Context:** SP-02 removed the "New workspace" card because it opened the command palette — the label and the action disagreed. The reason was never "workspaces must not be created"; it was that a card which does not create a workspace is a lie. With a local store in hand, the card can be true.
**Decision:** workspaces are owned locally. Creation is `seeds + created − deleted` persisted at `thylas:workspaces:v1`; deletion of a sample is a tombstone, deletion of a created one removes it. Every selector that returns a workspace-scoped object asks `liveIds()` first, so a deleted workspace's files, boards, runs, folders and recent entries leave no trace and an open tab resolves to "Workspace not found". Its notes are deleted for real — they are the only content a person typed — and the confirm states the count before the press. Counts on the cards are derived, never stored.
**Alternatives:** (1) mutate `data/mock.ts` in place — puts the samples back on reload and makes "deleted" untestable; (2) hide the workspace only, leaving its objects reachable by URL — one surface contradicting another; (3) keep notes of a deleted workspace in storage, unlisted — silent orphans with no way back.
**Consequence:** a workspace is now a first-class object in the demo, which raises one question the build cannot answer: a created workspace has no files service, so it stays empty (the banner on Files already says so). Recorded in the interaction contract rather than papered over. `R4` is marked reversed.

---
## D-046 · One press everywhere, and focus drawn inside the row

**Status:** accepted in force (SP-10d).
**Context:** the plan asked for four states per interactive class. Measured on 11-09 with the CSS domain forcing each pseudo-class: of 41 interactive classes, **31 had no pressed state and 11 no hover**; focus was already complete (0 missing) because `base.css` draws a global outline. Fixing that class by class would have produced thirty near-identical `:active` blocks, and the first screenshot of the fix showed a second defect: the global outline sits at `outline-offset: 1px`, so on a row that spans a scroll container it is clipped on all four sides — present in the stylesheet, invisible on screen.
**Decision:** the press is one global rule in `base.css` — `translateY(1px)` on `button`, `[role=button]`, `[role=tab]`, `[role=row]` and `a[href]`, gated by `prefers-reduced-motion: no-preference`. Colour stays local (each surface's `:active` uses `--tint-sel`, because only the surface knows what its hover already looks like). Focus on rows moves to `grammar.focusInside`, an inset 1px ring composed into seven row classes, so it cannot be clipped and the page stylesheets stay free of `--accent`.
**Alternative:** per-class `:active` rules. Rejected after the measurement: 31 copies of the same declaration, each free to drift.
**Consequence:** a press travels 1px on a rail row, a table row, a tab and a button alike; reduced-motion users get the tint without the travel. The measurement is repeatable — `scripts/ui-checks.mjs` forces `hover`, `active` and `focus-visible` through CDP on a row, a chip and a rail row and compares computed styles, so the claim is asserted rather than photographed.

---

## D-047 · The layer that opens a dialog owns its focus, and one action gets one control

**Status:** accepted in force (SP-10e).
**Context:** the audit's two blocking findings were both about keyboard ownership: `aria-modal` with no trap, and a close that left focus on `<body>`. Implementing the fix exposed two more. Escape was bound to the palette's input, so after tabbing to an option the dialog could not be closed from the keyboard at all. And the rail's search existed twice — once in the rail, once as `⌘K` in the tab strip — which is how one action ends up with two names.
**Decision:** `openPalette` / `closePalette` live in `state/app.tsx` and own the opener element; the dialog only traps Tab and closes on Escape from anywhere inside it. Focus is restored in a `setTimeout(0)` after the dialog unmounts, guarded by `isConnected`. Where one action had two controls, one of them changes shape rather than being duplicated: the strip's `⌘K` is a hint while the rail is open and a button when the rail is collapsed. Rail rows carry an explicit `aria-label` sentence instead of relying on their concatenated children.
**Alternative:** a focus-trap library. Rejected: the trap is twelve lines and the dialog has two kinds of focusable node.
**Consequence:** Tab cannot leave an open palette, Escape always closes it, and the keyboard returns to the button that opened it. The rule "one action, one control" is now asserted by name (`collapse sidebar` ×1, `create workspace` ×1) rather than by a global duplicate scan — `Notes` in the rail and `Notes` in the strip are two doors to one room and are allowed.

---

## D-048 · Compute: two facts per machine, a registry instead of pages, and a recommendation that records rather than schedules

**Status:** accepted in force (Compute, 2026-11-09).
**Context:** the surface has to hold three kinds of resource — a local agent, an SSH server, a cloud account — and three levels of honesty, because only one of those can be read today. The easy versions are wrong in familiar ways: one `status` word that merges reachability with load, a page per provider, a "Find compute" that starts a run.
**Decision:** connection (`connected`/`connecting`/`disconnected`/`error`) and availability (`available`/`busy`/`offline`/`unknown`) are separate fields; anything not connected reports `Availability unknown` and **carries no utilization at all** (`metricsOf` returns `undefined`, not zero). Providers live in one registry whose entries declare their own `fields[]` and `integration` level, so a new provider is data, not a route. Hardware typed into the add flow is `declared` and labelled in the detail and the done card. Stop/cancel are local and say so. Find compute is a sort with reasons; accepting it writes a **queued** workload with a note that no executor exists. Tables use a `console` container (1180px) because the prose width truncated every name.
**Alternatives:** (1) one `status` field — cheaper, and it produces "offline · 82% GPU", which is the class of lie this product cannot afford; (2) a route per provider — the thing the brief asks not to do; (3) inventing utilization for unreachable machines so the table looks full — rejected on the same ground as fake metrics anywhere else; (4) letting Find start the run — there is nothing to start it.
**Consequence:** a reader can tell a machine that is busy from a machine that cannot be seen, and the difference is visible in the table, the detail header and the recommendation caveats. The cost of honesty is empty cells, which are explained in place ("Not measurable while unreachable").

---

## D-049 · User replaces Account, and Connect never says "connected" unless something is

**Status:** accepted in force (User & Connect, 2026-11-09).
**Context:** the 11-09 brief asks for a User page (identity, preferences, environment, security) and a Connect page (Connected / Discover / Custom). An Account page already exists at `/account` owning part of the first responsibility, and no OAuth client, token store, identity service or integration runtime exists in the build.
**Decision:** User **replaces** Account — two pages owning "the person" would be two doors to overlapping rooms. Account's honest copy (plan, usage, keys) moves into the four-section IA instead of being deleted; `/account` becomes a redirect. Connect follows the Compute shape: one registry file, one store, four honest tiers (`available · connected · coming soon · unsupported`), and a custom-integrations page whose explainer keeps authorization methods (OAuth, API key) apart from integration kinds (Custom API, MCP server, Webhook). No authorize flow reports success; custom registrations say "Registered · not connected"; User's My Environment reads the compute store and renders no resource rows of its own.
**Alternatives:** (1) keep Account and add a second User page — duplicated identity surfaces that drift; (2) fake a successful OAuth handshake so Discover feels alive — the class of lie D-048 exists to prevent; (3) fold plan/usage/keys out of User entirely — deletes true sentences to make the IA tidier.
**Consequence:** the rail reads Overview / Recently / Compute / Connect and Notes / User; the palette follows. Preferences gain two real settings (persisted row density, landing page read by the index route) and one labelled prototype (notifications). The empty cells this costs — "Authorize" explaining itself, sign-out disabled — are the product boundary made visible, recorded in `docs/development/user-connect/MOCKED-AND-FUTURE.md`.

---

## D-050 · Compute v2: execution environments first, machines second, acquisition kept apart

**Status:** accepted in force (Compute redesign, 2026-11-09). Supersedes the Compute parts of D-048's IA (the honesty rules carry over).
**Context:** the founder's directive reopens Compute at the product level, naming OpenResearch's model — pluggable execution backends (local, SSH, Slurm, Kubernetes, Ray, Modal, HF Jobs, managed GPUs) with compute chosen per run — as the reference. The shipped IA (Resources / Providers / Workloads / Find) conflates "who sells machines" with "how work executes", cannot represent environments without instance semantics (Slurm schedules; Modal provisions), and buries the central interaction ("where should this run?") behind four infrastructure screens.
**Decision:** four nouns with three visible rules — **Backend** (execution interface; `instances: 'exposed' | 'none'`), **Instance** (a machine; only `exposed` backends have them), **Workload**, **Listing** (Marketplace acquisition, kept separate from execution). IA becomes Overview / Backends / **Run** / Instances / Activity / Marketplace; Run is Compute Selection — describe work, get a deterministic ranked recommendation with arguable reasons, or pick manually from the same list (Hybrid Coordination, D-048's successor rule), and confirming records a queued workload, never a start. Backends gain persistence: config, enable/disable, default, deterministic test-connection. Store bumps to `thylas:compute:v2`.
**Alternatives:** (1) keep Resources/Providers and bolt on a "backends" filter — leaves both conflations in place; (2) make Slurm/Modal fake machines so the old table survives — the exact class of lie D-048 forbids; (3) auto-schedule on confirm — no executor exists to schedule onto.
**Consequence:** Overview leads with "usable now", Instances deprioritizes to operations, Providers splits into configuration (Backends) and acquisition (Marketplace, representative prices, labelled). User's My Environment links re-point at Instances. Honesty rules from D-048 survive verbatim: connection ≠ availability, no utilization while unreachable, deterministic failure, queued-not-started.

---

## D-051 · Chat: one conversation model, two surfaces, and streaming added as a sibling contract — never a key in the client

**Status:** accepted in force (Chat, 2026-11-09).
**Context:** the brief makes streaming a must-have, but SP-07a shipped `/api/ai` deliberately non-streaming with the key server-side (D-006). A naive implementation would either fake typewriter streaming over the non-streaming endpoint or move the key into the browser.
**Decision:** one `ChatCore` renders both the `/chat` page (conversations sidebar, reading column) and a `ChatDock` beside any route (grip-resized 300–640px, shared store). State is a single `thylas:chat:v1` envelope: conversations, block-based messages (`text | artifact | evidence | status`), context sources, dock. Streaming arrives as a **new sibling endpoint** `POST /api/ai/stream` (SSE) in the same middleware and the same `lib/ai.ts` contract module — same key handling, same seven error kinds — leaving `/api/ai` untouched. Markdown is a small safe renderer (no engine, no HTML injection); "attach" means attaching real workspace materials as context + evidence, never a fake upload; an artifact's honest persistence is **Save as note** through the real notes store.
**Alternatives:** (1) typewriter animation over a complete answer — a fake progress bar for a done thing; (2) client-held key for real SSE to the provider — the one shortcut D-006 exists to prevent; (3) two chat implementations (page + panel) — drift by construction.
**Consequence:** the Ask panel keeps its single-turn behavior; Chat adds memory, context declaration (retrieval is *not* implemented and says so), artifacts that persist as notes, and honest failure states (partial text kept, "Stopped before completing"). The e2e stub gains an SSE branch steered by the same `aiMode`.

---

## D-052 · Backend boundary: one thin application server, docs-first structure, WAM stays prose until an API exists

**Status:** accepted in force (backend structure & documentation system, 2026-11-11).
**Context:** WAM Joshō preparation asked for a backend structure and documentation system before any backend work. The audit found the entire backend is one Vite middleware file (`server/ai.ts`, three endpoints) with zero server persistence — every domain lives in versioned client envelopes. Scaffolding empty `routes/`/`persistence/`/`wam/` directories would be architecture theatre.
**Decision:** the backend is a **thin application server** and stays one. The deliverable is documentation that tells future work where things belong: `docs/development/backend/` (OVERVIEW — target tree with an "appears with its first real module" rule, DOMAIN-MODELS — the implemented **[I]** vs proposed **[P]** split for User/Workspace/Conversation/Message/Artifact(+Version)/Coworker/Tool, ENGINEERING-STANDARDS — the six conventions already in the code, INTEGRATION — model API, storage, and the WAM/A2A hard line). The only justified code extraction is `server/config.ts` (typed env reading, one reader per process). Thylas owns application + persistence + presentation; WAM owns planning, shared context, orchestration, and the A2A protocol — Thylas stores connection handles and renders what WAM reports, never re-implements WAM internals. `server/wam/` is created only when a concrete WAM API exists.
**Alternatives:** (1) scaffold the full future tree with empty modules — architecture theatre the brief itself forbids; (2) fold everything into `src/lib` and skip server structure — Joshō's conversations/artifacts need real persistence soon and it deserves a documented home; (3) design WAM adapter interfaces now — premature abstraction against AGENT.md §1.3.
**Consequence:** another engineer (or agent) can find where new backend functionality belongs from `server/README.md` + `docs/development/backend/` alone. Client stores keep their envelope shapes and swap their localStorage backing for API calls behind the same validated interface when persistence arrives — no UI rewrite.

---

## D-053 · Artifact product foundation: one noun, emphases not classes, and four separations that carry the system

**Status:** accepted in force (Artifact system documentation, 2026-11-12). Product model only — no implementation beyond what exists **[I]**.
**Context:** WAM Joshō requires a much broader Artifact concept than "generated documents": persistent, identifiable, evolvable, reusable assets created and used by humans and agents, across workspaces. The existing docs had three fragments: B2 ingestion boundary (WAM supplies content; Thylas assigns id/scope/placement/provenance), the backend domain-model sketch, and the chat artifact block with save-as-note **[I]**.
**Decision:** product foundation established in `docs/product/artifacts/` (README + 8 documents + open-question register). The load-bearing rulings, each **[C]**:
1. **One noun.** "Artifact" replaces Asset / Knowledge Object / Executable Object as competing terms; executability is a capability facet, not a class.
2. **Six categories are emphases, not classes** — tags (several, user-extendable) over one artifact core; one object may span categories.
3. **Structure is opt-in via the User-defined Semantic Object System:** a spec is itself an artifact; instances pin spec versions; spec evolution never deletes user content.
4. **Lifecycle separates identity / content / version / status / activity** — status transitions create no versions; versions are append-only and attributed (`authored by · applied by · under authority`); rollback is forward.
5. **No universal accuracy score.** Seven dimensions (provenance, authorship, evidence, validation, scope, currency, authority) as visible structured metadata; agent-generated content enters as proposals, never auto-accepted.
6. **Canonical identity + references:** one authoritative definition, one authority; other workspaces hold pinned-or-current references, derived objects, or explicit forks — local use never modifies the source; feedback flows as proposals.
7. **Methodology / Method Run / Result / Evaluation are four nouns** — runs pin versions, results belong to the running workspace, improvement is proposal-driven, failure is first-class.
8. **External assets keep their system of record** — Notion/Obsidian integration is reference, explicit import (new native artifact + provenance), or derived; round-trip sync deferred until persistence exists.
**Alternatives:** fixed per-category schemas (guesses the user's ontology); a Knowledge Object class (wrong for companies and scripts); a universal confidence score (hides the dimensions that matter); auto-trusting agent content (contradicts the honesty rules the product runs on).
**Consequence:** future artifact implementation has a product contract to build against; the nine-question final review in the README checklist is answerable from the docs alone. Nothing here changes shipped code — chat artifact blocks and save-as-note remain the only artifact persistence **[I]**.

---

## D-054 · Coworker product foundation: identity ≠ prompt, membership ≠ access, and Thylas never orchestrates

**Status:** accepted in force (Coworker system documentation, 2026-11-12). Product model only — no implementation beyond the artifact detail's Coworker chat-dock action **[I]**.
**Context:** Coworkers (independent, persistent AI work entities across workspaces) are WAM Joshō's core product concept, with existing anchors only in `product/definition.md`'s responsibility table, `backend/INTEGRATION.md` §4 (A2A), and the artifact docs' coworker roles. No code, no model — the risk is a UI agent inventing definitions.
**Decision:** product foundation in `docs/product/coworkers/` (README + 8 documents + SCOPE register). The load-bearing rulings, each **[C]**:
1. A Coworker is an independent, persistent work entity; identity ≠ a system prompt — responsibilities are structured visible config (responsible-for / not-for / good output).
2. Responsibilities ≠ Toolsets ≠ Methodologies: for / may-do / how-done-well.
3. Membership ≠ access: per-membership role + grants (resources / artifacts / toolsets); effective access = intersection with the Coworker's own config; context is declared, never ambient.
4. Artifact relationship = six separate verbs (discover / reference / understand / apply / create / propose); applying a methodology never mutates it; Coworker output enters as attributed drafts/proposals, never overwriting accepted artifacts.
5. Working experience = five surfaces (conversation, Current Work, resources, artifacts, activity); Current Work is objectives+progress fed by real signals — never a transcript or fake activity.
6. Three status layers stay separate: availability (active/paused/archived) · runtime execution (WAM's) · current-work state.
7. Many Coworkers in one workspace ≠ a multi-agent system; A2A is WAM's protocol — Thylas stores handles and renders delivered transcripts only; no global orchestration.
8. Attribution is permanent across removal/pause/archival; archive is reversible.
**Alternatives:** a chatbot-with-personality model (loses persistence and access governance); making Coworker a WAM agent wrapper (couples product identity to runtime machinery); a Thylas-side orchestration layer (duplicates WAM, forbidden by `product/definition.md`).
**Consequence:** a separate UI implementation agent can build the Coworker experience from `docs/product/coworkers/` alone; MVP = records + config + memberships + honest working surfaces on client state, with WAM-dependent features deferred to the contract (SCOPE §6). First live integration remains the artifact detail's Coworker→chat-dock action.

---

## D-055 · Phase 1 foundation: PostgreSQL + Drizzle, a standalone Node host, CHORD IdP, and no WAM scaffolding

**Status:** accepted in force (backend Phase 1 selection, 2026-11-12). Recorded before implementation; the unit list is `docs/development/backend/PHASE-1.md`.
**Context:** The five-phase roadmap was recorded today (`backend/ROADMAP.md`). The backend is still 3 files / 3 endpoints mounted only by Vite's dev and preview servers (Q-2), 11 domains live in browser envelopes (`AUDIT.md:51-62`), and `tech-stack.md:24,42` says there is no server runtime. N2 (who owns auth) was unanswered. Phase 1 cannot start until the database, host and identity choices are made.
**Decision:**
1. **PostgreSQL + Drizzle.** Migration scripts become the schema of record; the wire contract stays in `src/lib/<domain>.ts` and the client never learns SQL (`ENGINEERING-STANDARDS.md:24`).
2. **A standalone Node host.** `server/ai-handler.ts` holds the only implementation of the three `/api/ai*` endpoints; the Vite plugin and the standalone server both call it. One handler, two hosts.
3. **CHORD IdP.** Thylas holds a session cookie and never implements password flows (`tech-stack.md:401-403`); membership flags come from the server, writes are checked server-side, and a non-member gets 403 rather than an empty list.
4. Q4 keeps the N3/N4 defaults (signed direct upload, 100 MB through-API fallback, Thylas owns folders). Q5 keeps one env reader in `server/config.ts`.
5. **No WAM.** `server/wam/`, A2A relaying and toolset execution stay out of Phase 1; the boundary stays prose in `backend/INTEGRATION.md`. The MVP follows Thylas's real flow — create Workspace → create Coworker → start work → produce Artifact → reuse it — not a future agent runtime.
**Alternatives:** SQLite + Drizzle (fastest locally, but a migration as soon as a second device or coworker appears); serverless functions (SSE passthrough and connection handling need separate proof); keeping only the Vite plugin (Q-2 stays open, nothing deployable); a local temporary login (a second identity path to remove later); designing WAM adapters now (the brief explicitly rejects premature abstraction).
**Consequence:** P1-1 can start. `tech-stack.md:24,42` ("no server runtime") and the two conflicting Q-2 entries need dated annotations. P1-5 stays blocked until CHORD IdP is reachable. No WAM interface is built ahead of a concrete WAM API (D-052 holds).

---

## Open questions (need a human, not a default)

| # | Question | Blocks | Default until answered |
| --- | --- | --- | --- |
| Q-1 | D-002: is CodeMirror 6 approved over Tiptap? | SP-05 dependency list | CodeMirror |
| Q-2 | D-006: acceptable that AI works only against a local dev server? | SP-07 acceptance | yes, labelled "dev endpoint" |
| Q-3 | Documents as a separate surface, or Notes only? | SP-05 scope | Notes only |
| Q-4 | Is board persistence in `localStorage` acceptable for the MVP? | SP-06 | yes, one board per workspace |
| Q-5 | Router 8 now or after the MVP? | SP-03 | after SP-02, as its own commit |
