# Progress

**Rule of this file:** it describes the repository, not intentions. If a line here disagrees with `git log` or the running app, the file is wrong.

Last updated: 2026-11-07 (program start).

---

## Status board

| SP | Name | Status | Done | Remaining | Blocking |
| --- | --- | --- | --- | --- | --- |
| SP-00 | Foundation | **In Progress** | Fonts + 7-step scale shipped (`cf01df0`); type specimen; palette/geometry tokens | ESLint zone rules, Vitest, committed E2E harness, `grammar.module.css` | — |
| SP-01 | Application shell | **In Progress** | Four-zone grid, rail, strip, panel, palette, collapse persistence | Typed tabs, `+N` overflow, shell state matrix, rail keyboard | SP-00 lint zones |
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
| Lint | **none** — no ESLint config | `package.json` |
| Unit tests | **none** | — |

## Known defects (carried into the subplans)

| # | Defect | Where | Owner SP |
| --- | --- | --- | --- |
| K1 | Object tabs carry no type glyph | `src/shell/TabStrip.tsx` | SP-01 |
| K2 | No tab overflow; strip scrolls horizontally | same | SP-01 |
| K3 | Nine controls accept a click then apologise | Overview, Files, Boards, Processes, Notes, Account | SP-04 / SP-07 |
| K4 | Folder disclosure is a `span` with `onClick` | `src/pages/Files.tsx` | SP-04 |
| K5 | Reader title 32px but list meta still mixed sizes | `src/pages/notes.module.css` | SP-05 |
| K6 | Board is read-only and its labels are ~8px at fit | `src/pages/Boards.tsx` | SP-06 |
| K7 | Density preference does not persist | `src/pages/Account.tsx` | SP-08 |
| K8 | `.notice` is duplicated in six page stylesheets | `src/pages/*.css` | SP-00 (grammar) |
| K9 | Scene dimensions hardcoded in TSX and CSS | `Boards.tsx`, `boards.module.css` | SP-06 |
| K10 | No loading state language anywhere | all surfaces | SP-07 |

## Validation log

| Date | Check | Result |
| --- | --- | --- |
| 11-07 | `npm run check` | pass |
| 11-07 | `npm run build` | 127.9 KB gzip JS / 10.0 KB CSS |
| 11-07 | CDP suite (16) | 16/16 |
| 11-07 | Font trace | 4 woff2, 0 CJK on English routes |
| — | `npm run lint` | not configured |
| — | `npm test` | not configured |

## Next concrete action

1. SP-00: add ESLint zones + Vitest, commit the E2E harness, add `grammar.module.css` skeletons. Exit when `npm run lint` fails on a deliberate cross-layer import and `npm test` runs one pure test.
2. SP-01: typed tabs, `+N`, shell states, rail keyboard. Exit when the tab sheet and keyboard-only path pass at 1280/1440.
