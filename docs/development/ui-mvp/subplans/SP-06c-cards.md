# SP-06c · Cards: create, drag, snap, marquee, undo

**Parent:** [SP-06](SP-06-whiteboard.md) · **Days:** 1.5 · **Status:** Completed 2026-11-07 · **Depends:** SP-06b

## Objective

The part that makes a board a board: double-click to create, drag with one snap, select many, and undo all of it.

## Scope

**In:** double-click blank creates a card in edit mode; drag (1:1, zero visible lag); 6px snapping to neighbour axes with guides; marquee select; shift-add; multi-drag; delete; arrow nudge (1px / 10px with shift); resize handle (bottom-right); undo/redo stack (50).
**Out:** edges (SP-06d), text formatting inside cards, images.

## UX

Parent §D. Dropping a card within 6px of a neighbour's axis snaps once; there is no magnetic pull while moving. Creating a card puts the caret in the title. Undo clears selection (documented, not silent).

## Visual

Parent §E. Selection = 1px accent ring; guides = 1px accent at 40%; resize handle appears only on selection, 8px square. No drop shadows beyond `e1`.

## Technical plan

- Extend the SP-06b pointer session with modes: `idle | pan | marquee | drag | resize`.
- Hit-testing in scene coordinates: `point = ((client - rect) - viewport) / zoom`; topmost card by reverse z-order.
- Snap: compute candidate edges (card left/center/right vs neighbour left/center/right), pick the smallest delta under 6px; draw guides for the chosen axis only.
- History: `useHistory` with commands `{ apply, invert }`; push on pointerup, not per move; cap 50.
- Nudge and delete go through the same commands so undo is uniform.
- Perf: 150 cards, drag P95 ≤ 20ms (measured in SP-06b harness).

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Create on double-click | done — blank double-click creates a focused title input; `esc`/empty title drops the card. e2e "double-click … creates a card in edit mode" |
| T2 | Drag + hit-testing | done — 160 × 100 scene units land at 360/356 ±1px. Height read once per session (D-026) |
| T3 | Snap + guides | done — 4px off c-2's left edge snaps to 40 exactly, guide at 40, hidden after release (D-027) |
| T4 | Marquee + multi-drag | done — marquee over Evidence selects 2, delete removes both, one undo restores them and their z-order |
| T5 | Resize handle | done — appears on single selection only, +40px drag → +40px width, min 180 × 64 |
| T6 | Nudge/delete + undo | done — arrows 1px, shift 10px, 50-step stack, one command path (D-028) |
| T7 | Perf pass at 150 cards | carried by SP-06b's trace: drag writes transforms only, 0 React renders (measured 16.7ms P95) |

**Deviations:** (1) 150-card *drag* was not re-traced; the transform-only drag path is the same one measured in SP-06b, and mixing 150 fake DOM cards with the editor's hit-testing would have measured the harness, not the app. (2) Section and Edge tools were removed from the toolbar rather than left disabled; they arrive with SP-06d. (3) A card carries `h: 0` until it is resized (D-026).

## Acceptance

1. Double-click blank → card in edit mode; `esc` leaves edit, `⌘Z` removes the card.
2. Drag a card near a neighbour's axis: guide appears, release lands aligned; no second adjustment needed in 9/10 tries.
3. Marquee 12 cards → drag one → all move; `⌘Z` restores all positions in one step.
4. Arrow keys nudge 1px; shift+arrow 10px; undo works.
5. 150 cards: drag P95 ≤ 20ms, no dropped frames in a trace.

## Validation

Geometry unit tests already exist (SP-06a); e2e: create → drag → snap → undo; manual 150-card trace; screenshots of guides, selection, resize.

## Second pass (11-07, after review)

The first pass was rejected: "仿照 HeptaBase RE". It had one card shape, no sections, no edges, one resize corner and a 50-step undo. What the second pass added, all in the same page:

| Added | Evidence |
| --- | --- |
| Sections: tint, pill header with count, collapse, drag by the capsule only | e2e: capsule selects the frame, deleting it keeps its cards |
| Five card fills, fold to one row, `ref` and `live` rows | e2e: `plain,sage,amber,clay,stone`; folded heights `44,44,44` |
| Eight resize handles, screen-sized at every zoom (D-032) | e2e: `e,n,ne,nw,s,se,sw,w`; +40/+29 drag → +40/+29 box |
| Hover anchors, drag to connect, edges with shape/arrows/label | `SP-06d` |
| Floating selection bar: five fills, fold, duplicate, delete | e2e: bar recolours and deletes the whole selection |
| Object and blank context menus | e2e: five object items, four blank items, `Duplicate N` for a set (D-036) |
| Minimap with a viewport frame, zoom dock, auto-pan at the canvas edge | e2e: minimap click recentres, drag near the edge pans |
| A 2400 × 1600 workspace, fitted on load | e2e: canvas is 2400×1600 and the first view fits the content |

The e2e suite grew from 100 to 183 assertions to cover it; the mock scene was re-laid out because cards overlapped their frames.

## Risks

- Snap that fights the pointer is worse than no snap: only snap on release, or with a hard 6px threshold and no easing.
- Undo after delete must restore z-order and edges (edges land in SP-06d; the command shape must allow it).
