# Progress

**Rule of this file:** it describes the repository, not intentions. If a line here disagrees with `git log` or the running app, the file is wrong.

Last updated: 2026-11-07 (program start).

---

## Status board

Units are the unit of execution: one branch, one commit, ≤ 1.5 days. The canonical list with order and links is [`subplans/INDEX.md`](subplans/INDEX.md).

| Unit | Parent | Status | Days | Depends | Note |
| --- | --- | --- | --- | --- | --- |
| SP-00 Foundation | — | **Completed** 11-07 | 1.5 | — | lint zones, Vitest 8, e2e 25, grammar recipes |
| SP-01 Application shell | — | **Completed** 11-07 | 2.0 | SP-00 | typed tabs, measured overflow, rail keys, states |
| SP-02 Overview | — | Not Started | 1.0 | SP-01 | next |
| SP-03a Tab model | SP-03 | Not Started | 1.0 | SP-01 | pure `lib/tabs.ts` + 8 tests |
| SP-03b Panel and restore | SP-03 | Not Started | 0.5 | SP-03a | widths per context, scroll, settings route |
| SP-04a Table grammar | SP-04 | Not Started | 0.75 | SP-03b | grammar adoption + column budgets |
| SP-04b File interactions | SP-04 | Not Started | 0.75 | SP-04a | disclosure, keyboard, tombstone, disabled actions |
| SP-05a Note model | SP-05 | **Blocked** (Q-1) | 1.0 | SP-04a | store, link parser, backlinks |
| SP-05b Editor and save | SP-05 | **Blocked** (Q-1) | 1.75 | SP-05a | conflict + dirty guard |
| SP-05c Note library | SP-05 | Not Started | 1.25 | SP-05b | list, search, panel |
| SP-06a Scene model | SP-06 | Not Started | 0.75 | SP-04a | geometry + schema |
| SP-06b Viewport | SP-06 | Not Started | 1.25 | SP-06a | pointer-anchored zoom, one pointer session |
| SP-06c Cards | SP-06 | Not Started | 1.5 | SP-06b | create, drag, snap, undo |
| SP-06d Edges | SP-06 | Not Started | 1.5 | SP-06c | anchors, labels, hit areas |
| SP-07a AI endpoint | SP-07 | Not Started | 1.0 | SP-03b | middleware + error taxonomy |
| SP-07b AI panel | SP-07 | Not Started | 0.75 | SP-07a, SP-02 | four states, footer meta |
| SP-07c Process states | SP-07 | Not Started | 0.75 | SP-03b | filters, controls, labelled simulator |
| SP-08 Account | — | Not Started | 0.5 | SP-01 | density persistence, zero accent |
| SP-09a Gates + e2e | SP-09 | Not Started | 1.0 | SP-02…SP-08 | 10 rules, ≥ 30 assertions |
| SP-09b Visual audit | SP-09 | Not Started | 1.0 | SP-09a | screenshots, a11y, identity test |

Remaining: **18 days**. Critical path: SP-02 → SP-03a → SP-03b → SP-04a → SP-06a → SP-06b/c/d → SP-09a.

---

## What actually exists today

| Area | State | Evidence |
| --- | --- | --- |
| Build | Vite 6.4.5, React 19.3.1, react-router-dom 7.18.5, TypeScript 5.7.3 | `package.json`, `npm ls` |
| Routes | 15, all mounted | `src/app/routerChildren.tsx` |
| Surfaces | 9 screens render | screenshots in `.workbuddy/shots/` |
| Tabs | Open/close/persist, rooms pinned | CDP suite 16/16 |
| Typography | Plex/Noto self-hosted, 7 steps, no serif | `cf01df0`, specimen page |
| Data | All mock (`src/data/mock.ts`), no network | — |
| Tests | CDP script outside the repo (`.workbuddy/tmp/cdp.mjs`), 16 assertions | run 2026-11-07 |
| Lint | ESLint 10 + `typescript-eslint`, layering zones; `npm run lint` clean | `eslint.config.js` |
| Unit tests | Vitest 5, 8 assertions over routes/selectors | `src/lib/routes.test.ts`, `src/data/selectors.test.ts` |
| E2E | 25 assertions, self-starting dev server | `scripts/ui-checks.mjs` |

## Known defects (carried into the subplans)

| # | Defect | Where | Owner SP |
| --- | --- | --- | --- |
| K1 | Nine controls accept a click then apologise | Overview, Files, Boards, Processes, Notes, Account | SP-04 / SP-07 |
| K2 | Folder disclosure is a `span` with `onClick` | `src/pages/Files.tsx` | SP-04 |
| K3 | Reader title 32px but list meta still mixed sizes | `src/pages/notes.module.css` | SP-05 |
| K4 | Board is read-only and its labels are ~8px at fit | `src/pages/Boards.tsx` | SP-06 |
| K5 | Density preference does not persist | `src/pages/Account.tsx` | SP-08 |
| K6 | `.notice` is duplicated in six page stylesheets (grammar exists, pages not migrated) | `src/pages/*.css` | SP-04 |
| K7 | Roaming tabindex in the rail not implemented (arrows only) | `src/shell/Rail.tsx` | SP-09 |
| K8 | Scene dimensions hardcoded in TSX and CSS | `Boards.tsx`, `boards.module.css` | SP-06 |
| K9 | No loading state language anywhere | all surfaces | SP-07 |

## Validation log

| Date | Check | Result |
| --- | --- | --- |
| 11-07 | `npm run check` | pass |
| 11-07 | `npm run build` | 127.9 KB gzip JS / 10.0 KB CSS |
| 11-07 | CDP suite (16) | 16/16 |
| 11-07 | Font trace | 4 woff2, 0 CJK on English routes |
| 11-07 | `npm run lint` | 0 problems; a deliberate `shell → pages` import fails as designed |
| 11-07 | `npm test` | 8/8 |
| 11-07 | `npm run e2e` | 25/25 (typed tabs, overflow, active-tab visibility, rail arrows) |
| 11-07 | Focus ring (real Tab) | `inset 0 0 0 1px rgb(181,111,80)` on the rail item |

## Next concrete action

1. **SP-02 Overview** (unit, 1 day): display step, computed lede, remove "New workspace", disable the intent input with a visible reason (until SP-07). Exit when the count changes with the mock and no accent appears on hover.
2. Then **SP-03a** (`lib/tabs.ts` + tests) and **SP-03b** (panel/restore), which unblock Files, Notes, Board and AI. Do not start SP-05 until Q-1 is answered.

## Resolved

| # | Defect | Resolved in | Evidence |
| --- | --- | --- | --- |
| K1 | Object tabs carried no type | SP-01 | every object tab has an svg glyph; e2e assertion |
| K2 | Strip scrolled horizontally / no overflow | SP-01 | measured limit 3–8; e2e "strip does not scroll" passes |
