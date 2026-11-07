# SP-06 · Whiteboard

**Status:** In Progress (2 of 4 units done) · **Depends:** SP-04 · **Blocks:** SP-09
**Absorbs:** plan/08, and every measured finding in `HeptaBase RE/Plan/06-画布交互改造.md` §0.

**Units:** [SP-06a](SP-06a-scene-model.md) — scene model, geometry, persistence (0.75d) · [SP-06b](SP-06b-viewport.md) — viewport, zoom, pointer machine (1.25d) · [SP-06c](SP-06c-cards.md) — create, drag, snap, undo (1.5d) · [SP-06d](SP-06d-edges.md) — edges, anchors, labels (1.5d).

## A. Objective

A board you can think on: cards you can drag, a canvas that zooms under the pointer, edges you can draw, and undo that works. Read-only rendering already exists; this subplan builds the interaction layer — and deliberately does not inherit the three engine bugs documented in the reference repository.

## B. Scope

**In:** pointer-anchored zoom 10–400%; pan (space-drag, wheel, trackpad); drag with snapping (6px) and guides; create card by double-click on blank; sections (titled, movable); edges with hover anchors and labels above cards; multi-select (marquee, shift); undo/redo (last 50 ops); keyboard map (`V/N/S/L`, arrows nudge 1px/10px, `⌘0` fit, `+/-`, `⌘Z`, `Delete`, `Esc`); persistence of one board per workspace; live card bindings stay read-only.
**Out:** freehand drawing; nesting; collaboration; images beyond file chips; export; multi-board sync.

## C. Dependencies

SP-04 (file chips), `spatial-language.md` §7, HeptaBase findings (below).

## D. UX specification

- Wheel pans; `⌘`+wheel zooms **anchored at the pointer**; `space`+drag pans; zoom dock and `⌘0` fit.
- Dragging: 1:1 tracking, no lag; on release within 6px of a neighbour's axis, one snap (no magnetic pull).
- Double-click blank creates a card and puts the caret in its title.
- Hovering a card reveals four edge anchors (12px dot, 24px hit area, constant on screen at any zoom); dragging from one to another card creates an edge; releasing on blank cancels.
- Edge labels sit on a layer above cards and are clickable.
- Empty board shows a guide card (drag a file here / double-click to create) that disappears after first use.
- Deleting a card removes its edges; undo restores both.

## E. Visual specification

Paper ground with 16px dot grid; sections = weak tint + 1px top rule, title 11/16 mono; cards = surface + 1px line + `--e1`, radius 2; live card = 2px accent left edge; selection = 1px accent ring; guides = 1px `--accent` at 40%; HUD 11/16. Nothing floats except tools, minimap, zoom dock, status bar.

## F. Technical plan

**The three avoidable bugs, taken from the reference measurements:**

1. **Wheel zoom collapse** — their handler read `viewport.zoom` from the render closure, so 10 events in one frame all used the same value (30 gestures → 1.16× instead of 1.6×). Fix: viewport lives in a `useRef`; the wheel handler reads `ref.current` and writes synchronously.
2. **Pointermove rebinding** — their drag effect depended on the interaction state, so every move re-bound listeners and re-rendered every card (150 cards: P95 43ms). Fix: one `pointerdown` handler on the scene; move/up listeners attached to `window` once, reading a mutable session ref; React state updated at most once per frame (`requestAnimationFrame`).
3. **Zoom-scaled hit areas** — their 10px dots shrank to 5.9px at 42%. Fix: `hitSize = 24 / scale` in scene units; visual dot stays 12/scale so it is constant on screen.

**Modules**
- `src/pages/boards/scene.ts` — constants, fit maths, snapping, geometry (pure, tested).
- `src/pages/boards/useCanvasGestures.ts` — the pointer state machine (idle/panning/marquee/dragging/connecting), refs only.
- `src/pages/boards/useHistory.ts` — command stack (`add/remove/move/resize/connect`), 50 entries.
- `src/pages/boards/store.ts` — board JSON in `localStorage` `thylas:board:v1:<id>`, debounced write, schema-versioned.
- `BoardPage.tsx` — composition; no geometry logic.

**Performance budget:** 150 cards, drag and zoom at P95 ≤ 20ms per frame (measured with `PerformanceObserver` long tasks or the DevTools trace), documented in the subplan result.

## G. Implementation tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Scene model + pure geometry + tests | snapping/fit return expected values |
| T2 | Viewport ref + wheel/space/zoom | 30 wheel gestures zoom 30 times |
| T3 | Pointer machine with window listeners | 150-card drag P95 ≤ 20ms |
| T4 | Card create/move/resize + snap guides | Drop lands aligned, one step |
| T5 | Anchors + edges + label layer | Draw an edge; label clickable at 25% zoom |
| T6 | Marquee, multi-move, delete | 12 selected, one undo restores |
| T7 | Keyboard map + fit | `⌘0`, arrows, `Delete`, `Esc` |
| T8 | Persistence + schema version | Reload restores board and viewport |

## H. Acceptance criteria

1. 30 consecutive `⌘`+wheel events produce ~30 discrete zoom steps, not one.
2. 150 cards: drag and pan hold P95 ≤ 20ms (trace attached).
3. Zoom 10% and 400%: anchors remain clickable (constant 24px screen hit area), card borders do not alias into gaps.
4. Dragging a card to a neighbour's axis and releasing needs no second adjustment in ≥ 90% of tries.
5. Draw an edge between two cards; delete either card; `⌘Z` restores card and edge.
6. Reload keeps cards, sections, edges, and viewport.
7. No live card can be edited; its provenance is visible.

## I. Validation

Unit tests for geometry/history; e2e: create-drag-connect-undo-reload; performance trace at 150 cards; screenshots at 10/100/400% zoom and empty board; keyboard-only create/move/delete.

## J. Risks and open questions

- **Frame budget** is the project's largest single risk; if 150 cards fail, options are: `<canvas>` renderer (same model), or a documented 100-card ceiling with a warning at 80.
- Undo of selection is not worth modelling (HeptaBase's own note: undo left stale selections) — selection clears on undo, documented.
- Storage: one board per workspace in `localStorage` is an MVP constraint (Q-4); a 2 MB board would hit the quota.

## Progress

- **SP-06a complete (2026-11-07, `3ce2f5b`)** — pure `scene.ts`, versioned `store.ts`, 23 unit tests, no visual change (screenshot md5 identical). The store is not yet wired into rendering.
- **SP-06b complete (2026-11-07, `22342da`)** — viewport ref + rAF commit, pointer-anchored zoom, pan, clamps and keyboard. 30 wheel gestures produce 30 steps; 150-card pan P95 16.7ms. The two engine bugs in §F are fixed before any card dragging exists.
- **SP-06c / 06d remain.** Card create/drag/snap/undo and the 150-card **drag** trace are 06c; edges, anchors and labels are 06d. Persisted viewport waits for Q-4.
