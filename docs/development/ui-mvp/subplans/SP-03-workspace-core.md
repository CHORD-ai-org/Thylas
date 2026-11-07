# SP-03 · Workspace core

**Status:** Not Started · **Depends:** SP-01 · **Blocks:** SP-04, SP-05, SP-06, SP-07
**Absorbs:** the restoration half of plan/02 and the state model in `tech-stack.md` §6.

## A. Objective

Make "where am I" survive everything: a reload, a workspace switch, a deleted object, and a deep link. This is the subplan where the tab model is finished rather than demonstrated.

## B. Scope

**In:** tab set per context (`ws:<id>`, `notes`) with reconciliation on mount; workspace switching preserves the room; per-context panel width (340 / 300); tombstone tabs for deleted objects; scroll restoration per surface; `⌘\` panel; workspace settings route decision (ship or remove).
**Out:** dirty-state guard (SP-05), real permissions, org administration.

## C. Dependencies

SP-01 (typed tabs, overflow), `state/app.tsx` (single writer), `spatial-language.md` (zones).

## D. UX specification

- Switching workspace keeps the room: Files → Files; an object tab never crosses scopes.
- Reload restores the strip, the active tab, and the scroll offset of the last list.
- A deep link to a closed tab opens it and adds it (it does not silently vanish on the next reload).
- An object that no longer exists keeps its tab, dimmed, with "this file was deleted" and a dismiss action.
- Panel width is remembered per context, not globally.

## E. Visual specification

Tombstone tabs: 60% ink, 2px dashed left edge, close still available. Panel widths 340 workspace / 300 notes, 280–480 drag. No new colours.

## F. Technical plan

- `state/app.tsx` — persistence keyed by context; `reconcile()` on mount; `panelWidth` per context; scroll offsets keyed by path.
- `src/lib/tabs.ts` — pure functions: `add`, `close`, `reconcile(set, routes, activePath)`, with tests.
- `src/app/routerChildren.tsx` — add `/w/:wsId/settings` only if the surface exists; otherwise delete the dead route.
- `services/` — none.

## G. Implementation tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | `lib/tabs.ts` + tests | Pure reconciliation, 6+ cases |
| T2 | Context-keyed persistence, drop stale entries | Reload after deleting a file leaves a tombstone, not a crash |
| T3 | Workspace switch keeps room | Files → Onda → Files is one click |
| T4 | Panel width per context | Notes opens at 300, workspace at 340 |
| T5 | Scroll restoration | Returning to a list lands where it was |

## H. Acceptance criteria

1. 12 tabs across two workspaces: switching never shows A's tab in B's strip.
2. Reload restores set, active tab, and scroll within 1 s of first paint.
3. Deep link to an unopened object adds exactly one tab.
4. Deleting the selected file leaves a tombstone tab; closing it returns to Files.
5. `lib/tabs.test.ts` covers close-active, close-last, reconcile-missing, duplicate-open.

## I. Validation

`npm test` (tabs), `npm run e2e` extended with a restore case, screenshots after reload.

## J. Risks and open questions

- `sessionStorage` caps at ~5 MB; a board payload could hit it (SP-06 decides storage).
- Scroll restoration fights the router's focus handling; restore before paint, not after.
