# 07 · Processes and runs

**Sprint:** S3 · **Estimate:** 1.5 days · **Gate:** G3 · **Depends:** 06
**Contract:** `interaction-contract.md` §5, §6 · `spatial-language.md` §4 · **Audit:** A6, I4

## Objective

Make delegated work legible as an instrument reading: five state words, mono numbers, one control per capability, and a run detail whose bands read as a document rather than a stack of cards.

## Done when

- Table: 38px rows; columns `process / type / state / activity / credits / out`; numbers tabular; state is a word plus a 6px dot, never a coloured row.
- Filters use the shared recipe; counts are computed; `needs you` is the only `--warn-ink` text on the surface.
- Run detail: intent 16/26 at 68ch, plan rows `28 / 1fr / auto`, activity `44 / 14 / 1fr / auto`, output rows with a real `Open` or an explicit `not stored`.
- Controls are rendered **only** for capabilities the run exposes; none of them opens an apology. With no WAM, the control area shows the reason as a disabled state or a single caption.
- No `.notice` block remains local to this surface (uses 06's `Notice`).

## Steps

1. **Table** — `processes.module.css`: `.thead` import `g.tableHead` + local grid; `.trow` 38px; `.colCredits/.colOut/.colActivity` `tabular-nums`; `.runName` 13/20 500; remove `.runMeta` (`#baseline` suffix was already removed).
2. **State** — `.colState` uses `--t-ui` + dot from `StatusDot`; map `needs_input` text to `--warn-ink`; `running` keeps the accent dot and the two-cycle pulse only.
3. **Filters** — replace local `.filter*` with `g.filters / g.filter / g.filterOn`; keep the count span.
4. **Run bands** — `processes.module.css`: `.bandHead h2` → 11/16 label with tick; `.runTitle` → `--t-page`; `.intent` `--t-read`; `.planN/.eventT` mono; `.outRow` grid stays but the `not stored` state must be visually distinct (dashed underline, `title`).
5. **Controls** — `Processes.tsx`: keep `capabilities.map(...)`; replace `setNotice` with a single `<p class={g.banner}>` shown **once** under the control row when `capabilities.length === 0 || !liveWam`; buttons themselves get `disabled` + `title` per the contract. Delete the per-click notice state.
6. **Empty states** — filter returns nothing → name the filter, not "no data"; run with no events → "Nothing has happened yet. The run is queued."; no artifacts → "Output appears here as it lands in the workspace."

## Files

| Action | Path |
| --- | --- |
| edit | `src/pages/processes.module.css` |
| edit | `src/pages/Processes.tsx` |
| read-only | `src/data/selectors.ts` (`STATE_LABEL` stays the single source of the five words) |

## Verify

```bash
npm run check && npm run build
grep -c "tabular-nums" src/pages/processes.module.css     # >= 1
grep -n "Nothing was sent" src/pages/Processes.tsx        # 0
grep -n "capabilities.map" src/pages/Processes.tsx        # 1 (unchanged rule)
```

Screenshots: table (all states visible if possible), run detail top and bottom, controls for a run with `['stop','pause']` vs one with `['rerun']` only.

## Risks

- **Capability demo needs data:** temporarily editing `mock.ts` to remove `pause` proves the rule; revert before commit and note it in the message.
- The bands are the densest area in the app; resist adding a card wrapper to group them — spacing and rules do the grouping.

## Handoff

09's state matrix sweeps this surface; keep class names stable so the sweep is a CSS-only pass.
