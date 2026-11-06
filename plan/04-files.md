# 04 · Files

**Sprint:** S2 · **Estimate:** 1.5 days · **Gate:** G2 · **Depends:** 02
**Contract:** `interaction-contract.md` §5 (row states), §8.1 (`span` violation) · **Audit:** I1, A3

## Objective

One table grammar for the most-used surface, and a disclosure that is a real control instead of a `span` with a click handler.

## Done when

- Header is 11/16 mono uppercase on a hairline; rows 32px; size/updated/used-by are tabular.
- The folder chevron is a `<button aria-expanded>` **outside** the folder row button, operable with `↵` and `space`.
- Five columns at 1440, four at 1280 (source drops), names never truncated below ~20 characters.
- Row states: hover tint, selected `--accent-weak`, focus ring inset, tombstone for a deleted file.
- Panel title is 11/16 uppercase; the file name inside is `--t-section`, not a 15px serif.

## Steps

1. **Disclosure** — `src/pages/Files.tsx:168`: replace the `<span onClick>` with a sibling `<button class={s.treeToggle} aria-expanded={isOpen} aria-label={…}>` next to the folder `<button>`. Move the expand handler there; the row button only selects the folder. Nested interactive inside a button is invalid HTML today — this is the fix.
2. **Table grammar** — `files.module.css`: `.thead` → `var(--t-mono-s)` + `letter-spacing: var(--track-label)`; `.colSize/.colUpdated/.colUsed` add `font-variant-numeric: tabular-nums`; `.fileName` 13/20 500; row height `var(--h-row)`.
3. **Panel** — `.panelTitleRow` glyph 18px; `.panelName` → `var(--t-section)` 20/28; fields use the shared `Field` (already); `Used by` count becomes 11/16.
4. **Widths** — re-measure the grid at 1280 with the panel open (container query threshold lives in `files.module.css` bottom block). Do not change the threshold without measuring; the current `minmax(140px,1fr) 58 74 100 56` was tuned at 1280.
5. **States** — `.trow` add `:active` and `:focus-visible` (inset ring); `.trowTombstone` style for a deleted file (opacity .55 + strikethrough-free dashed left edge).
6. **Empty** — `EmptyState` copy stays; ensure it names the three arrival paths (upload, import, process output) and carries no primary button while upload is unavailable.

## Files

| Action | Path |
| --- | --- |
| edit | `src/pages/Files.tsx` |
| edit | `src/pages/files.module.css` |

## Verify

```bash
npm run check && npm run build
grep -n "onClick" src/pages/Files.tsx | grep -n "span"      # 0
grep -c "aria-expanded" src/pages/Files.tsx                 # >= 2 (folder toggle + tree rows)
grep -n "tabular-nums" src/pages/files.module.css           # >= 1
```

Screenshots 1440 / 1280 with panel open. Keyboard: `↓` four times, `↵` opens the file tab, `esc` clears selection, folder toggle works with `space`.

## Risks

- **Column budget** is the historical break point; measure with DevTools at 1280 *and* 1180 before choosing values.
- Splitting the disclosure may change the tree's click target for the whole row — keep the row click = select folder, toggle click = expand only.

## Handoff

06 extracts the header and banner recipes from this file; leave them named `.thead` / `.notice` so the extraction is mechanical.
