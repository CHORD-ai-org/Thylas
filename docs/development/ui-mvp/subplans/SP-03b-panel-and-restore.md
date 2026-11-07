# SP-03b · Panel widths, scroll restore, workspace semantics

**Parent:** [SP-03](SP-03-workspace-core.md) · **Days:** 0.5 · **Status:** Completed 2026-11-07 · **Depends:** SP-03a

## Objective

Make the working environment feel continuous: the panel keeps the width you gave it per context, a list returns where you left it, and switching workspace keeps the room you were in.

## Scope

**In:** per-context panel width (workspace 340 / notes 300, 280–480 drag); scroll offset per path; workspace switch keeps room; `/w/:id/settings` either ships a minimal surface or the route is deleted; persist width with the same `ui` object as rail density.
**Out:** tab model (SP-03a), panel content redesign.

## UX

Parent §D. Specifically: `Files → switch to Onda Lab → Files` is one click, not two; back from an object restores the list's scroll position within 100ms of paint.

## Visual

Parent §E. Panel boundary stays a 1px line; no new radius or shadow.

## Technical plan

- `state/app.tsx`: `panelWidth: { workspace: number; notes: number }` in `thylas:ui:v2`; migrate v1 scalar.
- `src/lib/scroll.ts`: `save(path, y)` / `restore(path)` in a `Map` persisted in `sessionStorage`; called by list surfaces in `useLayoutEffect`.
- `ContextPanel` reads width from the store by context prop.
- Router: delete `/w/:wsId/settings` if no surface ships (a dead route is a dead sidebar row waiting to happen).

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Per-context width + migration | Notes 300, workspace 340, survives reload |
| T2 | Scroll save/restore | Returning to a list restores position |
| T3 | Workspace switch keeps room | Verified for Files/Boards/Processes |
| T4 | Resolve the settings route | Shipped or deleted, no stub |

## Acceptance

1. Drag the notes panel to 300, reload → 300; drag workspace panel to 420, reload → 420; both independent.
2. Scroll a 20-file list, open a file, close the tab → list is where it was.
3. Switch workspace from Files → still Files; from a file tab → room index, no cross-scope tab.
4. `grep -rn "settings" src/app/routerChildren.tsx` matches either a real element or nothing.

## Validation

Manual pass at 1280/1440; `npm run e2e` adds a width-persistence assertion; screenshots of both contexts.

## Risks

- Scroll restore before layout completes lands at 0. Use `useLayoutEffect` and restore after data render.
- Two widths in `localStorage` invite a third; keep the shape keyed by context name, not by route.

## Result (2026-11-07, done)

`thylas:ui:v2` now holds `panelWidth` keyed by context (workspace 340 / notes 300, clamped 280–480); v1's single scalar migrates into the workspace slot. `ContextPanel` takes an explicit `ctx` prop, and `AppShell` no longer writes an unused `--panel-w` variable. `lib/scroll.ts` + `shell/ScrollRestoration.tsx` restore scroll before paint for every element that names itself with `data-scroll-region`. `switchWorkspace` keeps the room; the dead settings route is gone.

**Deviations, with reasons**

1. **The settings route is deleted, not shipped** (D-019). No element, no link and no data ever existed for it; a stub would be a fake control, and a dead route is a dead sidebar row waiting to happen.
2. **Scroll restoration is one global component with named regions, not a per-page `useScrollRestore` hook** (D-020). Five surfaces had the same lifecycle; one `useLayoutEffect` in the shell is less code and cannot drift. Names (`files-table`, `notes-reader`, `page`, …) avoid the index drift that opening a panel would cause.
3. **`panelMeta` needed `text-transform: none`.** The shared header uppercases its label, so the count rendered as "5 ITEMS"; a screenshot caught it.
4. **A real bug was fixed while implementing T3:** clicking an already-expanded workspace row used to collapse it instead of switching scope. The row now always navigates when it is not the active workspace.

**Evidence:** `npm test` 25/25 · `npm run e2e` 55/55 (11 new, including a real CDP pointer drag that changes only the notes width to 360, a workspace width that survives a reload at 420, scroll offset restored within 2px after two navigations, both workspace-switch cases, and two static checks that no settings route exists) · build CSS 54.7 KB / JS 130.4 KB gzip · screenshots `sp03-notes`, `sp03-files-v2`.

**Left:** the board canvas has no named scroll region yet (SP-06 owns its viewport); scroll keys are per-path, so two routes never share an offset.
