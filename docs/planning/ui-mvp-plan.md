# Thylas UI MVP — Phased Plan

**Status:** plan, not started. No source file changed by this document.
**Date:** 2026-11-07
**Supersedes:** the *sequencing* of `docs/design/ui-redesign-roadmap.md` for the next four weeks. That document remains the full-scope plan (19–26 days); this one is the slice that ships a defensible UI MVP in 20 working days.
**Depends on:** `typography.md` (type contract), `interaction-contract.md` (behaviour), `motion-guidelines.md` (timing), `visual-audit.md` (what is broken), `branding-desk.md` (identity).
**Execution:** decomposed into twelve sub-plans in [`../../plan/`](../../plan/README.md), one per unit of work, each with its own done-when list and verification block.

---

## 0. What "UI MVP" means here

**A UI that is finished at the level it claims, not a UI with every feature.**

The application already has the right skeleton: zones, routes, tab semantics, sample data. The MVP closes the gap between *that skeleton* and *a product a stranger can use without being told what is missing* — correct typography, complete states, no control that lies, coherent identity across seven surfaces, and a machine-checkable gate.

It does **not** add capability. No editor, no upload, no WAM, no canvas editing. Those are product milestones; this is the interface milestone.

### Five acceptance sentences

1. A returning user reaches the object they were last looking at in **under 15 seconds**, without typing a query.
2. Inside one workspace: tree → table → selection → panel → tab-open → tab-close works **entirely by keyboard**, and nothing on the way is a fake control.
3. One run's whole life is legible on screen: `queued → running → needs you → done / failed`, with the same five state words and the same tones in the table, the row, the tab and the panel.
4. At **1280 and 1440** no surface scrolls horizontally, clips a column, or shifts layout when the panel opens.
5. With the logo covered, three reviewers still identify the seven screens as one product.

---

## 1. Scope

| In | Why it must be in an MVP |
| --- | --- |
| Typography contract executed (3 faces shipped, 7 steps, real weights) | The audit's three blocking findings start here; nothing else can look intentional until type is fixed |
| Shell contrast: chrome ≠ content, by weight and tone | Without it the four-zone layout is geometrically right and visually invisible |
| Typed tabs, 8-tab overflow, close→room-index | Tabs are the product's core navigation model |
| Files, Processes, Notes (read), Whiteboard (read), Overview, Recently, Account | The seven surfaces already exist; leaving one unretouched breaks the identity test |
| Full state matrix for interactive classes | 31 `:hover` vs 1 `:active` / 1 `:focus-visible` / 1 `:disabled` today |
| Honest limiter corrected (reason before the click) | Nine controls currently accept a click and apologise |
| Keyboard model for rail, tables, tabs, palette | "Keyboard-first" is in the product definition |
| Verification gate (grep + CDP + screenshots) | A plan without a gate is a wish |

| Out | Why | When |
| --- | --- | --- |
| Note editor (TipTap) | New capability, new states, dirty-tab guard; 1.5–2 weeks alone | M3a, after MVP |
| Canvas editing (drag, edges, tools) | Largest risk item in the roadmap; validates no hypothesis | post-MVP |
| Upload / create anything | Needs services that do not exist; MVP renders these as disabled-with-reason | with services |
| WAM integration, run submission | Blocked on N1/N2; the UI states are already drawn from sample data | M4 |
| Context menus | New interaction surface with its own keyboard model | post-MVP |
| i18n / translated Chinese | Rendering Chinese is in; translation is not | with locale decision |
| Dark mode, mobile, collaboration | Confirmed out of v1 | — |
| Route-level code splitting | 128 KB gzip is acceptable for a signed-in app | hardening later |

**Explicitly not scope-cut:** the state matrix, the honesty correction, the typographic floor. Those are the point of the MVP; cutting them leaves the current UI with better fonts.

---

## 2. Sprints

Four sprints × 5 working days. Calendar in §5. Task IDs are stable — use them in commits and reviews.

### Sprint 1 · Foundations and shell (5 days) — gate G1

| Objective | Ship the three fonts, collapse 16 type sizes to 7, and make the four zones visually distinct without adding colour |
| --- | --- |

| ID | Task | Files | Days | Must |
| --- | --- | --- | --- | --- |
| S1-T1 | Subset + self-host Plex Sans 400/500/600, Plex Mono 400, Noto SC 400/500; `@font-face` with `swap`; one preload | `public/fonts/*` (6), `src/styles/fonts.css`, `index.html` | 1.0 | ✔ |
| S1-T2 | Replace type ramps: 7 steps, weights 400/500/600, remove 450/550, `font-synthesis: none`, `:lang(zh)` rules | `src/styles/typography.css` (new), `src/styles/tokens.css`, `src/styles/base.css` | 1.0 | ✔ |
| S1-T3 | Type specimen page (review artifact): every step, CJK/Latin mix, tabular comparison | `design/specimens/type-specimen.html` | 0.5 | ✔ |
| S1-T4 | Shell type + contrast: rail 13/20, active 500 + raised + inset line, room rows 12/16, panel header 11/16 label, strip tabs | `src/shell/shell.module.css`, `src/shell/palette.module.css` | 1.25 | ✔ |
| S1-T5 | Typed object tabs + `+N` overflow after 8 | `src/shell/TabStrip.tsx` | 0.75 | ✔ |
| S1-T6 | Shell state pass: `:hover` tint only, `:active`, `:focus-visible`, `:disabled` for every interactive class in shell | `src/shell/shell.module.css` | 0.5 | ✔ |

**Gate G1**
- `grep -rE "font-size: [0-9.]+px" src` → only token declarations.
- `grep -rn "450\|550" src design` → 0.
- Network blocked → Plex still renders; one font request on an English page.
- 9 tabs → overflow menu appears; type glyph on every object tab.
- Screenshots: rail active / inactive, tab four states, panel open / closed.

**Risk:** fonts add payload and a swap shift. If CLS > 0.02 on the shell, add `size-adjust` to the fallback before proceeding.

---

### Sprint 2 · Overview, Files, Notes, shared grammar (5 days) — gate G2

| Objective | Prove the new type system on the three surfaces with the most text, and stop duplicating the banner/filter/header recipes |
| --- | --- |

| ID | Task | Files | Days | Must |
| --- | --- | --- | --- | --- |
| S2-T1 | Overview reskin: one 32/40 display, rows 13/20, section labels 11/16 + index tick; copy derived from data ("Two processes…" is hardcoded today); remove "New workspace" card; Start disabled-with-reason | `src/pages/overview.module.css`, `src/pages/Overview.tsx` | 1.5 | ✔ |
| S2-T2 | Files: one table grammar (header 11/16 mono, tabular numbers, 32px rows), disclosure becomes a real button, panel inherits `Field` | `src/pages/files.module.css`, `src/pages/Files.tsx` | 1.5 | ✔ |
| S2-T3 | Notes: reader 16/26 at 660, list 13/20, scope filter reuses the shared filter recipe | `src/pages/notes.module.css`, `src/pages/Notes.tsx` | 1.0 | ✔ |
| S2-T4 | Shared grammar layer: `label`, `table-head`, `banner`, `filters`, `row` recipes via `composes`; one `Notice` component; delete 3 of 6 banner copies | `src/styles/grammar.css` (new), `src/components/Notice.tsx` (new) | 0.5 | ✔ |
| S2-T5 | Gate evidence: screenshots 1280/1440, tabular alignment proof, container-query re-measure | `.workbuddy/tmp/shots.mjs` (external script) | 0.5 | ✔ |

**Gate G2**
- Overview contains exactly one display element; no terracotta text outside the primary button and live dot.
- Files: all five columns visible at 1440, four at 1280, names never truncated below 20 characters.
- Note reading column measures 660–680px and 66–72 characters at 16px.
- `grep -c "\.notice {" src/pages/*.css` → ≤3 (from 6).
- Keyboard: `↑↓ ↵` in the table; disclosure toggles with `↵` and `space`.

**Demo checkpoint:** G2 is the first presentable build. If a stakeholder demo appears, this is the cut.

---

### Sprint 3 · Workspace: Processes, Whiteboard, states, honesty (5 days) — gate G3

| Objective | Finish the operational surfaces and remove every control that lies |
| --- | --- |

| ID | Task | Files | Days | Must |
| --- | --- | --- | --- | --- |
| S3-T1 | Processes + run detail: 38px rows, mono numbers, state word + dot, bands inherit labels, controls from capabilities only | `src/pages/processes.module.css`, `src/pages/Processes.tsx` | 1.5 | ✔ |
| S3-T2 | Board: scene constants out of TSX/CSS into one module; section labels readable at fit scale; empty state keeps chrome hidden | `src/pages/boards/scene.ts` (new), `src/pages/Boards.tsx`, `src/pages/boards.module.css` | 1.5 | ✔ |
| S3-T3 | State matrix on the four workspace surfaces (button, row, tab, input, disclosure) | four page CSS files, `src/components/ui.module.css` | 1.0 | ✔ |
| S3-T4 | Honesty sweep: the nine post-click apologies become disabled-with-reason or disappear; "New workspace" removed | `Overview`, `Files`, `Boards`, `Processes`, `Notes`, `Account` | 0.5 | ✔ |
| S3-T5 | Keyboard: table model on Processes, disclosure model on Files, palette `aria-activedescendant` | `Processes.tsx`, `Files.tsx`, `CommandPalette.tsx` | 0.5 | ✔ |

**Gate G3**
- `grep -rn "1032\|560" src` → only `scene.ts`.
- Zero reachable strings matching "Nothing was sent" by click (the reason is on the disabled control).
- Every clickable element is `button`/`a`/`input`: `grep -rn "onClick" src | grep -E "span|div"` → 0.
- Board at 1440 with panel open: no clipping, section labels ≥7px effective.
- Run detail: pause/stop absent when capabilities omit them (verified by editing mock in the test only).

---

### Sprint 4 · Expansion, motion, verification (5 days) — gate G4

| Objective | Close the remaining surfaces, prove the rules hold, and leave a gate the next person can run |
| --- | --- |

| ID | Task | Files | Days | Must |
| --- | --- | --- | --- | --- |
| S4-T1 | Account + Recently adopt the grammar (fields, section rules, labels); Account accent budget = 0 | `src/pages/account.module.css`, `Account.tsx`, `recently.module.css`, `Recently.tsx` | 1.0 | ✔ |
| S4-T2 | Error/404/empty-state pass on the page step; every empty state names its container | `notfound.module.css`, `app/routerror.module.css`, pages | 0.5 | ✔ |
| S4-T3 | Motion pass: remove any transition outside the four allowed; reduced-motion proof | `src/styles/base.css`, shell/page CSS | 0.5 | ✔ |
| S4-T4 | A11y basics: focus order per surface, `aria-describedby` for disabled reasons, skip link | shell + pages | 0.75 | ✔ |
| S4-T5 | Verification: expand the CDP script to 24 assertions, add the grep gates as `npm run gates`, record screenshots at 1280/1440 | `package.json` (script), `.workbuddy/tmp/cdp.mjs` | 0.75 | ✔ |
| S4-T6 | Buffer: fix what the gates find | — | 1.5 | ✔ |

**Gate G4 (MVP acceptance)**
1. All five acceptance sentences in §0 pass, each with evidence attached.
2. `npm run gates` green (grep + type + build).
3. CDP suite: 24/24, including tab persistence, keyboard traversal, reduced motion, disabled reasons.
4. Lighthouse ≥ 90 on the shell route; bundle ≤ 160 KB JS gzip / 60 KB CSS gzip.
5. Identity test: three reviewers, logo covered, seven screenshots — all named as one product.

---

## 3. Dependency and critical path

```
S1-T1 ─▶ S1-T2 ─┬─▶ S1-T4 ─▶ S1-T5/S1-T6 ─┬─▶ S2-T1 ─┐
                │                          ├─▶ S2-T2 ─┤
                └─▶ S1-T3 (specimen)       └─▶ S2-T3 ─┴─▶ S3 ─▶ S4
S2-T4 (grammar) is pulled early so S3 does not re-copy banners.
```

Critical path: fonts → tokens → shell → Files → Processes → gate. The board is the only item that can absorb three days without anyone noticing; it is deliberately in the middle of S3, not at the end.

---

## 4. Per-surface state requirements

A surface is not done until each row is true.

| Surface | States that must exist | Empty / error that must be drawn |
| --- | --- | --- |
| Shell | rail item hover/active/focus; workspace collapsed/expanded; tab 4 states + live + dirty slot | workspace with zero rooms is impossible; do not draw it |
| Overview | intent input default/focus/filled/disabled-submit; row hover/focus/live; needs-you chip | zero processes needing you; zero recent objects |
| Files | row hover/selected/focus/tombstone; disclosure open/closed/focus; folder empty | empty folder; missing file (tab stays); unconnected upload (disabled reason) |
| Processes | row hover/focus; filter active; state 5 tones; run controls per capability | no runs in filter; run with no events; run with no artifacts |
| Whiteboard | card default/selected/live; section default; zoom limits | board with no scene; board not found |
| Notes | list row hover/selected/focus; scope filter; reader read-only | no note open; note not found; no references |
| Account | nav active; field; meter; density segment on/off; disabled action | no keys; non-admin sees no organization block at all |

---

## 5. Calendar

| Week | Dates | Focus | Gate |
| --- | --- | --- | --- |
| W1 | 11-09 → 11-13 | S1 foundations + shell | **G1** Fri 11-13 |
| W2 | 11-16 → 11-20 | S2 Overview / Files / Notes / grammar | **G2** Fri 11-20 (demo-ready) |
| W3 | 11-23 → 11-27 | S3 Processes / Board / states / honesty | **G3** Fri 11-27 |
| W4 | 11-30 → 12-04 | S4 Account / Recently / motion / verification | **G4** Fri 12-04 |

Saturdays unused. If a gate fails, the following Monday is the repair day and the next sprint loses its buffer (S4-T6) first.

---

## 6. Stop rules

| If | Then |
| --- | --- |
| S1 slips > 1 day | Ship fonts + tokens only; defer typed tabs to S2. Typography is the one thing that cannot slip |
| S2 slips > 1 day | Drop the Notes list reskin (reader only); keep Files |
| S3 slips > 1 day | Board becomes typography-only (constants extraction deferred); Processes and honesty sweep are untouchable |
| S4 slips | Cut Account section depth (profile/plan only); keep the verification gate |
| A gate fails twice | Stop and review the contract — the plan is wrong, not the code |
| A "must" task proves to need a service | Convert it to disabled-with-reason and move on; never build a stub service |

---

## 7. Blocking decisions (defaults are safe to start with)

| # | Decision | Default if unanswered | Blocks |
| --- | --- | --- | --- |
| M1 | Adopt `--ink-2 #75604B` and `--accent-strong #A0553A` (AA fixes) | adopt | S1-T2 |
| M2 | Remove the serif entirely; no Plex Serif in the reader | remove | S1-T2, S2-T3 |
| M3 | `design/tokens.css` frozen; app tokens live in `src/styles/` | freeze | S1-T2 |
| M4 | Remove "New workspace" / "New board" affordances | remove | S2-T1, S3-T4 |
| M5 | Index tick (6px rule) before section labels: adopt as identity or not | adopt | S1-T4, brand review |
| M6 | Chinese: render only, or translated locale | render only | S1-T1 subset size |

---

## 8. How this relates to the other plans

| Document | Relationship |
| --- | --- |
| `docs/planning/roadmap.md` (product M0–M6) | The MVP is *inside* that M0–M2 band at UI quality; it does not move product milestones |
| `docs/design/ui-redesign-roadmap.md` (P0–P5) | P0+P1 = S1, P2 = S2-T1, P3 = S2-T2/T3 + S3, P4 = S3-T3/T4 + S4-T3/T4, P5 = S4-T1. Nothing in the full plan is contradicted; four weeks of it are sequenced |
| `docs/product/definition.md` §11 (v1 exit) | MVP closes UI evidence for 4 of 5 sentences. "Enter as a member" (J8) stays open: it depends on N2, not on UI work |

---

## 9. Definition of done — the one-page version

1. Seven surfaces, one grammar: same seven type steps, same hairlines, same five state words.
2. No text below 11px except glyph tiles; no synthesised weight; no serif.
3. One accent per region, never on hover; contrast ≥ 4.5 for text, ≥ 3 for marks.
4. Every interactive class defines hover / active / focus / disabled; no control without a state.
5. No control that only apologises; no dead affordance; no fake success.
6. Keyboard reaches every surface; focus is always visible; `esc` always escapes.
7. Nothing animates before input; reduced motion leaves every state legible.
8. `npm run gates` green; 24 CDP assertions green; screenshots at 1280 and 1440 archived.
9. Logo-covered identity test passed by three reviewers.
10. The plan that follows this one is written before this one closes.
