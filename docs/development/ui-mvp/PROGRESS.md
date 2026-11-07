# Progress

**Rule of this file:** it describes the repository, not intentions. If a line here disagrees with `git log` or the running app, the file is wrong.

Last updated: 2026-11-07 12:35 (SP-04 complete).

---

## Status board

Units are the unit of execution: one branch, one commit, ≤ 1.5 days. The canonical list with order and links is [`subplans/INDEX.md`](subplans/INDEX.md).

| Unit | Parent | Status | Days | Depends | Note |
| --- | --- | --- | --- | --- | --- |
| SP-00 Foundation | — | **Completed** 11-07 | 1.5 | — | lint zones, Vitest 8, e2e 25, grammar recipes |
| SP-01 Application shell | — | **Completed** 11-07 | 2.0 | SP-00 | typed tabs, measured overflow, rail keys, states |
| SP-02 Overview | — | **Completed** 11-07 | 1.0 | SP-01 | computed lede + zero state, honest disabled Start, no new-workspace card, shared section tick |
| SP-03a Tab model | SP-03 | **Completed** 11-07 | 1.0 | SP-01 | pure `lib/tabs.ts` 12 tests, v2 persistence, tombstones, cross-scope isolation |
| SP-03b Panel and restore | SP-03 | **Completed** 11-07 | 0.5 | SP-03a | per-context widths, named-region scroll restore, room-preserving switch, settings deleted |
| SP-04a Table grammar | SP-04 | **Completed** 11-07 | 0.75 | SP-03b | grammar adoption, measured 3-width budgets, no truncation |
| SP-04b File interactions | SP-04 | **Completed** 11-07 | 0.75 | SP-04a | real disclosure, 5-key table, tombstone, honest disabled actions |
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

Remaining: **14 days**. Critical path: SP-06a → SP-06b/c/d → SP-09a; SP-07a is independently unblocked. SP-05 stays blocked on Q-1.

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
| Tests | legacy 16-assertion smoke script, superseded by the committed suite | `.workbuddy/tmp/cdp.mjs` |
| Lint | ESLint 10 + `typescript-eslint`, layering zones; `npm run lint` clean | `eslint.config.js` |
| Unit tests | Vitest 5, 25 assertions over routes/selectors/lede/tabs | `src/lib/{routes,tabs}.test.ts`, `src/data/selectors.test.ts` |
| E2E | 81 assertions, self-starting dev server | `scripts/ui-checks.mjs` |
| Files | shared table grammar, keyboard table, tombstones, disabled actions | `659cb2f`, `0eab7c1` |
| Tabs | pure `lib/tabs.ts`; versioned sessionStorage v2; tombstones | `e39d117` |
| Panel / scroll | per-context widths, one global scroll restorer | `f2ec062` |

## Known defects (carried into the subplans)

| # | Defect | Where | Owner SP |
| --- | --- | --- | --- |
| K1 | Other surfaces still accept a click then apologise (Overview and Files are clean) | Boards, Processes, Notes, Account | SP-06 / SP-07 / SP-08 |

| K3 | Reader title 32px but list meta still mixed sizes | `src/pages/notes.module.css` | SP-05 |
| K4 | Board is read-only and its labels are ~8px at fit | `src/pages/Boards.tsx` | SP-06 |
| K5 | Density preference does not persist | `src/pages/Account.tsx` | SP-08 |
| K6 | Three page-local `.notice` recipes remain (down from six) | `account/boards/processes.module.css` | SP-06 / SP-07 / SP-08 |
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
| 11-07 | `npm run lint` (SP-02) | 0 problems |
| 11-07 | `npm test` (SP-02) | 11/11, including `pendingLede(0/1/2)` |
| 11-07 | `npm run e2e` (SP-02) | 37/37; 12 new Overview assertions |
| 11-07 | `npm run build` (SP-02) | CSS 54.5 KB / JS 128.8 KB gzip |
| 11-07 | Zero-needs-input DOM | lede + empty copy both changed; mock restored byte-for-byte |
| 11-07 | `grep accent overview.module.css` | 0 hits; hover is a tint only |
| 11-07 | `npm test` (SP-03a) | 23/23; 12 pure tab-model cases |
| 11-07 | `npm run e2e` (SP-03a) | 44/44; deep link, back/forward, tombstone, two scopes |
| 11-07 | Broken storage payload | app renders normally, malformed tabs dropped |
| 11-07 | `npm test` (SP-03b) | 25/25; room detection and scope switching |
| 11-07 | `npm run e2e` (SP-03b) | 55/55; real drag, width persistence, scroll ±2px, room switch |
| 11-07 | `npm run build` (SP-03b) | CSS 54.7 KB / JS 130.4 KB gzip |
| 11-07 | Column budgets (SP-04a) | 1440: 652px/5 cols/332px name · 1280: 492px/4/272px · 1180: 392px/4/212px; no h-scroll |
| 11-07 | `npm run e2e` (SP-04a) | 61/61; grammar, 44/32 rows, tabular, three widths |
| 11-07 | `npm run e2e` (SP-04b) | 81/81; disclosure, 5 keys, disabled actions, tombstone lifecycle |
| 11-07 | Static honesty checks | `<span onClick>` 0 · apology state 0 · page-local `.notice` 3 |
| 11-07 | `npm run build` (SP-04b) | CSS 55.0 KB / JS 131.0 KB gzip |

## Next concrete action

1. **SP-06a Scene model** (0.75 day): extract the whiteboard's geometry and schema constants before touching the pointer layer. Exit when the scene still renders identically (screenshot diff) and the dimensions live in one file.
2. Alternatively **SP-07a AI endpoint** (1 day), which is independently unblocked and delivers the secure DeepSeek path. **Do not start SP-05 until Q-1 (CodeMirror 6) is answered.**

## Resolved

| # | Defect | Resolved in | Evidence |
| --- | --- | --- | --- |
| R1 | Object tabs carried no type | SP-01 | every object tab has an svg glyph; e2e assertion |
| R2 | Strip scrolled horizontally / no overflow | SP-01 | measured limit 3–8; e2e "strip does not scroll" passes |
| R3 | Hard-coded "Two processes need a decision" lede | SP-02 | `pendingLede(needsInput().length)`; zero state verified in the DOM |
| R4 | "New workspace" card opened the palette as an apology | SP-02 | card removed; one sentence names the missing workspace service |
| R5 | Intent Start clicked, then apologised | SP-02 | Start disabled with a persistent reason; no post-click banner |
| R6 | A parquet file was shown with a `PDF` glyph | SP-02 | glyph derives from `getFile(id).kind` |
| R7 | Accent-coloured hover text on Overview rows | SP-02 | hover is a tint; zero local accent declarations |
| R8 | Notes panel opened at 340 though the spec said 300 | SP-03b | per-context defaults: notes 300, workspace 340 |
| R9 | An already-expanded workspace row collapsed instead of switching | SP-03b | the row always navigates when it is not active |
| R10 | Dead `/w/:id/settings` route builder | SP-03b | deleted; router and route module both checked |
| R11 | Folder chevron was a `span` with `onClick` | SP-04b | two sibling buttons, `aria-expanded`, keyboard target |
| R12 | Upload / New folder apologised after being clicked | SP-04b | disabled with `title` + persistent reason line |
| R13 | At 1180 `1.2 GB` wrapped and names ellipsised | SP-04a | 430px container step, 11px mono, names fully readable |
| R14 | Table-head, label and banner recipes were copied per page | SP-04a/04b | `grammar.tableHead` / `label` / `banner` / `limit` consumed |
