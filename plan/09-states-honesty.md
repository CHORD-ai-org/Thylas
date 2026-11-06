# 09 · States, honesty, keyboard

**Sprint:** S3 · **Estimate:** 2.0 days · **Gate:** G3 · **Depends:** 04, 05, 07
**Contract:** `interaction-contract.md` §5 (matrix), §6 (honest limiter), §7 (keyboard) · **Audit:** I4, I6, I9, I10

## Objective

Remove the last class of interface lies — controls that accept a click and then explain they cannot act — and give every interactive class the four states it needs to be usable.

## Done when

- No reachable control produces an "…is not connected / nothing was sent" message **after** the click.
- Hover / active / focus-visible / disabled exist for: Button (both variants), IconButton, row (files, processes, recently, notes list), tab, input, disclosure, segmented control.
- Keyboard: tables respond to `↑↓ ↵ esc`; palette keeps focus in the input and exposes `aria-activedescendant`; `esc` closes the topmost overlay everywhere.
- `grep -rn "onClick" src | grep -E "span|div"` → 0.

## Steps

### 1 · The honesty sweep (inventory first, then act)

| # | Control | File | Today | Required |
| --- | --- | --- | --- | --- |
| 1 | Overview `Start` | `Overview.tsx` | click → notice | disabled until text; persistent caption names WAM (done in 03) |
| 2 | Files `Upload` | `Files.tsx` | click → notice | `disabled` + `title="Needs the files service — not connected in this build"` |
| 3 | Files `New folder` | `Files.tsx` | click → notice | same |
| 4 | Boards `New board` | `Boards.tsx` | click → notice | **remove** (M4) |
| 5 | Boards canvas tools ×3 | `Boards.tsx` | click → notice | `disabled` + title ("Editing is deferred") |
| 6 | Processes `Start a process` | `Processes.tsx` | click → notice | `disabled` + title; one caption under the filter bar |
| 7 | Run `Controls` | `Processes.tsx` | click → notice | disabled + title when no WAM; capability rule unchanged |
| 8 | Notes `New` | `Notes.tsx` | click → notice | `disabled` + title ("Needs the notes service") |
| 9 | Notes `Move to…` | `Notes.tsx` | click → notice | `disabled` + title; the scope caption already explains ownership |
| 10 | Account `Manage plan` | `Account.tsx` | click → notice | render as plain text + "at your provider" (link-out later) |
| 11 | Account `Create key` | `Account.tsx` | click → notice | `disabled` + title |

Rule: the reason lives on the control (`title` + `aria-describedby` to a visible caption where there is room). Never a toast, never a post-click banner.

### 2 · The state matrix

1. `src/components/ui.module.css`: complete `.button` (default/hover/active/focus/disabled/loading), `.primary` (same, with `--accent-strong`), `.iconButton`, `.chip`, `.field` input focus.
2. Page CSS: `.trow` (files, processes), `.noteRow`, `.filter`, `.treeRow`, `.treeToggle`, `.bcard`, `.segment`.
3. Loading: a `.loading` class with three static bars replacing the label, width preserved, `aria-busy="true"`. No spinner, no shimmer.
4. Error: `--error` text under the field; a retry control at the point of failure.

### 3 · Keyboard

1. Shared table keys in `Files.tsx` and `Processes.tsx`: `↑↓` move selection, `↵` open, `esc` clear, `Home/End` jump.
2. `CommandPalette.tsx`: keep focus in the input; track `activeIndex`; set `aria-activedescendant` on the input and `id` on each option; `↑↓`/`↵`/`esc`; `aria-selected` only on the active option.
3. `esc` order: palette → panel (if open) → selection. One handler, one place (`state/app.tsx` or a small `useEscape` hook).

## Files

| Action | Path |
| --- | --- |
| edit | `src/components/ui.module.css`, `src/components/ui.tsx` |
| edit | `src/pages/{Files,Processes,Notes,Boards,Overview,Account}.tsx` |
| edit | `src/pages/{files,processes,notes,boards,account}.module.css` |
| edit | `src/shell/CommandPalette.tsx` |
| add | `src/lib/useTableKeys.ts` (only if both tables would otherwise duplicate ~30 lines) |

## Verify

```bash
npm run check && npm run build
grep -rn "onClick" src | grep -E "span|<div"               # 0
grep -rn "Nothing was sent\|not connected in this build" src | grep -v "title="   # only disabled reasons
grep -rhoE ":focus-visible" src --include=*.css | wc -l    # >= 10
grep -rhoE ":disabled" src --include=*.css | wc -l         # >= 5
```

Manual pass: for each of the 11 controls above, click it in the built app — nothing may change except a tooltip. Keyboard-only: complete "open file → open board → open run → back via tab close" without touching the mouse.

## Risks

- **Disabled controls look broken** if the tooltip is the only explanation. Where the surface has room, also render one caption per region; never per control.
- `aria-activedescendant` plus a visible selection is easy to desynchronise — the input is the only element with `tabindex`, options are `role="option"` with `id`s.
- Do not add a global "not connected" banner: it would turn an honest per-control reason into a product-wide excuse.

## Handoff

11 checks focus order and reduced motion on top of this; 12 asserts it automatically.
