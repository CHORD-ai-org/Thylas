# SP-08 · Account and settings

**Status:** Not Started · **Depends:** SP-01 · **Blocks:** SP-09

## A. Objective

A small, honest account surface: who you are, what you are on, what you have used, and the one preference the app actually honour. No billing flows, no organisation administration, no key management dressed up as working.

## B. Scope

**In:** Profile (name, email, role); Plan (read-only summary, link-out text, no purchase flow); Usage (meters as returned, "resets on" date, last run cost); Preferences (row density, theme = light only, language = English only); density persisted in `thylas:ui:v1` and applied on boot.
**Out:** API keys (row unresolved in the product matrix — absent, not disabled), organisation block (member sees none), invoices, seat management, self-serve upgrade, dark mode, language packs.

## C. Dependencies

SP-01 (type/state), `state/app.tsx` (`ui` object), `product/definition.md` §8 (rows 17–19).

## D. UX specification

- Sections are a sticky 176px nav; content max 560.
- Meters show used/total and the reset date; a caption states they are displayed, never enforced.
- Density toggle applies immediately and survives reload; the other two preferences are statements of fact with no toggle (a disabled toggle would be a fake control).
- Absent things are absent: no greyed-out API key table, no "upgrade" button.

## E. Visual specification

Page title 24/32; section titles 20/28; field rows via `grammar.fieldRow`; meters 4px rules; **zero accent elements** on this surface (it is not a state). Hairlines only.

## F. Technical plan

- `src/pages/Account.tsx` — drop key/org sections; wire density to `ui`.
- `src/pages/account.module.css` — type steps, remove ad-hoc paddings.
- `src/state/app.tsx` — `density: 'comfortable' | 'compact'` in the persisted UI object; apply `--h-row` on mount via a small effect in `AppShell`.

## G. Implementation tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Type/geometry pass | All sizes from tokens |
| T2 | Density → persisted, applied at boot | Reload keeps 26px rows |
| T3 | Remove keys + organisation blocks | No fake affordance |
| T4 | Usage copy | States display-only, reset date shown |

## H. Acceptance criteria

1. `grep -n "accent" account.module.css` → 0.
2. Density survives reload and affects tables globally.
3. No control on the surface fails when clicked.
4. Nav reaches all four sections by keyboard; `aria-current` set.

## I. Validation

`npm run check && lint`; screenshots of four sections at 1440; reload after density change.

## J. Risks and open questions

- Density currently also needs to reach non-table surfaces; scope it to `--h-row` consumers only (tables, lists), not display headings.
- If plan/usage data later comes from a service, the copy already says "as returned" — no rewrite needed.
