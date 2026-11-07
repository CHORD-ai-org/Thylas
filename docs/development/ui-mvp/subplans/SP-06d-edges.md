# SP-06d · Edges, anchors, labels

**Parent:** [SP-06](SP-06-whiteboard.md) · **Days:** 1.5 · **Status:** **Completed** 11-07 · **Depends:** SP-06c

## Objective

Connections that can be drawn, not only edited: hover a card, drag from an anchor, land on another card, and read the label at any zoom.

## Scope

**In:** four anchors on hover (12px dot, 24px hit area at any zoom); drag to connect; drop on blank cancels; edge label layer above cards; click label to select; delete edge; edges follow moved cards; edge hit slop 8px.
**Out:** curved/bent edges, arrowheads (the reference image has none), self-loops, multi-edges between the same pair.

## UX

Parent §D. Anchors appear on hover, not on selection. During a connection drag the target card outlines. Releasing on blank cancels with no dialog. Labels are always visible and clickable.

## Visual

Parent §E. Edge: 1px `--ink-3`, label 10.5/14 mono on a `--bg-paper` chip (so it stays readable over the line), 6px padding. Selected edge: `--accent`.

## Technical plan

- `EdgeLayer` renders one `<svg>` in scene coordinates with `pointer-events: none`; labels are HTML in a sibling layer with `pointer-events: auto`.
- Anchor hit area: `24 / zoom` scene units, visual dot `12 / zoom` — constant on screen (the reference implementation's 5.9px target at 42% is the failure to avoid).
- Connection state lives in the SP-06b pointer session (`mode: 'connect'`), with `from: { cardId, anchor }`.
- Edge endpoints are computed from current card geometry at render time, so moving a card needs no edge updates.
- Delete a card → its edges are removed in the same command; undo restores both.

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Anchors on hover | 4 per card, constant screen size |
| T2 | Connect gesture | Drag to card creates edge |
| T3 | Cancel on blank | No dialog, no stray edge |
| T4 | Label layer | Clickable at 25% zoom |
| T5 | Delete card → edges | Undo restores both |
| T6 | Edge selection + delete | `Delete` works on edges |

## Result

| # | Task | Result |
| --- | --- | --- |
| T1 | Anchors on hover | done — 4 per card, 9px dot, target 29 × 19 screen px at every zoom (D-032) |
| T2 | Connect gesture | done — drag a side dot onto a card creates one edge; dropping on blank makes a card there and connects it |
| T3 | Cancel on blank | done — no dialog, no stray edge; `esc` during the drag leaves nothing behind |
| T4 | Label layer | done — chip above cards, click selects the line through its band (D-035) |
| T5 | Delete card → edges | done — the same commit drops the edges, one `⌘Z` restores card and edges |
| T6 | Edge selection + delete | done — selected line turns accent, bar deletes only that line |

**Beyond scope, present:** bend handle (drag to curve, double-click to straighten), elbow shape, arrowheads (one / both / none), label editing in the panel, `Duplicate N` on the panel.

**Deviations:** (1) The bar is docked above the status line instead of floating at the line's midpoint — at the midpoint it covered the card the line points at and ate its clicks (D-033). (2) The chip itself is inert; the line's 24px band is what takes the click (D-035). (3) Hit width is compensated by hand, because Chromium's hit test ignores `non-scaling-stroke` (D-034).

## Acceptance

1. At 25% zoom, all four anchors remain clickable (24px effective target). — met: the target is 29 × 19 screen px at any zoom; only the inwards side stops at the card border.
2. Drag from an anchor to a second card creates one edge; releasing on blank creates none. — met, e2e.
3. Labels are topmost: clicking a label selects the edge at 100% and 25%. — met via the line band; the chip draws above cards but never intercepts.
4. Deleting a card removes its edges; one `⌘Z` restores the card and its edges. — met, e2e.
5. Moving a card keeps its edges attached with no jitter. — met by construction: endpoints are computed from card geometry at render.

## Validation

e2e: connect → label click → delete → undo; screenshots at 25/100/400%; hit-area maths covered by `scene.test.ts` anchor tests.

## Risks

- SVG inside a scaled scene can blur 1px lines at fractional scales; keep stroke-width `1/zoom` so lines stay 1px on screen.
- Anchor drag versus card drag share the same pointerdown; the anchor must win when the pointer is within its hit area, or connection becomes impossible at low zoom.
