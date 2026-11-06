# Interaction Model

**Status:** implemented and verified. The interactions marked **verified** were driven through CDP against the running build and asserted on DOM state (`16/16` checks, script kept outside the repo).
**Date:** 2026-11-07

---

## 1. Location is the URL

| Route | Surface | Tab |
| --- | --- | --- |
| `/overview` | Overview | none (no strip) |
| `/recently` | Recently | none |
| `/w/:wsId` | redirect → `/files` | — |
| `/w/:wsId/files` | file table | room tab, pinned |
| `/w/:wsId/files/:fileId` | file detail | object tab |
| `/w/:wsId/boards` | board index | room tab |
| `/w/:wsId/boards/:boardId` | canvas | object tab |
| `/w/:wsId/processes` | process table | room tab |
| `/w/:wsId/processes/:runId` | run detail | object tab |
| `/notes` | notes library | context tab |
| `/notes/:noteId` | note reader | object tab |
| `/account/:section` | account | none |

Rules enforced in code:

- **No navigation state in a store.** `useLocation` is the only source for "where am I"; the strip compares `pathname` to each tab's path.
- **One strip per context.** Workspace context (`ws:<id>`) and notes context (`notes`) keep separate tab sets. A file tab never appears in the notes strip.
- **Rooms are pinned and not closable; object tabs are closable.** Closing the active object tab navigates to the room index of its type — never to a blank surface (**verified**).
- **The tab set is written in one place** (`state/app.tsx: openObjectTab`). Detail pages call `useRegisterTab`; nothing else adds tabs. This removes the reconciler drift that a "derive tabs from the URL" approach always grows.

## 2. What persists, and where

| State | Storage | Key | Lifetime |
| --- | --- | --- | --- |
| Open object tabs, per context | `sessionStorage` | `thylas:tabs:v1` | reload and same-tab navigation |
| Rail collapsed | `localStorage` | `thylas:ui:v1` | permanent (**verified** across reload) |
| Panel width | `localStorage` | `thylas:ui:v1` | permanent |
| Panel open/closed | React state | — | session |
| Selection (file, card) | component state | — | while the surface is mounted |
| Intent draft, notices | component state | — | until dismissed |

No draft is persisted. There is no server, so persisting a draft would promise durability the build cannot keep.

## 3. Keyboard

| Keys | Action | Scope |
| --- | --- | --- |
| `⌘K` / `Ctrl K` | open / close command palette | global |
| `⌘\` / `Ctrl \` | show / hide context panel | global |
| `↑` `↓` | move palette selection; move file selection | palette, files |
| `↵` | open selection | palette, files |
| `esc` | close palette | palette |

`⌘1/2/3` (room jumps) exists in the prototype and is **not** implemented: room tabs already have direct keyboard access through tab order, and a numeric shortcut that conflicts with browser tab switching is a debt, not a feature.

## 4. The palette

`⌘K` opens an overlay with four groups: Go (four areas), Workspaces (three rooms × two workspaces), Recent (eight objects), View (panel, rail). Filtering is a substring match on the label and group. The footer states the truth: *Sample data · no service connected*.

The palette **navigates**; it does not search content. `capabilities()`-style semantic search would be a WAM call and is absent.

## 5. Selection drives the panel

- Files: clicking a row selects it; the panel shows size, updated, source, folder, and the three objects that reference the file. Double-click (or `↵`) opens it as a tab. The first row is selected on mount so the panel is never an unexplained empty column.
- Board: clicking a card selects it; the panel shows type, section, refs, and whether the card is live.
- Notes: the reader is the selection; the panel explains scope.

The panel never edits. Every mutating affordance in it either navigates or states which service is missing.

## 6. What is real, what is sample

| Interaction | Real? |
| --- | --- |
| Navigation, tabs, panel, palette, rail collapse, filters, selection, density toggle | **real**, local |
| Workspaces, files, notes, boards, runs | **sample data** (`src/data/mock.ts`), marked as such in the palette footer and in body copy where a number is displayed |
| Upload, new folder, new board, new workspace, start a process, run controls, move note, create key, manage plan | **not connected.** Each sets an inline notice naming the missing service and stating that nothing was sent |
| Note editing | **absent**. The reader is read-only; no editor is installed |
| Board editing (drag, edges, tools) | **absent**. The canvas renders and zooms; only selection is wired |
| File content preview | **absent**. The detail page shows identity and says bytes are not stored |

The distinction is visible in the product, not only in this document: the palette footer, the board's "read-only in this build" line, the file sheet, and each notice.

## 7. Motion

| Event | Duration | Why |
| --- | --- | --- |
| Rail collapse | 160ms `cubic-bezier(.2,0,0,1)` | spatial continuity; the content must not jump |
| Tab switch | 0 | a tab switch is not a transition |
| Panel width drag | 0 (tracking) | 1:1 with the pointer |
| Running state | 2 pulses of 600ms, then static | the only animation that means "the system is doing something" |
| Hover | 90ms background | acknowledges the pointer, no movement |
| Everything else | 0 | — |

`prefers-reduced-motion` collapses all of it to 0.001ms, including the pulse; the state dot remains as a static mark.

## 8. Empty, loading, failing

| Situation | What renders |
| --- | --- |
| Empty folder | `EmptyState` naming the three ways a file arrives |
| No boards / no scene | names the missing write model, offers the way back |
| Not found (route) | 404 page that explains the URL model and offers Overview / Recently |
| Not found (object) | the tab stays open, the surface says the object is gone — the tab is the tombstone |
| Route crash | `RouteError` via `errorElement`, with reload; the rail remains usable |
| Loading | not implemented. There is no network in this build, so a skeleton would simulate latency that does not exist |
| Failed request | not reachable: no requests. The error surfaces are built and wired to the router, not exercised |

## 9. Keyboard and accessibility baseline

Every control is a native element. Every icon-only control has `aria-label`. Tables use `role="grid"`/`row`/`gridcell` with `aria-selected`, not `tabindex` on divs. Focus is visible as a single accent ring. The rail, strip and panel are reachable in DOM order; the palette traps nothing but returns focus to the page on close (browser default).

**Not done:** a full a11y audit, a skip link, and focus management inside the palette list (arrow keys move a visual selection; `aria-activedescendant` is not set).
