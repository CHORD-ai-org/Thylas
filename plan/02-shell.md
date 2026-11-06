# 02 · Shell

**Sprint:** S1 · **Estimate:** 2.5 days · **Gate:** G1 · **Depends:** 01
**Contract:** `interaction-contract.md` §2–3 · `spatial-language.md` §1–4 · **Audit:** A5, A6, I2, I3, I6, I10

## Objective

Make the four zones readable as four zones — chrome distinguished from content by weight and tone, not by colour — and give tabs back their type so four kinds of object stop looking identical.

## Done when

- Rail: labels 13/20, active row 500 weight + raised surface + 1px inset line; room rows 12/16; section label 11/16 mono with the 6px index tick (M5).
- Object tabs carry a 12px type glyph; a strip with 9 object tabs shows a `+N` menu instead of scrolling.
- Hover is background tint only. No accent-coloured text anywhere in the shell.
- Every interactive class in `shell.module.css` and `IconButton` defines hover / active / focus-visible / disabled.
- Keyboard: Tab enters the rail once; `↑↓` move between siblings, `→` expands a workspace, `←` collapses, `↵` opens.

## Steps

1. **Rail type and contrast** — `src/shell/shell.module.css`:
   - `.railItem` → `font: var(--t-ui-strong)` when active, `--t-ui` otherwise; drop `--ink-2` to `--ink-2` new value (M1) once 01 lands.
   - `.railActive` → raised surface + `box-shadow: inset 0 0 0 1px var(--line)`; no accent.
   - `.rooms` → `font: 400 12px/16px var(--ui)`; indent stays 22px.
   - `.railLabelLine` → add `::before { content:''; width:6px; height:1px; background:var(--line-strong); margin-right:6px }` — the index tick, reused later in 06.

2. **Strip and tabs** — same file + `src/shell/TabStrip.tsx`:
   - `.tab` 32px, `--t-ui`; `.tabActive` 500 + surface + `::after` 2px accent inset (keep `bottom:-8px` only if it does not clip — measure, do not assume).
   - `TabStrip.tsx:96` → render `<TypeGlyph>`/`<NoteGlyph>` by `tab.type` before the label, `--ink-3`, 12px.
   - Overflow: `const visible = objectTabs.length > 8 ? objectTabs.slice(0, 7) : objectTabs`; render a `+N` button whose menu lists the rest (plain buttons, `esc` closes, click navigates). No portal, no library.

3. **Panel header** — `.panelHead` 44px; `.panelTitle` → `var(--t-caption)` uppercase with a count slot; remove the serif 15px name style from `files.module.css` later (04).

4. **States** — for `.railItem`, `.wsRow`, `.tab`, `.tabClose`, `.collapseRow`, `.stripTools button`:
   - hover = `--tint-hover` only; active = `--accent-weak`; focus-visible = 1px accent ring inset; disabled = 40% ink, `cursor: not-allowed`.
   - `src/components/ui.module.css` `.iconButton`: add `:active` and `:focus-visible` (this is the only file outside `shell/` touched here).

5. **Rail keyboard** — `src/shell/Rail.tsx`: `rovingIndex` state over a flat list of rail buttons; `onKeyDown` on the `<nav>` handles `↑↓→←↵`; refs array, `tabIndex={i===roving?0:-1}`.

## Files

| Action | Path |
| --- | --- |
| edit | `src/shell/shell.module.css` |
| edit | `src/shell/TabStrip.tsx` |
| edit | `src/shell/Rail.tsx` |
| edit | `src/shell/ContextPanel.tsx` (header only) |
| edit | `src/components/ui.module.css` (`.iconButton` states only) |

## Verify

```bash
npm run check && npm run build
grep -n "color: var(--accent)" src/shell/*.css        # 0 (accent only as border/underline)
grep -c ":focus-visible" src/shell/shell.module.css   # >= 6
grep -n "slice(0, 7)" src/shell/TabStrip.tsx          # overflow exists
```

Screenshots: rail expanded / collapsed; tab default / hover / active / focus / live; strip with 9 tabs open showing `+N`; panel open and closed. Keyboard-only: Tab once from the surface into the rail, `→` expand, `↵` open Files.

## Risks

- **Tab overflow + persistence:** a hidden overflow tab that is also the active route must still be reachable — put the active tab first in the visible slice.
- **Roving tabindex** is easy to half-finish: if `tabIndex` is set but focus is not moved, Tab appears broken. Test with the keyboard only, not the mouse.

## Handoff

03–05 inherit the chrome/tone contrast established here. Do not re-tune rail metrics in a page stylesheet.
