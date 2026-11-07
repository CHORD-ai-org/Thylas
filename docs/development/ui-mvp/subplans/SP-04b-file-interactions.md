# SP-04b · File interactions: disclosure, keyboard, tombstones, honest actions

**Parent:** [SP-04](SP-04-files-and-resources.md) · **Days:** 0.75 · **Status:** Not Started · **Depends:** SP-04a

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
