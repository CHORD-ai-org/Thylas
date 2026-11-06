# 05 · Notes

**Sprint:** S2 · **Estimate:** 1.0 day · **Gate:** G2 · **Depends:** 02
**Contract:** `typography.md` §3 (read step), `spatial-language.md` §4 (236 / 660 / 300) · **Audit:** A4

## Objective

A reading surface that is measured, not decorated: 16/26 on a 660px column, a title from the display step, and a list that scans in one line per note.

## Done when

- Reader width 660–680px; body 16/26; measure 66–72 characters.
- Note title is the single display element on the screen (`--t-display`), not a 30/36 one-off.
- List rows 44px, two lines (title 13/20 500, meta 11/16), selected row uses surface + inset line, filter chips match the shared recipe.
- The reader is a page: no border, no radius, no shadow. Panel is 300 wide, not 340.
- No serif remains anywhere in `notes.module.css`.

## Steps

1. **Column** — `notes.module.css`: `.reader` padding 40/44, no border/radius (already removed), `max-width: var(--w-read)`; `.readerWrap` centres.
2. **Type** — `.title` → `var(--t-display)`; `.p` `var(--t-read)`; `.h2` → `var(--t-section)` (20/28) — currently a 18/26 serif; `.quote` uses `--t-read` with a 2px accent left rule; `.meta` `--t-caption`; `.list2 li` `--t-read`.
3. **List** — `.noteRow` 44px, title `--t-ui-strong`, meta `--t-caption`; `.noteRowOn` surface + inset; width 236 stays.
4. **Filters** — replace the local `.filter` block with the shared recipe from 06 (if 06 lands first, import; otherwise name it identically so extraction is mechanical).
5. **Panel width** — pass `300` from `Notes.tsx` → `ContextPanel` (add a `width` prop in 02 if not already; the shell default stays 340).
6. **End mark** — the `◦` at the end of the article is decoration; delete it. (Brand rule P8: every element carries information.)

## Files

| Action | Path |
| --- | --- |
| edit | `src/pages/notes.module.css` |
| edit | `src/pages/Notes.tsx` (panel width, filter class names) |

## Verify

```bash
npm run check
grep -n "serif" src/pages/notes.module.css        # 0
grep -n "font-size" src/pages/notes.module.css    # 0
```

In the browser at 1440: measure `.reader` (expect 660–680) and count characters per line at 16px (expect 66–72). Screenshot the reader and the list.

## Risks

- The 660 target assumes list 236 + panel 300. If 02 changes the panel default or the rail width, re-measure rather than adjust the reader's `max-width`.
- Chinese in the reader will look smaller at 16px (M6); do not compensate with a separate size until the specimen says so.

## Handoff

06 will lift `.filter`, `.notice` and `.label` from this file and 04. Keep the class names unchanged.
