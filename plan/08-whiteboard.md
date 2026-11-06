# 08 · Whiteboard

**Sprint:** S3 · **Estimate:** 1.5 days · **Gate:** G3 · **Depends:** 02
**Contract:** `spatial-language.md` §7 · **Audit:** A11 (nine hardcoded scene dimensions)

## Objective

Keep the canvas read-only, but make it structurally honest: one source of truth for the scene's geometry, labels that survive fit-scale, and no floating chrome on an empty board.

## Done when

- `1032 × 560` appears **only** in `src/pages/boards/scene.ts`.
- Section labels are legible at the default fit (≥ 7px effective at 1440 with the panel open).
- Empty board renders no toolbar, no minimap, no zoom dock; it explains what a board is and offers the way back.
- Zoom limits 50–160%, fit-to-view on mount, `0` resets, `+/-` step 10%.
- No accent outside the live card edge and the selection ring.

## Steps

1. **Extract** `src/pages/boards/scene.ts`:
   ```ts
   export const SCENE = { w: 1032, h: 560, padX: 72, padY: 104 } as const;
   export const fitScale = (w: number, h: number) => Math.min(1, (w - SCENE.padX) / SCENE.w, (h - SCENE.padY) / SCENE.h);
   export const minimapBox = (s: {x:number;y:number;w:number;h:number}) => ({ … percentages … });
   ```
   Replace the literals in `Boards.tsx:11,12,210,293-296` and the `1032/560` in `boards.module.css:157-158` (CSS keeps `width: var(--scene-w)` set from JS, or accepts the constant via inline style — choose one and remove the other).
2. **Fit** — `ResizeObserver` already exists; move its maths into `fitScale`, clamp 0.5–1.0 for the initial fit, keep user zoom separate (`zoom` × `fit`).
3. **Labels** — `.sectionTitle` 11/16 mono at 0.73 fit ≈ 8px: raise to 12/16 and add `letter-spacing .08em`; `.cardEyebrow` 10.5/14; `.cardTitle` 13/18; verify at 1440 with panel open, then at 1280.
4. **Empty** — wrap toolbar / minimap / zoom dock / status bar in `!empty` (partly done); the empty block must state: read-only in this build, what a board holds, and a button back to the index.
5. **States** — `.bcard` hover = border only; `.bcardSelected` = 1px accent ring + `--e1`; `.tool` gets `:disabled` styling for the three deferred tools (they are currently clickable and apologise → make them disabled with `title`).
6. **Delete the apology path** — remove the `notice` state for tools; the disabled tooltip is the whole message.

## Files

| Action | Path |
| --- | --- |
| add | `src/pages/boards/scene.ts` |
| edit | `src/pages/Boards.tsx` |
| edit | `src/pages/boards.module.css` |

## Verify

```bash
npm run check && npm run build
grep -rn "1032\|560" src | grep -v "scene.ts"      # 0
grep -n "notice" src/pages/Boards.tsx              # 0
grep -c "empty ? null" src/pages/Boards.tsx        # 4 (toolbar, minimap, zoom, status)
```

Screenshots: board at 1440 (panel open and closed), 1280, zoom 50% and 160%, empty board.

## Risks

- **Extraction is where it broke last time** (transform origin). Do it as a pure refactor first (no visual change, screenshot before/after identical), then tune labels in a second commit.
- CSS constants and JS constants drifting apart is the original bug; if CSS needs the size, set it from JS once.

## Handoff

Read-only is a deliberate boundary. Editing (drag, edges, tools) is post-MVP; do not leave half-wired gestures.
