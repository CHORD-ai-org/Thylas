# 03 · Overview

**Sprint:** S2 · **Estimate:** 1.5 days · **Gate:** G2 · **Depends:** 02
**Contract:** `interaction-contract.md` §6 (honest limiter), §8.3 (hover) · **Audit:** A5, I4, I5

## Objective

Turn the entry screen into a place to resume work, with one large type element instead of a 28px greeting doing hierarchy's job, and with its copy derived from data rather than asserted.

## Done when

- Exactly one display element (32/40) on the screen; every other tier is 13/20 or 11/16.
- Hover changes background only; no terracotta text.
- The lede names the real count (`Two processes need a decision` is computed, not written).
- "New workspace" card is gone (M4); Start is disabled until there is text **and** carries the reason when no WAM is connected.
- Every row still navigates; `⌘K` still opens the palette.

## Steps

1. **Type pass** — `src/pages/overview.module.css`: `.greeting` → `var(--t-display)`; `.lede` 13/20 `--ink-2`; `.rowTitle` `--t-ui-strong`; `.rowMeta`, `.wsCardMeta` `--t-caption`; `.sectionLabel` inherits the tick from 06.
2. **Kill hover colour** — delete `overview.module.css:151-152` (`.row:hover .rowTitle { color: var(--accent) })`; hover = `--tint-hover` on the row.
3. **Computed copy** — `Overview.tsx`: `const pending = …filter(state==='needs_input')`; lede becomes `` `${pending.length} processes need a decision. …` `` with singular/plural handled; empty case → `Nothing needs you right now.`
4. **Honest Start** — button `disabled={!intent.trim()}` stays; add a persistent caption under the input when `VITE_WAM_MODE !== 'live'`: *"Not connected: submitting an intent needs WAM. The field is local."* Remove the `sent` state and its notice entirely.
5. **Remove "New workspace"** — delete the `wsNew` block and the `openPalette` import if it becomes unused; keep the two workspace cards, add a one-line footer *"Workspaces come from the workspace service."* in `--t-caption`.
6. **Workspace cards** — 4px radius, 1px line, no shadow; counts use tabular numerals via `font-variant-numeric: tabular-nums`.
7. **Needs-you rows** — the chip is the only coloured element in that column; use `--warn-ink` for the chip text (M1) so it passes AA at 11px.

## Files

| Action | Path |
| --- | --- |
| edit | `src/pages/overview.module.css` |
| edit | `src/pages/Overview.tsx` |

## Verify

```bash
npm run check
grep -n "accent" src/pages/overview.module.css      # only the primary button / live dot
grep -n "New workspace" src/pages/Overview.tsx      # 0
grep -c "font-size" src/pages/overview.module.css   # 0 (tokens only)
```

Screenshot 1440: count display elements (one), accent elements (Start + one live dot). Set the mock to zero `needs_input` runs locally and confirm the lede and the empty copy change — then revert.

## Risks

- Removing affordances can read as a regression. The footer sentence is the replacement; do not add a disabled "New workspace" button (M4).
- The lede currently also mentions "two processes" in two places; search the file, not just the one line.

## Handoff

03 is the first surface with the full type system applied. If 02's chrome contrast is wrong, it shows here first — fix it in 02, not locally.
