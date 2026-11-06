# UI Redesign Roadmap

**Status:** plan, not started. No source file changed by this document.
**Date:** 2026-11-07
**Inputs:** `visual-audit.md` (what is wrong), `typography.md` (the type contract), `interaction-contract.md` (behaviour), `motion-guidelines.md` (timing), `spatial-language.md` (zones).
**Sequencing in force:** the next four weeks are scheduled sprint-by-sprint in [`../planning/ui-mvp-plan.md`](../planning/ui-mvp-plan.md) (P0+P1 → S1, P2 → S2, P3 → S2–S3, P4 → S3–S4, P5 → S4). This document remains the full-scope estimate; that one is the executable slice.

**Premise:** the zone geometry, tab semantics and tone system stay. What is rebuilt is the **type layer**, the **state layer** and the **style ownership layer** — the three things the audit found unregulated. This is a re-skin of a correct skeleton, not a new skeleton.

---

## 0. Sequencing at a glance

```
P0 foundations ─▶ P1 shell ─┬─▶ P2 overview ─┐
   (fonts, tokens,           │               ├─▶ P4 consistency ─▶ P5 expansion
    specimens)               └─▶ P3 workspaces ┘
```

P0 must land first: every later phase reads its tokens. P1 before P2/P3 because the shell sets the chrome/content contrast those surfaces inherit. P4 last-but-one because it can only audit states that exist. P5 is the proof, not the point.

**Recommended first milestone: P0 + P1, in one branch, ~7 person-days.** Rationale in §7.

---

## Phase 0 — Foundations

| | |
| --- | --- |
| **Objective** | Replace the platform-dependent type stack with shipped fonts, and collapse 16 type sizes, 2 fake weights and 5 radii into one enforced set |
| **Design decisions** | IBM Plex Sans 400/500/600 + Noto Sans SC 400/500 + IBM Plex Mono 400; 7-step scale; 3 radii; palette unchanged; `design/tokens.css` frozen as the prototype's archive, application tokens move to `src/styles/` (`[P]`, see risk R3) |
| **Files — create** | `public/fonts/IBMPlexSans-{Regular,Medium,SemiBold}.woff2`, `public/fonts/IBMPlexMono-Regular.woff2`, `public/fonts/NotoSansSC-{Regular,Medium}.woff2`, `src/styles/fonts.css`, `src/styles/typography.css`, `design/specimens/type-specimen.html` (review artifact, not app code) |
| **Files — modify** | `src/styles/tokens.css` (colour/space stay; type ramps removed and imported from `typography.css`), `src/styles/base.css` (`font-synthesis: none`, body 13/20 Plex, `:lang(zh)` rules), `index.html` (one preload, no other change), `docs/design/visual-system.md` §3 (retire serif, point to `typography.md`) |
| **Depends on** | Nothing. Font files are the only external input (OFL, self-hosted) |
| **Visual result** | The same layout, but the headings are Plex at a predictable size, the tables are Plex with tabular numerals, and no text is 8px. The most visible change in the whole project per hour spent |
| **Functional requirements** | One preloaded font; Noto SC fetched only when CJK glyphs render; `font-display: swap`; fallback metrics close enough that layout does not shift more than one line |
| **Acceptance** | `grep -rE "font-size: [0-9.]+px" src` → only the 7 token values; `grep -rn "450\|550"` → nothing; type specimen page reviewed; 1440 screenshot compared to the current one; DevTools shows exactly 1 font request on an English page |
| **Complexity** | 2–3 person-days (mostly subsetting and the specimen) |
| **Risks** | R1 font payload & CLS; R2 IBM Plex Reserved Font Name before renaming subsets; R3 `design/tokens.css` is shared with `design/prototypes/hi-fi.html` — freezing vs diverging must be decided, not drifted |

---

## Phase 1 — Application shell

| | |
| --- | --- |
| **Objective** | Make the four zones read as four zones: chrome distinguishable from content by weight and tone, never by colour |
| **Design decisions** | Rail chrome = 13/20, active item 500 + raised surface + inset hairline; room rows 12/16; strip tabs typed; hover = tint only; focus ring = 1px accent inset; panel header = 11/16 label with count, not a serif heading; rail arrow-key traversal |
| **Files — create** | none (deliberately) |
| **Files — modify** | `src/shell/shell.module.css` (type tokens, radius tokens, remove hover-accent, add `:active`/`:focus-visible`/`:disabled`), `src/shell/Rail.tsx` (roving tabindex, remove hardcoded `wsInitial` sizes), `src/shell/TabStrip.tsx` (typed object tabs, 8-tab overflow trigger, dirty dot slot), `src/shell/ContextPanel.tsx` (per-context width, focus handling), `src/shell/layouts.tsx` (panel width prop), `src/shell/CommandPalette.tsx` + `src/shell/palette.module.css` (type scale, `aria-activedescendant`, group labels 11/16) |
| **Depends on** | P0 |
| **Visual result** | The rail reads as instrument panel, the surface as paper. Tabs become identifiable at a glance because each carries its type. Terracotta appears only where state is meant |
| **Functional requirements** | Typed tabs; `+N` overflow after 8; tab close → room index; dirty slot rendered but unused until the editor; palette keyboard model; no layout shift on panel toggle |
| **Acceptance** | Screenshots of the five tab states; 8→9 tabs opens the overflow menu; `:active`/`:focus-visible`/`:disabled` present for every class in `shell.module.css`; keyboard-only path rail → tab → content in one Tab press per level |
| **Complexity** | 4–5 person-days |
| **Risks** | R4 tab overflow interacts with persistence (what happens to a tab that overflows while active); R5 rail keyboard model can fight the browser's tab order if roving tabindex is incomplete |

---

## Phase 2 — Overview

| | |
| --- | --- |
| **Objective** | An entry screen that reads as a place to resume work, with a type hierarchy that does not rely on a 28px greeting |
| **Design decisions** | One display step (32/40 Plex 500) for the greeting only; Continue/Needs-you rows become 13/20 with 500 titles; section labels 11/16 mono uppercase; the intent input is the only accent-adjacent emphasis; hover is tint only; the "New workspace" card is removed (it opens the palette today) |
| **Files — create** | none |
| **Files — modify** | `src/pages/overview.module.css`, `src/pages/Overview.tsx` (dynamic "two processes need a decision" copy derived from data; Start becomes disabled-with-reason; remove `wsNew`) |
| **Depends on** | P1 (chrome contrast), P0 (scale) |
| **Visual result** | Calmer, denser, more editorial: a heading that is large because it is the only one, rows that are scannable in one pass, no coloured text on hover |
| **Functional requirements** | Copy reflects the sample data instead of asserting "two"; Start disabled until text, with an inline reason when no WAM is connected; all rows navigate |
| **Acceptance** | Greeting is the only 32px text in the app; no terracotta text outside the primary button and the live dot; empty intent state explains where it would go; a11y: rows are buttons with visible focus |
| **Complexity** | 2–3 person-days |
| **Risks** | R6 removing affordances (new workspace) may read as a regression; the honest answer is that a missing service is not a missing button — decide explicitly |

---

## Phase 3 — Workspace surfaces

| | |
| --- | --- |
| **Objective** | Files, Whiteboard, Processes and Notes become four densities of one system rather than four stylesheets that happen to share a palette |
| **Design decisions** | Table grammar: one header recipe (11/16 mono uppercase, hairline, sticky), numeric columns tabular, row height per density; disclosure is a real button (V1); board scene constants live in one module; notes reader uses `--t-read` at 16/26 with a 66ch measure and no card; run bands keep their 32px rhythm but inherit the labels |
| **Files — create** | `src/pages/boards/scene.ts` (scene constants + minimap maths, extracted from `Boards.tsx` and `boards.module.css`) |
| **Files — modify** | `src/pages/files.module.css`, `src/pages/Files.tsx`, `src/pages/boards.module.css`, `src/pages/Boards.tsx`, `src/pages/processes.module.css`, `src/pages/Processes.tsx`, `src/pages/notes.module.css`, `src/pages/Notes.tsx` |
| **Depends on** | P1; P0 |
| **Visual result** | The four surfaces look like four rooms in one building: same labels, same rules, different density. The board stops being the only screen with its own scale |
| **Functional requirements** | Keyboard: table `↑↓ ↵ esc`, disclosure toggled by `↵`/`space`; scene constants drive canvas, edges and minimap from one source; no hardcoded hex in page CSS |
| **Acceptance** | `grep -rn "1032\|560" src` → only `scene.ts`; `grep -rnE "#[0-9a-f]{6}" src/pages` → nothing outside tokens; 1280 and 1440 screenshots of all four surfaces; table headers identical across files/processes |
| **Complexity** | 6–8 person-days |
| **Risks** | R7 board scaling regressions (fit computation + constants extraction is exactly where it broke last time); R8 table column budgets at 1280 with the panel open — the container-query rule must be re-measured, not assumed |

---

## Phase 4 — Functional consistency

| | |
| --- | --- |
| **Objective** | Every control has the states it can be in, and no control lies about what it does |
| **Design decisions** | Adopt the state matrix (`interaction-contract.md` §5) as the definition of done per component; replace all nine post-click apologies with disabled-with-reason or removal; introduce one shared CSS grammar layer instead of six `.notice` copies; loading = static bars, no shimmer; context menu for tables/files `[P]` |
| **Files — create** | `src/styles/grammar.css` (composed recipes: label, table-head, banner, row), `src/components/Notice.tsx` + `notice.module.css`, `src/components/Menu.tsx` + `menu.module.css` (context menu, one implementation) |
| **Files — modify** | `src/components/ui.tsx`, `src/components/ui.module.css`, all six page modules (delete duplicated `.notice` / `.filters` / `.panelHead`), `src/pages/*.tsx` (disabled reasons), `src/shell/Rail.tsx` (keyboard), `src/state/app.tsx` (dirty-tab slot, `⌘W`) |
| **Depends on** | P2, P3 (states must exist to be audited) |
| **Visual result** | Fewer controls, each one honest. The product gets quieter, not busier — expected net removal of three to five affordances |
| **Functional requirements** | Every clickable element keyboard-operable; disabled controls carry a reason in `title` and `aria-describedby`; no `span onClick`; focus visible everywhere; notices appear where the action was attempted |
| **Acceptance** | A scripted pass asserts all six states for Button / row / tab / input; `grep -rn "onClick" src | grep -c "span\|div"` → 0; zero "nothing was sent" strings reachable by click; keyboard-only completion of J1 and J4 |
| **Complexity** | 3–4 person-days |
| **Risks** | R9 disabled-with-reason can make the product look more broken than honest copy does — mitigate with one consistent sentence pattern and a single place that lists what is not connected; R10 context menus are a new interaction surface with their own keyboard and dismissal rules |

---

## Phase 5 — Expansion and proof

| | |
| --- | --- |
| **Objective** | Prove the system scales to the remaining surfaces and to the canvas, and make the identity survive without the palette doing the work |
| **Design decisions** | Account and Recently adopt the same label/table/field grammar; whiteboard spatial rules documented before it becomes editable; the identity carriers are type + hairline grid + index marks, not colour |
| **Files — create** | none beyond `docs/design/` updates |
| **Files — modify** | `src/pages/account.module.css`, `src/pages/Account.tsx`, `src/pages/recently.module.css`, `src/pages/Recently.tsx`, `src/pages/notfound.module.css`, `src/app/routerror.module.css`, `docs/design/spatial-language.md` (canvas rules) |
| **Depends on** | P4 |
| **Visual result** | Seven surfaces, one grammar. A screenshot with the logo covered is still recognisably Thylas |
| **Functional requirements** | Density preference persists per account `[?]`; account sections use the shared field grammar; 404/error pages use the page step, not a bespoke size |
| **Acceptance** | Cross-surface audit against `visual-system.md` §7 checklist; no page-local font-size; logo-covered screenshot test with three reviewers |
| **Complexity** | 2–3 person-days |
| **Risks** | R11 the canvas will tempt a parallel visual language; the pre-written rules are the brake |

---

## 1. Totals and order

| Phase | Days | Blocking |
| --- | --- | --- |
| P0 Foundations | 2–3 | everything |
| P1 Shell | 4–5 | P2, P3 |
| P2 Overview | 2–3 | P4 |
| P3 Workspaces | 6–8 | P4 |
| P4 Consistency | 3–4 | P5 |
| P5 Expansion | 2–3 | — |
| **Total** | **19–26** | one engineer, sequential |

With two engineers: P2 and P3 run in parallel after P1; the wall clock is P0 + P1 + max(P2,P3) + P4 + P5 ≈ 14–18 days. P0 is not parallelisable — everything else reads its tokens.

## 2. What this plan does not touch

- Zone geometry, tab semantics, state ownership, routes, data model, the sample-data boundary.
- Any backend, any WAM call, any editor, any canvas interaction.
- The product definition, the architecture document, the milestone order in `docs/planning/roadmap.md`.

## 3. Decisions that need a human before P0 starts

| # | Decision | Default if unanswered |
| --- | --- | --- |
| D1 | Freeze `design/tokens.css` and let `src/styles/` own app tokens, or keep one shared file | Freeze the design file; prototype keeps its copy |
| D2 | Accept removing the serif entirely (no Plex Serif in notes) | Remove it; revisit only with a reading test |
| D3 | Chinese locale in scope for v1? (drives Noto SC subset size and `--t-read` 17px variant) | In scope for rendering, out of scope for translation |
| D4 | Remove "New workspace" / "New board" affordances until services exist | Remove |
| D5 | Context menus in this cycle or after the editor | After |

## 4. Why P0+P1 is the first milestone

It is the only pair that changes how the product *reads* while touching no product logic. Both are reversible, both are screenshot-verifiable, and both remove the audit's three blocking findings (A1 no typeface, A2 fake weights, A6 flat zones). If the direction is wrong, the cost of being wrong is five files, not a surface.
