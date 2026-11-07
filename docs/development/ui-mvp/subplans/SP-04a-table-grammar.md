# SP-04a · Table grammar and column budgets

**Parent:** [SP-04](SP-04-files-and-resources.md) · **Days:** 0.75 · **Status:** Completed 2026-11-07 · **Depends:** SP-03b

## Objective

One table grammar for Files, borrowed from `grammar.module.css`, with column budgets measured at three widths rather than guessed — so the same recipe can be used by Processes later without a second stylesheet.

## Scope

**In:** adopt `grammar.label` / `.tableHead` / `.banner` in `files.module.css`; local grid template only; tabular numerals on size/updated/used-by; file name 13/20 500; produced badge mono; panel title uses the meta slot; container-query threshold re-measured at 1440/1280/1180.
**Out:** row interactions (SP-04b), preview, upload.

## UX

Parent §D. This unit changes appearance and measurement only; behaviour must be identical before and after.

## Visual

Parent §E; values come from the parent, not from new decisions. Header 44px, rows 32px, five columns at 1440 (name · size · updated · source · used by), four at 1280 (source drops), name never below ~20 readable characters.

## Technical plan

- `files.module.css`: delete local `.thead`/`.notice` type rules, keep `grid-template-columns` and `@container` block.
- `Files.tsx`: `className={g.tableHead}` plus local grid class; banner replaced by `Notice` when SP-04b lands.
- Measure with DevTools at the three widths with the panel open and closed; record the numbers in the PR body.

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Header/banner/label from grammar | One recipe, no duplicated type |
| T2 | Tabular numerals | Size and credits align on the digit |
| T3 | Column budget at 3 widths | No clipping, no horizontal scroll |
| T4 | Panel title + count | Uses `ContextPanel` `meta` slot |

## Acceptance

1. `grep -c "\.notice {" src/pages/files.module.css` → 0.
2. 1440: five columns; 1280: four; 1180: four, name ≥ 20 chars visible.
3. `scrollWidth <= clientWidth` for the table wrapper at all three widths with the panel open.
4. Numbers align: two rows with 3- and 4-digit sizes share a decimal edge.

## Validation

Screenshots at 1440/1280/1180 with panel open and closed; `npm run check && lint`; visual diff against SP-01 baseline.

## Risks

- The container query was tuned at 1280; changing the grammar's padding shifts the threshold — re-measure, do not adjust by eye.
- Grammar adoption must not change row height; if it does, fix the grammar rather than overriding locally.

## Result (2026-11-07, done)

`files.module.css` now composes `grammar.tableHead` and `grammar.label`; its page-local `.notice` and its two hardcoded font-size overrides are gone. `Notes` adopts `grammar.banner` as well, leaving exactly three page-local notice recipes (account, boards, processes) owned by SP-06/07/08. File names are 13/20 500, numeric cells tabular, and breadcrumb hover is an underline rather than terracotta text.

**Measured column budgets** (Chrome, panel open / panel closed; `scrollWidth === clientWidth` everywhere, header 44px, rows 32px):

| Viewport | Table open | Cols | Name col | Table closed | Cols |
| --- | --- | --- | --- | --- | --- |
| 1440 | 652px | 5 | 332px | 992px | 5 |
| 1280 | 492px | 4 | 272px | 832px | 5 |
| 1180 | 392px | 4 | 212px | 732px | 5 |

**Deviations, with reasons**

1. **A second container step at 430px was needed.** The first pass gave the name column 190px at 1180, but 12px mono made `1.2 GB` wrap to two lines and the produced badge pushed the longest names into an ellipsis at ~16 characters. The 430px step moves numeric cells to the 11px mono token, trims their padding, and keeps headers on one line. Re-measured: no truncation, no wrapping, name column 212px.
2. **`grammar.banner` was adopted by Notes too, not just Files.** Parent §H requires ≤3 page-local `.notice` blocks repo-wide; removing only Files' copy left four. Notes was mechanically identical, so it became the second consumer.

**Evidence:** `npm run check` / `lint` / `test` / `build` clean; 6 new browser assertions (61 total) cover the static rule, 44/32 row heights, tabular numerals and all three widths; screenshots `sp04-1440`, `sp04-1280`, `sp04-1180-v3`.

**Left:** Processes still has its own table head recipe; SP-07 decides whether to adopt the same one.
