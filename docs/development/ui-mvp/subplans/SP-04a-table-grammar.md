# SP-04a · Table grammar and column budgets

**Parent:** [SP-04](SP-04-files-and-resources.md) · **Days:** 0.75 · **Status:** Not Started · **Depends:** SP-03b

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
