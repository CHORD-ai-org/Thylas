# 10 · Account and Recently

**Sprint:** S4 · **Estimate:** 1.0 day · **Gate:** G4 · **Depends:** 06
**Contract:** `branding-desk.md` §10 (accent budget 0 for Account) · `spatial-language.md` §4 · **Audit:** A4, A7

## Objective

Bring the last two surfaces into the same grammar, and prove the system survives a screen with **no** accent at all.

## Done when

- Account: nav 176px, section titles `--t-section`, field rows use the shared recipe, meters are 4px rules with tabular values, organization block absent for a member.
- Account has **zero** accent-coloured elements (not even focus restyle: focus ring is allowed, it is a state).
- Recently: 40px rows, one line per object, type in `--t-caption`, time right-aligned, filters shared, cap 50 stated in the footer.
- No page-local `font-size` remains in either file; no serif.

## Steps

1. **Account type** — `account.module.css`: `.title` → `--t-page`; `.sectionTitle` → `--t-section`; `.sectionSub` 13/20 `--ink-2`; `.planCard` becomes a rule-bounded block (keep the 1px line, drop the shadow if any); `.meterTrack` 4px `--line`, fill `--ink-3`.
2. **Fields** — replace local `.fields` rows with `Field` (already used) or `g.fieldRow`; label column 88px.
3. **Nav** — `.navOn` uses surface + inset line, 500 weight; no accent.
4. **Density pref** — keep the segmented control; it works and is the only real preference; persist it to `localStorage` under `thylas:ui:v1` (`density`) and apply `--h-row` on mount (currently session-only).
5. **Recently** — `recently.module.css`: `.row` 40px; `.label` 13/20 500; `.meta`/`.when` `--t-caption` / `--t-mono-s`; `.filter*` → shared; `.head` max 560.
6. **Copy** — Account sub-line about organization stays (it explains a visible absence); Recently footer keeps "Capped at 50 rows".

## Files

| Action | Path |
| --- | --- |
| edit | `src/pages/account.module.css`, `src/pages/Account.tsx` |
| edit | `src/pages/recently.module.css`, `src/pages/Recently.tsx` |
| edit | `src/state/app.tsx` (density read/write) |

## Verify

```bash
npm run check && npm run build
grep -n "accent" src/pages/account.module.css        # 0
grep -n "font-size" src/pages/account.module.css src/pages/recently.module.css   # 0
grep -n "serif" src/pages/account.module.css src/pages/recently.module.css       # 0
```

Screenshots: `/account/profile`, `/account/usage`, `/account/preferences`; `/recently` with a filter applied and with an empty result. Toggle density, reload, confirm the rows stay compact.

## Risks

- Account is the easiest place to reintroduce cards (plan card, meter card). Keep the section rule as the only container.
- Persisting density touches the same `ui` object as rail/panel width — read-modify-write, do not replace the object wholesale.

## Handoff

12's identity test uses these two screens as the "quiet" end of the range; 03 is the "editorial" end.
