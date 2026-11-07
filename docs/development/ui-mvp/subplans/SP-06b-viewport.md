# SP-06b · Viewport: zoom, pan, pointer machine

**Parent:** [SP-06](SP-06-whiteboard.md) · **Days:** 1.25 · **Status:** Completed 2026-11-07 · **Depends:** SP-06a

## Objective

Fix the two engine bugs the reference implementation measured, then build pan and pointer-anchored zoom on top of the fix — not around it.

## Scope

**In:** viewport in a ref; wheel pan; `⌘`+wheel zoom anchored at the pointer; `space`+drag pan; zoom dock; `⌘0` fit; `⌘+`/`⌘-`; 10–400% clamp; one pointer session with window listeners.
**Out:** card dragging (SP-06c), edges (SP-06d), undo.

## UX

Parent §D. Wheel moves the canvas; `⌘`+wheel zooms under the cursor, continuously; `space` shows a grab cursor; the zoom dock reads "100%".

## Visual

Parent §E. Dot grid scales with zoom but dots stay 1px; chrome stays fixed size. Nothing animates except button zoom (120ms).

## Technical plan

**Bug 1 — zoom collapse.** The reference read `viewport.zoom` from the render closure; ten wheel events in one frame all used the same value (30 gestures → 1.16× instead of 1.6×). Fix: `viewportRef.current` is the single source; each wheel event mutates it synchronously and schedules one `rAF` commit.

**Bug 2 — listener rebinding.** Its drag effect depended on interaction state, re-binding listeners and re-rendering all cards per move. Fix: attach `pointermove`/`pointerup` to `window` once per session on `pointerdown`; the session is a mutable ref; React state updates once per frame.

```ts
// design, not code to copy verbatim
const view = useRef({ x: 0, y: 0, zoom: 1 });
function onWheel(e) {
  if (e.metaKey || e.ctrlKey) {
    const factor = Math.exp(-e.deltaY * 0.0015);
    const z = clamp(view.current.zoom * factor, 0.1, 4);
    // keep the point under the cursor fixed
    const wx = (e.clientX - rect.left - view.current.x) / view.current.zoom;
    view.current = { zoom: z, x: e.clientX - rect.left - wx * z, y: e.clientY - rect.top - ((e.clientY - rect.top - view.current.y) / view.current.zoom) * z };
    scheduleFrame();
  } else {
    view.current.x -= e.deltaX; view.current.y -= e.deltaY;
    scheduleFrame();
  }
}
```

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Viewport ref + rAF commit | No state per event |
| T2 | Pointer-anchored zoom | Point under cursor stays put |
| T3 | Wheel pan + shift-wheel | Trackpad feels 1:1 |
| T4 | Space-drag pan | Cursor changes; release restores |
| T5 | Zoom dock + `⌘0` + keys | 10–400%, fit |

## Acceptance

1. 30 consecutive `⌘`+wheel events produce ≈30 zoom steps and a scale change of the expected magnitude (not one step).
2. Zooming in and out over a card keeps that card under the pointer (±2px).
3. Wheel scrolling does not re-render cards (verify with React DevTools highlight).
4. `⌘0` fits the scene; zoom clamps at 10% and 400%.
5. Panning at 400% holds 60fps with 150 cards (trace attached).

## Validation

A scripted wheel test through CDP (`Input.dispatchMouseEvent` wheel) asserting scale; performance trace; screenshots at 10/50/100/400%.

## Risks

- `e.metaKey` on Windows is `ctrlKey`; handle both.
- Pinch gestures arrive as `ctrlKey`+wheel; the same path handles them, which is why zoom must be continuous rather than stepped.

## Result (2026-11-07, done)

`scene.ts` gained four pure viewport functions (`fitViewport`, `panBy`, `zoomAt`, `wheelZoom`) with 5 unit tests. `useViewport.ts` owns the ref-driven state machine: wheel pan, `ctrl`/`meta`+wheel zoom anchored at the pointer, shift-wheel horizontal pan, space-drag and middle-button pan, `⌘0` fit, `⌘+`/`⌘-`, 10–400% clamp, and zoom-dock sync.

**Acceptance, with measurements**

| # | Result |
| --- | --- |
| 1 | 30 consecutive ctrl+wheel gestures → **30 distinct scale values**; accumulated ratio 2.46× (not one 1.03× step). |
| 2 | Scene point under the pointer stays within **<2px** on zoom in and on zoom back out. |
| 3 | 10 wheel-pan events → **0 card mutations** (MutationObserver on the scene subtree, filtering the scene's own transform). Zero React renders. |
| 4 | Clamps read exactly `10%` and `400%`; `⌘0` returns to `100%` with translate (0,0). |
| 5 | 150 appended cards, 90 alternating wheel pans, 148 sampled frames: **P50 16.7ms · P95 16.7ms · max 16.8ms · 0 frames >20ms**. Reproducible via the `viewport: 150-card pan holds P95 <= 20ms` assertion in `npm run e2e`. |

Screenshots `sp06b-zoom-010` / `-050` (51%) / `-100` / `-400`, plus `sp06b-default`.

**Deviations, with reasons**

1. **The rAF commit writes DOM properties, not React state.** The plan allowed "state updated at most once per frame"; zero renders is stronger and is what makes acceptance #3 and the 150-card frame budget hold. The viewport ref is the single source, and a no-dependency `useLayoutEffect` re-applies it after any unrelated render.
2. **`useViewport.ts` instead of merging into `useCanvasGestures.ts` now.** SP-06c owns card dragging; extracting a combined gestures module before there is a second gesture would be premature. The pan session already uses the single-window-listener pattern 06c needs.
3. **Dot grid uses a power-of-two LOD below 8px spacing.** At 10% zoom, 1px dots at 1.6px spacing rendered as a grey sheet. Doubling the stride keeps dots 1px and the paper quiet; a screenshot caught the problem.
4. **`view.zoom` is the user multiplier (dock reads 100% at rest), not the composited scale.** The composited scale is `fit × zoom`, matching the previous zoom dock semantics. Clamp 10–400% applies to the multiplier.
5. **The board viewport is still not persisted.** `BoardScene.viewport` exists, but the hook starts at `fitViewport()`; wiring load/save belongs to SP-06c alongside the first real edit, and Q-4 is still unapproved. Nothing in the UI claims a viewport was saved.

**Left:** card dragging and the 150-card **drag** trace (06c), edges (06d), persisted viewport (Q-4).
