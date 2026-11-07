# SP-04 · Files and resources

**Status:** Not Started · **Depends:** SP-03 · **Blocks:** SP-05, SP-06
**Absorbs:** plan/04, the honesty sweep for file actions.

## A. Objective

One table grammar for the most-used surface, a disclosure that is a real control, and no action that only apologises. Files is also the reference target for notes and board cards, so its identity and selection model must be settled here.

## B. Scope

**In:** table via `grammar.module.css`; folder disclosure as `<button aria-expanded>`; row selection + keyboard (`↑↓ ↵ esc Home End`); detail panel (size/updated/source/folder/used-by); tombstone rows; empty folder; "upload"/"new folder" as disabled-with-reason; 1280/1440 column budgets.
**Out:** real upload, previews of real bytes, file editing, drag-to-move, real search.

## C. Dependencies

SP-03 (restoration, selection ownership), SP-00 (`grammar.module.css`).

## D. UX specification

- Click selects, double-click opens a tab, `↵` opens, `esc` clears; selection drives the panel.
- The chevron expands a folder without selecting it; `space` and `↵` work on it when focused.
- Upload and New folder are `disabled` with a title naming the missing service. No click handler exists.
- A deleted file keeps a tombstone row until dismissed; the tab (if open) tombstones too.
- Empty folder names the three arrival paths (upload, import, process output).

## E. Visual specification

Header 11/16 mono, 44px, hairline; rows 32px; sizes/updated/used-by tabular; file name 13/20 500; produced badge mono. Selection `--accent-weak`; hover tint only. Five columns at 1440, four at 1280 (source drops, names never truncate below ~20 chars).

## F. Technical plan

- `src/pages/Files.tsx` — split the disclosure; remove notice state; table keyboard hook.
- `src/pages/files.module.css` — consume grammar; keep local grid template; container query already present.
- `src/lib/useTableKeys.ts` — shared by Files and Processes if both need identical keys.
- Data: `data/mock.ts` unchanged except labels; `usedBy` already models references.

## G. Implementation tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Adopt `grammar.label` / `.tableHead` / `.banner` | One banner, one header recipe |
| T2 | Disclosure split into two buttons | Keyboard + valid HTML |
| T3 | Table keyboard + selection→panel | `↑↓ ↵ esc` work; panel follows |
| T4 | Disabled actions with reasons | No post-click apology remains |
| T5 | Tombstone row + tab | Deleted object is visible, dismissible |
| T6 | Column budget re-measured at 1280/1180 | No clipped column |

## H. Acceptance criteria

1. `grep -rn "onClick" src/pages/Files.tsx | grep span` → 0.
2. Clicking Upload/New folder changes nothing; both are `disabled` with a title.
3. Five columns at 1440, four at 1280; the name column never truncates below ~20 characters at 1280.
4. Keyboard-only: select, open, close, expand a folder, clear selection.
5. `.notice` blocks in page CSS ≤ 3 repo-wide.

## I. Validation

`npm run check && lint && test`; e2e adds disclosure + disabled-action checks; screenshots 1280/1440 with panel open; axe spot-check on the table.

## J. Risks and open questions

- The container-query threshold was tuned at 1280; re-measure rather than adjust by eye.
- `usedBy` counts are mock; they must not imply real referential integrity until storage exists.
