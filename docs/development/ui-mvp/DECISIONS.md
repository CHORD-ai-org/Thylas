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

## Open questions (need a human, not a default)

| # | Question | Blocks | Default until answered |
| --- | --- | --- | --- |
| Q-1 | D-002: is CodeMirror 6 approved over Tiptap? | SP-05 dependency list | CodeMirror |
| Q-2 | D-006: acceptable that AI works only against a local dev server? | SP-07 acceptance | yes, labelled "dev endpoint" |
| Q-3 | Documents as a separate surface, or Notes only? | SP-05 scope | Notes only |
| Q-4 | Is board persistence in `localStorage` acceptable for the MVP? | SP-06 | yes, one board per workspace |
| Q-5 | Router 8 now or after the MVP? | SP-03 | after SP-02, as its own commit |
