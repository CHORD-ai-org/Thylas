# SP-11 · Workspaces you can make and remove

**Parent:** — · **Days:** 1.0 · **Status:** Completed 11-09 · **Depends:** SP-02 (the grid), SP-05a (the notes store, for deletion)
**Decision:** [D-045](../DECISIONS.md)

## Why this unit exists

SP-02 removed the "New workspace" card because the card opened the command palette. That left the Overview footnote saying creation was not available, and no way to make a workspace at all. The rail, the palette and every URL assumed a fixed pair of samples. This unit makes the workspace a real object: created here, deleted here, with its contents accounted for.

## What it does

| # | Behaviour |
| --- | --- |
| T1 | **Create.** A dashed card in the grid opens a two-field form in place (name + Create/Cancel). The rail's section header carries a `+` that lands on `Overview?new=1` with the form already open and focused; the palette carries the same command. |
| T2 | **Validate.** Trimmed, internal whitespace collapsed, 1–40 characters, unique by name case-insensitively. Every refusal is a sentence in the card, not a toast: blank, too long (with the length), duplicate (with the name). |
| T3 | **Land.** A successful create navigates into the new workspace's Files room, which renders `This folder is empty` — the honest state of a workspace with no service behind it. |
| T4 | **Delete.** A trash control on the card (hover/focus, 24×24) replaces the card with a confirm strip: `Delete “Research”? Its 8 files, 2 boards, 9 processes and 2 notes go with it. There is no undo.` Delete or Keep it. |
| T5 | **Take it with it.** Files, boards, runs, folders and recent entries of a deleted workspace stop resolving; its notes are deleted; its tabs close. |

## What it refused

- **A modal.** The app has no dialog, and a two-word form does not earn the first one.
- **A hidden workspace.** "Deleted but still reachable by URL" makes two surfaces disagree, so deletion is a filter on every read (`liveIds()`), not a flag on one list.
- **Storing counts.** The samples' declared counts were already wrong (`notes: 5` for a workspace holding two). Counts are derived at render; a new workspace reads `0 files · 0 boards · 0 processes` because it is true.
- **Silent name de-duplication.** `Research` and `research` are refused with a message; renaming one behind the reader's back is the kind of help that loses information.

## Verification

| Gate | Result |
| --- | --- |
| `npm test` | 228/228 — 17 cases over the store: derived counts, trim, blank, too long, case-insensitive duplicate, same-slug ids, reload, sample tombstone, object filtering, note deletion, created removal, hand-edited payload, unknown version, non-JSON, reset |
| `npm run e2e` | 234/234 — 9 new: the grid offers creation, the form focuses with a label, a duplicate is refused in place, creating lands inside, the new workspace is empty with a rail row and count 3, the card counts what is there, delete asks first and says what goes, deleting removes card + rail row, the deleted URL says `Workspace not found` |
| `npx tsc --noEmit` | silent |
| `npm run lint` | 0 |
| `npm run build` | shell 156.2 KB gzip; editor still a separate chunk |
| Screenshots | `.workbuddy/shots/sp11-{grid,form,duplicate,empty,confirm,hover}.png` |

## Risks

1. A created workspace has no way to hold anything: Files is a mock and the files service is not connected. The unit proves creation and deletion, not a working empty workspace.
2. Deleting a sample is one press away in a demo whose data is the demo. The confirm names the counts, and `resetWorkspaces()` exists in code but has no surface — if the samples are deleted in a session, they come back only by clearing storage.
