# SP-04b · File interactions: disclosure, keyboard, tombstones, honest actions

**Parent:** [SP-04](SP-04-files-and-resources.md) · **Days:** 0.75 · **Status:** Completed 2026-11-07 · **Depends:** SP-04a

## Objective

Remove the last invalid control and the last apology in Files: the folder chevron becomes a real button, the table becomes keyboard-operable, a deleted file leaves a tombstone instead of vanishing, and Upload/New folder become disabled with a stated reason.

## Scope

**In:** split disclosure (`<button aria-expanded>` sibling to the row button); `↑↓ ↵ esc Home End` table model; tombstone row + tombstone tab; disabled Upload/New folder with `title` + one caption; empty-folder copy; remove the notice state.
**Out:** real upload, drag-to-move, previews.

## UX

Parent §D. Clicking a row selects; double-click or `↵` opens; `esc` clears; the chevron expands without selecting; a deleted file is still visible with "deleted" and a dismiss action.

## Visual

Parent §E. Tombstone: 55% ink, 2px dashed left edge, no other change. Disabled buttons: 40% ink, `not-allowed`, no hover change.

## Technical plan

- `Files.tsx`: replace the `span` toggle; move selection state to an index-based model; add `useTableKeys` (shared with Processes if identical).
- `files.module.css`: `.treeToggle` (24px hit, icon rotates), `.trowTombstone`.
- Remove `notice` state and its banner; the reason lives on the disabled control and in the caption.
- `data/mock.ts`: add one tombstoned file to demonstrate the state.

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Disclosure split | Valid HTML, keyboard operable |
| T2 | Table keyboard model | `↑↓ ↵ esc Home End` |
| T3 | Tombstone row + tab | Deleted file remains visible |
| T4 | Disabled actions + reason | No click-only apology |
| T5 | Empty-folder copy | Names the three arrival paths |

## Acceptance

1. `grep -rn "onClick" src/pages/Files.tsx | grep span` → 0.
2. Upload/New folder are `disabled`, have a `title` naming the service, and produce no state change when clicked.
3. Keyboard-only: expand a folder, select four rows, open one, close it, clear selection.
4. Deleting the selected file leaves a tombstone row and a tombstone tab; dismissing both leaves no orphan tab.
5. No post-click banner exists in the file; `grep "Nothing was sent"` → 0.

## Validation

`npm run e2e` adds disclosure + disabled + tombstone assertions; screenshots of selected/disabled/tombstone states; keyboard run recorded.

## Risks

- Splitting the disclosure changes the row's click target: keep row = select, toggle = expand, never both.
- Tombstones need an owner for dismissal; if the tab dismisses but the row does not, the state looks broken.

## Result (2026-11-07, done)

The folder chevron is a real `<button aria-expanded>` beside the select button; the table answers `↑↓ Home End ↵ esc`; Escape clears selection and the panel says "Nothing selected". Upload and New folder are `disabled` with `title` + `aria-describedby`, and one quiet `grammar.limit` line states the reason before any click. The `notice` state and its banner are deleted. A deleted object appears as a dimmed dashed row plus its dimmed dashed tab, and Dismiss removes both.

**Deviations, with reasons**

1. **The tombstone is derived from the open tab set, not from a fake deleted file in `data/mock.ts`** (D-021). The plan proposed adding sample data; that would have created two owners for dismissal (a row flag and a tab flag) and a control that pretends to delete. Reconcile already knows which objects no longer resolve, so the tab is the single owner: close it and both disappear. No orphan is possible.
2. **Disabled styling moved into the shared `Button` primitive.** Files needed a disabled state and Overview already had a local one; two copies would drift. `overview.module.css`'s `.startBtn:disabled` is deleted and the Start button was re-screenshotted to confirm it is still muted.
3. **`grammar.limit` is a new quiet recipe, not the accent-tinted `grammar.banner`** (D-022). A missing service is not a live state; a permanent terracotta banner on every Files page would not be quiet.
4. **`useTableKeys` was not extracted.** Processes has no keyboard model yet, so a shared hook would have one consumer. The five-key logic stays in `Files.tsx` with browser assertions; SP-07 can extract it when the second consumer exists (the same "third user" rule that governs components).

**Evidence:** 20 new browser assertions (81 total) — static checks (`<span onClick>` = 0, no apology state, ≤3 notice blocks), disabled actions, disclosure, all five keys, Enter + tab close, and the full tombstone lifecycle — plus `tsc` / `lint` / `test` / `build` clean. Screenshots `sp04b-default`, `sp04b-cleared`, `sp04b-tombstone`, `sp04b-overview`.

**Left:** a real delete action (no files service), drag-to-move, previews.
