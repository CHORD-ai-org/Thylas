# Artifact page — implementation notes

**Date:** 2026-11-12 · Product foundation: `docs/product/artifacts/` (D-053) · Plan: [`PLAN.md`](PLAN.md)

## What shipped

| Stage | Delivered |
| --- | --- |
| Library | `/artifacts` — hybrid layout (orientation line, view chips All/Recent/Created-by-me/External, kind+status filters, list-first rows), search, three honest empty states |
| Detail | `/artifacts/:id` — shared header (back, name, kind, status, author/source, updated; Coworker + Edit), **kind-adaptive sections** (each kind renders its own template), side column: Relations · Versions · Ownership; inline section editor (save = new version); Deprecate/Restore, Delete with inline confirm |
| Creation | `/artifacts/new` — five paths (idea / methodology / tool-or-asset / with-coworker / external); name + first thought is enough; the Coworker path is an honest prototype notice; the external path creates a reference whose source stays its system of record |
| Integration | Rail item (library group) + palette "Go"; detail's **Coworker** action opens the real chat dock with the artifact declared as context — the one live integration |

## Files

```
src/data/artifacts.ts            seeds (7 kinds, 1 external) + section templates
src/state/artifacts.ts           v1 store: create / edit→append version / status / tombstones
src/pages/artifacts/             Library · Detail · New + artifacts.module.css
scripts/shots-user-connect.mjs   screenshots (reused harness)
```

## Honesty rules applied

- External artifacts: a reference + link; **no sync states** (none exist); the source
  stays its system of record — stated on the detail page.
- Coworker creation path: a notice that the agent runtime is not connected — no fake chat.
- Prototype data: the library subtitle says edits persist in this browser only.
- Methodology detail shows the method only — no fake runs.

## Verification

tsc clean · vitest 300/300 · build ok · e2e **292/292** (12 new assertions: library,
search, external view, detail sections/versions/relations, edit→version, coworker→dock,
idea path, coworker notice, external reference, library reflection). Screenshots:
`.workbuddy/shots/artifacts-*.png`.
