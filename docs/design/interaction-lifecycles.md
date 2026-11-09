# Interaction Lifecycles

**Status:** contract, draft for review. 2026-11-09.
**Purpose:** a feature is not finished when its happy path renders. It is finished when each of the ten states below has a defined behaviour — including the ones nobody screenshots.
**Companions:** `interaction-contract.md` (rules), `motion-guidelines.md` (timing), `../development/ui-mvp/QUALITY-BAR.md` (how it is scored).

## The ten states

`entry · open · select · edit · contextual · navigate · switch · close · save/commit · restore · fail`

Not every feature has all eleven. Every feature has to answer for the ones it owns, and say "not applicable" in writing for the rest.

---

## 1. Workspace & Files

| State | Must exist | Must never happen | Current |
| --- | --- | --- | --- |
| Entry | Landing inside a workspace restores the tab strip of **that** workspace; first paint is the last object, not an empty shell | cross-workspace tab bleed; a flash of the previous workspace's strip | verified (SP-03a/b) |
| Open | An object opens as a typed tab; the tab's title is the object's name; the tab survives reload | a second tab for the same object; opening replaces the current tab | verified |
| Select | Row selection is visible without colour coding (tone + 1px inset); selection is what the panel reads | selection that only exists on hover; panel showing a different object than the selected row | verified (SP-04b) |
| Edit | Rename/move is possible where the service allows; where it does not, the control is **absent** or disabled with a reason | a control that accepts input and then refuses | verified (`not connected in this build` banners) |
| Contextual | One primary action per row (open), plus at most two secondary; everything else in the panel | a `…` menu that hides all actions; duplicate actions in row and panel | **gap** — panel is the only action surface today |
| Navigate | Breadcrumb, tab strip and rail agree on location; browser back walks tabs | back leaving the app; breadcrumb path that does not match the rail | verified |
| Switch | Workspace switch keeps the room, restores that workspace's strip and scroll | a full remount that loses scroll and tab order | verified |
| Close | Closing a tab returns focus to the next tab, never to `<body>` | focus lost to body; closing the last tab leaving a blank pane with no message | **unverified** |
| Save/commit | Nothing to save on this surface; all state is in the URL/store | silent local state that disappears on reload | verified |
| Restore | Reload restores tabs, active tab, panel width, scroll per region | restore that replays transitions | verified |
| Fail | Missing workspace/object produces a named error with a way back (`Workspace not found. … Recently lists what you can still reach.`) | a blank canvas; a spinner that never resolves | verified (good example) |

## 2. Notes & Documents

| State | Must exist | Must never happen | Current |
| --- | --- | --- | --- |
| Entry | Opening a note puts the cursor where the user left it, or at the top on first open | editor always focused with a select-all | **unverified** |
| Open | Reading and editing are the same surface; no "edit mode" toggle | a preview mode that hides the Markdown source | verified (SP-05b) |
| Select | Text selection, block selection, and `[[` link selection are visually distinct | link picker stealing arrow keys from the editor | verified |
| Edit | Markdown is the source; typing does not reflow the page; the caret never leaves the viewport | autosave that steals focus; re-render on every keystroke | verified |
| Contextual | Link to note, open backlink, copy reference, delete — reachable without leaving the text | actions that require opening the file tree | **gap** |
| Navigate | Backlinks and outgoing links are one click; `⌘[` returns | link that navigates and loses unsaved text | verified (links), unverified (return) |
| Switch | Switching notes retains each note's scroll position | one global scroll | **unverified** |
| Close | Closing a dirty note asks once, in place, not in a modal | silent loss; modal dialog for a save prompt | verified (dirty guard) |
| Save/commit | Idle save with an honest state (`saved 2s ago` / `unsaved` / `conflict`) | "Saved" shown before the write resolves | verified |
| Restore | A conflicting version is reviewable, not overwritten | last-writer-wins | verified (conflict review) |
| Fail | Write failure keeps the text and states what failed | text loss on a failed request | **unverified** |

## 3. Whiteboard

| State | Must exist | Must never happen | Current |
| --- | --- | --- | --- |
| Entry | Board opens at the last viewport for that board | always reset to origin | verified (SP-06b) |
| Open | Card content is readable at 100%; below ~60% cards degrade to title-only | unreadable text at zoom-out treated as fine | **unverified** |
| Select | Single, multi (marquee), and section selection are distinct; count is shown while dragging | selection that survives undo of the selected object | partially verified |
| Edit | Card text edits in place; card size has handles on all eight edges | editing that requires leaving the canvas | verified |
| Contextual | Right-click menu per object; anchor points on hover for connecting | anchors only after selection (HeptaBase measured this as a defect) | verified |
| Navigate | Pan (wheel/drag), zoom to pointer, zoom to fit, minimap | zoom collapsing under rapid wheel events (measured failure in the reference repo) | verified (30/30 steps) |
| Switch | Switching boards preserves each board's viewport | shared viewport across boards | **unverified** |
| Close | Leaving a board with no pending change exits instantly | a save prompt for a board that autosaves | verified |
| Save/commit | Board state persists per change; undo covers move/resize/edge/label | undo that restores geometry but not selection | verified (undo), gap (selection) |
| Restore | Reload returns to the same viewport and selection | selection restored to a deleted object | **unverified** |
| Fail | Corrupt or missing scene shows an empty board with a named reason | blank canvas indistinguishable from an empty board | **unverified** |

## 4. AI (DeepSeek, in-panel)

| State | Must exist | Must never happen | Current |
| --- | --- | --- | --- |
| Entry | The panel is opened from where the question arises (selection, note, file, run) | a global "Chat" destination | verified (panel) |
| Open | Panel states what it will read before sending: workspace, selection, or 0 sources | an implicit whole-workspace read | **gap** — no context chip |
| Select | Selected text/files can be attached explicitly; each attachment is removable | attachments inferred silently | **gap** |
| Edit | The question is editable after a failure without retyping context | clearing the composer on error | verified (retry by `retryable`) |
| Contextual | Insert result as note / card / nothing; inserting names its provenance | auto-writing into a note | **gap** — insertion not present |
| Navigate | A result that references an object links to it | plain-text mentions that look like links | **unverified** |
| Switch | Closing the panel and reopening keeps the last answer for that context | answers leaking across workspaces | **unverified** |
| Close | Closing mid-stream aborts the request | a request that continues after close with no surface | verified (abort) |
| Save/commit | Nothing is saved until the user inserts it | auto-persisting answers as notes | verified (by absence) |
| Restore | Reopening shows the last answer with its timestamp and model | a fabricated "history" | **unverified** |
| Fail | Seven error kinds, each with the next action; disabled when key absent | "Something went wrong" | verified (SP-07a/b) |

---

## Cross-cutting requirements

| Requirement | Applies to | Test |
| --- | --- | --- |
| **Focus never falls to `<body>`** after close/delete/abort | all four | keyboard-only walkthrough, 1 assertion per feature |
| **Empty state names the next action**, never "No data" | all lists | grep for "No data" → 0 |
| **Loading is a state, not a spinner over the whole surface** | notes, AI, boards | freeze-frame during a slow request |
| **Error is a sentence with a verb**, ≤ 20 words | all | copy review |
| **Reduced motion removes everything but the live dot** | all | emulation screenshot |
| **Every state change is visible without colour** | all | greyscale screenshot at each state |

## Gaps to schedule

14 gaps are marked above. They group into four units:

1. **Context chip + attachment** (AI) — 0.5 day.
2. **Result insertion with provenance** (AI → note / board card) — 0.5 day, depends on the artifact ingestion surface that does not exist yet (B2 in `definition.md`); scope it as *insert as note* only.
3. **Row-level primary action** (Files, Notes) — 0.25 day.
4. **State honesty sweep** (focus after close, note write failure, board scene failure, per-board viewport) — 0.5 day.

These are amendments to closed subplans, not new features. They are scheduled in `SP-10 §F` and verified in `SP-09b`.
