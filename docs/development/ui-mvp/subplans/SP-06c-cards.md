# SP-06c · Cards: create, drag, snap, marquee, undo

**Parent:** [SP-06](SP-06-whiteboard.md) · **Days:** 1.5 · **Status:** Not Started · **Depends:** SP-06b

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
| T1 | Create on double-click | Card + caret, one undo removes it |
| T2 | Drag + hit-testing | 1:1 tracking, correct card |
| T3 | Snap + guides | One-step alignment |
| T4 | Marquee + multi-drag | 12 cards move together |
| T5 | Resize handle | Min size enforced |
| T6 | Nudge/delete + undo | Uniform via commands |
| T7 | Perf pass at 150 cards | P95 ≤ 20ms |

## Acceptance

1. Double-click blank → card in edit mode; `esc` leaves edit, `⌘Z` removes the card.
2. Drag a card near a neighbour's axis: guide appears, release lands aligned; no second adjustment needed in 9/10 tries.
3. Marquee 12 cards → drag one → all move; `⌘Z` restores all positions in one step.
4. Arrow keys nudge 1px; shift+arrow 10px; undo works.
5. 150 cards: drag P95 ≤ 20ms, no dropped frames in a trace.

## Validation

Geometry unit tests already exist (SP-06a); e2e: create → drag → snap → undo; manual 150-card trace; screenshots of guides, selection, resize.

## Risks

- Snap that fights the pointer is worse than no snap: only snap on release, or with a hard 6px threshold and no easing.
- Undo after delete must restore z-order and edges (edges land in SP-06d; the command shape must allow it).
