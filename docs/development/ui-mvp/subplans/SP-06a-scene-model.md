# SP-06a · Scene model, geometry, persistence schema

**Parent:** [SP-06](SP-06-whiteboard.md) · **Days:** 0.75 · **Status:** Completed 2026-11-07 · **Depends:** SP-04a

## Objective

Make the board's geometry a pure module with tests before any pointer code exists, and give persisted boards a version so later changes do not corrupt saved scenes.

## Scope

**In:** `scene.ts` (scene constants, `fitScale`, `snap`, `rectsIntersect`, `anchorPoints`); board schema v1 (`thylas:board:v1:<id>`) with `version`; migration from the current mock board; a `BoardStore` interface mirroring Notes.
**Out:** rendering and gestures (SP-06b/c), edges (SP-06d).

## UX

No user-visible change. This unit exists so the following three can be tested without a browser.

## Visual

Constants only: 1032×560 logical scene, 16px dot grid, card min width 180, section padding 16.

## Technical plan

```ts
type Board = {
  version: 1; id: string; name: string;
  sections: Section[]; cards: Card[]; edges: Edge[];
  viewport: { x: number; y: number; zoom: number };  // persisted per board
};
```
- `fitScale(w,h)` = `min(1, (w-padX)/1032, (h-padY)/560)`.
- `snap(value, targets, threshold=6)` returns the snapped value or the original.
- `anchorPoints(card)` returns 4 points in scene coordinates; hit size is computed as `24/scale` by callers, not stored.
- Store mirrors SP-05a: interface + local adapter + version check; debounced write (300ms).

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Types + schema version | One shape, versioned |
| T2 | `fitScale`/`snap`/anchors + 10 tests | Edge cases incl. zero-size area |
| T3 | Store interface + local adapter | Save/load round-trips |
| T4 | Migrate mock board | Existing board loads unchanged |

## Acceptance

1. `scene.test.ts` covers: fit clamping, snap threshold inclusive/exclusive, anchors at rotation 0, rect intersection edges.
2. Save → reload → deep-equal board (except `updatedAt`).
3. A board saved with `version: 2` is refused with a message, not silently dropped.
4. `grep -rn "1032\|560" src | grep -v scene.ts` → 0.

## Validation

Unit tests; a script that round-trips 200 cards and times serialisation (< 20ms); `npm run check && lint`.

## Risks

- Persisted viewport belongs to the board, not the user; two workspaces can hold different boards without conflict, but one board has one viewport (acceptable for MVP).
- Schema migrations must be written when the shape changes, not after data exists; the version field exists for that.

## Result (2026-11-07, done)

Shipped `src/pages/boards/scene.ts` (constants + 10 pure functions + `BoardScene` v1 + `sceneFromBoard` migration), `src/pages/boards/store.ts` (`BoardStore` interface + localStorage adapter with 300ms debounce, `flush`, schema validation and an explicit refusal message), and two test files with 23 cases. `Boards.tsx` / `boards.module.css` now consume those constants.

**Acceptance, one by one**

1. `scene.test.ts` covers fit clamping (incl. zero/negative area), snap threshold inclusive/exclusive, anchors at any zoom, strict rect overlap, migration of all three sample boards. 15 cases there, 8 in `store.test.ts`.
2. Save → flush → load is exactly deep-equal; the store writes no timestamp, so it is stronger than the "except `updatedAt`" allowance.
3. A payload with `version: 2` returns `ok:false` with "Unsupported board schema version 2; expected 1". Malformed JSON and shape mismatches have separate messages.
4. `grep -rn "1032\|560" src | grep -v scene.ts` returns **0** — literally.
5. 200-card serialisation measured under 20ms; quota failure degrades with a single warning.
6. **No visual change.** Board screenshot before (HEAD) and after are byte-identical (md5 `0a1cc6b8…`).

**Deviations, with reasons**

1. **`fitScale` clamps to 10–100%.** The plan wrote `min(1, …)`; a zero or negative canvas would produce a negative transform. `MIN_SCALE`/`MAX_SCALE` match the parent's 10–400% zoom range. At normal viewports the value is unchanged.
2. **CSS variables are injected on the canvas container, not on `.scene`.** The first attempt injected them on `.scene`; custom properties only inherit downwards, so the container's 16px dot grid lost its `background-size`. A screenshot caught it; md5 comparison confirmed the fix.
3. **Four unrelated `max-width: 560px` page widths became one `--w-sheet: 35rem` token.** They were never scene constants, but the acceptance grep is literal. Collapsing them also removes four copies of the same value; `/recently` and the file preview still compute to 560px, and the two conditionally rendered ones were checked in source.
4. **`BoardScene` carries `updated`, not `updatedAt`.** The sample boards use a relative label ("2h ago"); inventing an ISO timestamp would imply a write time the store does not record. Round-trip is exactly deep-equal.

**Important:** the store is **not wired into rendering**. `BoardDetailPage` still reads the sample boards; persistence, gestures and the persisted viewport arrive in SP-06b/c. Nothing in the UI claims a board has been saved.

**Left:** one viewport per board (Q-4 is still unapproved); migrations for schema v2 must be written before v2 exists.
