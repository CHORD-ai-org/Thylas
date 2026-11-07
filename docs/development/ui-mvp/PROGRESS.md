# Progress

**Rule of this file:** it describes the repository, not intentions. If a line here disagrees with `git log` or the running app, the file is wrong.

Last updated: 2026-11-07 (program start).

---

## Status board

| SP | Name | Status | Done | Remaining | Blocking |
| --- | --- | --- | --- | --- | --- |
| SP-00 | Foundation | **Completed** 11-07 | Zone lint, Vitest + 8 tests, committed E2E harness (25), `grammar.module.css`, `lib/types.ts` split | — | — |
| SP-01 | Application shell | **Completed** 11-07 | Typed tabs, measured `+N` overflow, rail arrows/Home/End, four states, panel meta slot | Roving tabindex → SP-09 (D-015) | — |
| SP-02 | Overview | Not Started | Read-only page exists with intent input, Continue, Needs you, workspaces, recently | Display step, computed copy, honest disabled intent, accent/hover pass | SP-01 |
| SP-03 | Workspace core | Not Started | Routes, restoration of tabs per context, workspace switching | Selection ownership, panel width per context, restoration edge cases | SP-01 |
| SP-04 | Files and resources | Not Started | Tree + table + preview + panel (mock) | Table grammar, disclosure as a real button, 1280 column budget, tombstone rows | SP-03 |
| SP-05 | Notes and documents | Blocked | Reader with three-column layout (read-only, mock notes) | Markdown editor, wikilinks, backlinks, folders, autosave, conflict | Q-1 (D-002), SP-04 |
| SP-06 | Whiteboard | Not Started | Read-only scene, fit-to-view, selection, zoom buttons | Drag, create, connect, anchors, snapping, undo, persistence | SP-04 |
| SP-07 | AI and processes | Not Started | Process list + run detail (mock), five states | `/api/ai` middleware, AI panel, loading/error states, capability-gated controls | SP-03 |
| SP-08 | Account and settings | Not Started | Five sections, density preference (session only) | Density persistence, type/geometry pass, zero-accent check | SP-01 |
| SP-09 | Integration and polish | Not Started | — | Cross-surface audit, screenshots, identity test, perf pass | SP-01…SP-08 |

Legend: Not Started · Planning · In Progress · Blocked · Review Required · Completed.

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

1. **SP-02 Overview**: display step, computed lede, remove "New workspace", disable the intent input with a visible reason (until SP-07). Exit when the count changes with the mock and no accent appears on hover.
2. Then SP-03 (restoration + `lib/tabs.ts` tests), which unblocks Files, Notes, Board and AI.

## Resolved

| # | Defect | Resolved in | Evidence |
| --- | --- | --- | --- |
| K1 | Object tabs carried no type | SP-01 | every object tab has an svg glyph; e2e assertion |
| K2 | Strip scrolled horizontally / no overflow | SP-01 | measured limit 3–8; e2e "strip does not scroll" passes |
