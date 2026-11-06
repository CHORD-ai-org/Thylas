# 06 · Shared grammar

**Sprint:** S2 · **Estimate:** 0.5 day · **Gate:** G2 · **Depends:** 03, 04, 05 (first consumers exist)
**Contract:** `component-guidelines.md` §3 (composition patterns) · **Audit:** A7, A8

## Objective

Stop owning six copies of the same visual grammar. Extract only what three surfaces already duplicate — label, table head, banner, filter chips, field row — into one module, and one `Notice` component.

## Done when

- `src/styles/grammar.module.css` exports five recipes; each is used by ≥ 2 surfaces.
- `.notice` blocks in `src/pages/*.css` go from 6 to ≤ 3 (the three that are structurally different stay local).
- `Notice.tsx` is the only banner markup; it supports `tone: info | warn`, optional dismiss.
- No component CSS declares a raw `font-size` after this sub-plan — all type comes from `font:` tokens or these recipes.

## Steps

1. **Create `src/styles/grammar.module.css`** with exactly these classes (no more):
   - `.label` — 11/16 500 uppercase, `+0.06em`, `--ink-2`, with the 6px index tick as `::before`.
   - `.tableHead` — sticky, 44px, `--t-mono-s`, tracking .1em, bottom hairline, `--bg-app`.
   - `.banner` — 7px 12px padding, left 2px accent rule, `--tint-live` ground, `--t-caption`.
   - `.filters` / `.filter` / `.filterOn` — 24px, 2px radius, selected = surface + inset.
   - `.fieldRow` — 88 / 1fr grid, 5px 0, label `--ink-3`.
2. **`src/components/Notice.tsx`** — imports `grammar.module.css`; renders `.banner`, optional `×` with `aria-label="Dismiss"`, `role="status"` for info and `role="alert"` for error.
3. **Replace consumers**, one surface per commit:
   - `Overview.tsx` notice → `Notice` (info).
   - `Files.tsx` upload/folder notice → `Notice` (warn).
   - `Processes.tsx` start notice → `Notice` (warn).
   - `Boards.tsx`, `Notes.tsx`, `Account.tsx` keep local only if their layout differs (centred vs full width) — max 3 local copies.
4. **Delete** the duplicated `.notice` CSS in the files you converted; do not leave dead classes.
5. **Table head**: `files.module.css` `.thead` and `processes.module.css` `.thead` both `composes` from grammar (or import `g.tableHead` alongside their grid template). Keep their distinct `grid-template-columns` local.

## Files

| Action | Path |
| --- | --- |
| add | `src/styles/grammar.module.css` |
| add | `src/components/Notice.tsx` |
| edit | `src/pages/{Overview,Files,Processes,Boards,Notes,Account}.tsx` |
| edit | `src/pages/{overview,files,processes,boards,notes,account}.module.css` |

## Verify

```bash
npm run check && npm run build
grep -c "^\.notice {" src/pages/*.css        # total <= 3
grep -rn "class.*banner" src/pages | wc -l   # >= 3 consumers
grep -rn "font-size" src/pages --include=*.css | wc -l   # 0 or only the three local exceptions
```

Screenshot one banner state per surface (files, processes) — same padding, same rule, same tone.

## Risks

- **Premature abstraction** is the obvious failure: if a recipe has only one consumer after this pass, delete it from `grammar.module.css` and keep it local.
- CSS Modules `composes` only works between modules in the same build — importing and using `g.banner` in `className` is safer than `composes` across directories; prefer it.

## Handoff

07 and 10 consume `.label`, `.tableHead`, `.fieldRow`; they should not create new recipes.
