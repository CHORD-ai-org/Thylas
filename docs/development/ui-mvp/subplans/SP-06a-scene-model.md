# SP-06a · Scene model, geometry, persistence schema

**Parent:** [SP-06](SP-06-whiteboard.md) · **Days:** 0.75 · **Status:** Not Started · **Depends:** SP-04a

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
