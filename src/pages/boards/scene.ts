/* Pure board geometry. No React, no storage, no application imports.
   SP-06b/c/d build gestures on these functions; keeping them pure is what
   makes a 150-card drag testable without a browser. */

export const SCENE_W = 1032;
export const SCENE_H = 560;
export const GRID = 16;
export const CARD_MIN_W = 180;
export const CARD_DEFAULT_H = 96;
export const SECTION_PAD = 16;
export const CARD_HEADER_CENTER = 34;

/* The canvas area reserves space for the floating chrome (toolbar, status
   bar, minimap). Fit is measured against what is left, not the whole panel. */
export const FIT_PAD_X = 72;
export const FIT_PAD_Y = 104;

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;
export const SNAP_THRESHOLD = 6;
export const ANCHOR_HIT = 24;
export const ANCHOR_DOT = 12;
export const WHEEL_ZOOM_SENSITIVITY = 0.0015;
export const ZOOM_STEP = 1.1;

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Viewport = { x: number; y: number; zoom: number };

export type SceneSection = Rect & { id: string; title: string; tint: string };
export type SceneCard = Rect & {
  id: string;
  sectionId: string;
  title: string;
  eyebrow: string;
  lines: string[];
  ref?: string;
  live?: { runLabel: string; note: string };
};
export type SceneEdge = { from: string; to: string; label: string };

export type BoardScene = {
  version: 1;
  id: string;
  name: string;
  updated: string;
  sections: SceneSection[];
  cards: SceneCard[];
  edges: SceneEdge[];
  viewport: Viewport;
};

/** The shape the sample boards ship in. Declared here rather than imported so
    this module stays pure; structurally compatible with `data/types.ts`. */
export type LegacyBoard = {
  id: string;
  name: string;
  updated: string;
  cards: number;
  results: number;
  sections: Array<Rect & { id: string; title: string; tint: string }>;
  boardCards: Array<{
    id: string;
    sectionId: string;
    x: number;
    y: number;
    w: number;
    title: string;
    eyebrow: string;
    lines: string[];
    ref?: string;
    live?: { runLabel: string; note: string };
  }>;
  edges: SceneEdge[];
};

/** CSS custom properties, so the scene size has one numeric source. Inject
    these on the canvas container, not on `.scene`: custom properties only
    inherit downwards, and the container's dot grid uses them too. */
export function sceneVars(): Record<string, string> {
  return {
    '--scene-w': `${SCENE_W}px`,
    '--scene-h': `${SCENE_H}px`,
    '--scene-grid': `${GRID}px`,
  };
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Never fits above 100%, never collapses to zero or a negative transform. */
export function fitScale(
  width: number,
  height: number,
  padX = FIT_PAD_X,
  padY = FIT_PAD_Y,
): number {
  const availableW = width - padX;
  const availableH = height - padY;
  if (availableW <= 0 || availableH <= 0) return MIN_SCALE;
  return clampScale(Math.min(1, availableW / SCENE_W, availableH / SCENE_H));
}

/** Exactly one snap on release: the nearest target within `threshold`
   (inclusive) wins; anything further returns the original value. */
export function snap(value: number, targets: readonly number[], threshold = SNAP_THRESHOLD): number {
  let best: number | undefined;
  let distance = Infinity;
  for (const target of targets) {
    const d = Math.abs(value - target);
    if (d <= threshold && d < distance) {
      best = target;
      distance = d;
    }
  }
  return best ?? value;
}

/** Four edge anchors in scene coordinates, clockwise from the top. No
   rotation exists in v1, so the rect is axis-aligned. */
export function anchorPoints(card: Rect): Point[] {
  return [
    { x: card.x + card.w / 2, y: card.y },
    { x: card.x + card.w, y: card.y + card.h / 2 },
    { x: card.x + card.w / 2, y: card.y + card.h },
    { x: card.x, y: card.y + card.h / 2 },
  ];
}

/** Hit areas live in scene units and are divided by the current scale, so the
   pointer sees a constant 24px target at 10% and at 400% zoom. */
export function anchorHitSize(scale: number): number {
  return ANCHOR_HIT / clampScale(scale);
}

export function anchorDotSize(scale: number): number {
  return ANCHOR_DOT / clampScale(scale);
}

/** Strict overlap: rectangles that only touch an edge do not intersect. A
   marquee that ends exactly on a card's border must not select it. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** A neutral viewport: user zoom is 1 (dock reads 100%) and the scene sits at
    the stage origin. `fit` is applied separately when the canvas is measured. */
export function fitViewport(): Viewport {
  return { x: 0, y: 0, zoom: 1 };
}

export function panBy(view: Viewport, dx: number, dy: number): Viewport {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

/** Keep the scene point under `pointer` fixed while the zoom changes.
    `pointer` is in screen pixels relative to the scene origin; `fit` cancels
    out of the ratio, so only the user zoom is needed here. */
export function zoomAt(view: Viewport, nextZoom: number, pointer: Point): Viewport {
  const zoom = clampScale(nextZoom);
  const ratio = zoom / view.zoom;
  return {
    zoom,
    x: pointer.x - (pointer.x - view.x) * ratio,
    y: pointer.y - (pointer.y - view.y) * ratio,
  };
}

/** Continuous, not stepped: pinch gestures arrive as ctrl+wheel with small
    deltas, and 30 of them must accumulate into 30 distinct zoom values. */
export function wheelZoom(view: Viewport, deltaY: number, pointer: Point): Viewport {
  return zoomAt(view, view.zoom * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY), pointer);
}

/** The centre of a card's header row — where edges attach in the read-only
   renderer. Kept here so SP-06d does not inherit a second magic number. */
export function cardCenter(card: Rect): Point {
  return { x: card.x + card.w / 2, y: card.y + CARD_HEADER_CENTER };
}

/** Migration from the sample boards into the versioned scene schema.
   Card height `0` means "follows the content": the card is laid out by its own
   text, and gestures read the real height from the DOM once per session. A
   number is an explicit height the user set through the resize handle, so
   geometry must never assume `h > 0`. */
export function sceneFromBoard(legacy: LegacyBoard): BoardScene {
  return {
    version: 1,
    id: legacy.id,
    name: legacy.name,
    updated: legacy.updated,
    sections: legacy.sections.map((section) => ({ ...section })),
    // Sample cards are content-sized; the numbers arrive from measurement.
    cards: legacy.boardCards.map((card) => ({ ...card, h: 0 })),
    edges: legacy.edges.map((edge) => ({ ...edge })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
