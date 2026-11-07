/* Pure gesture geometry. Answers four questions and nothing else: where did the
   pointer land in scene space, which card is under it, what does a marquee
   cover, and what is the single snap a released drag gets. No React, no DOM
   writes, so a 150-card drag can be tested without a browser. */

import {
  CARD_DEFAULT_H,
  CARD_MIN_W,
  SCENE_H,
  SCENE_W,
  SNAP_THRESHOLD,
  type Point,
  type Rect,
  type SceneCard,
} from './scene';

export const CARD_DEFAULT_W = 268;
export const CARD_MIN_H = 64;
export const SCENE_MARGIN = 8;

/** Screen pixels to scene units. `scale` is fitRatio × zoom, i.e. the full
    transform applied to the scene element, so this stays correct after a
    window resize as well as after a zoom. */
export function scenePoint(
  clientX: number,
  clientY: number,
  origin: { left: number; top: number },
  scale: number,
): Point {
  const s = Number.isFinite(scale) && scale > 0.01 ? scale : 1;
  return { x: (clientX - origin.left) / s, y: (clientY - origin.top) / s };
}

/** Topmost card wins: cards are painted in array order, so the search runs
    backwards. Height comes from the live DOM because cards are content-sized;
    callers pass a measured map built once per session. */
export function hitTest(
  cards: readonly SceneCard[],
  point: Point,
  heightOf: (card: SceneCard) => number,
): SceneCard | null {
  for (let i = cards.length - 1; i >= 0; i -= 1) {
    const card = cards[i];
    if (!card) continue;
    const h = heightOf(card);
    if (
      point.x >= card.x &&
      point.x <= card.x + card.w &&
      point.y >= card.y &&
      point.y <= card.y + h
    ) {
      return card;
    }
  }
  return null;
}

export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

export function rectOf(card: SceneCard, heightOf: (card: SceneCard) => number): Rect {
  return { x: card.x, y: card.y, w: card.w, h: heightOf(card) };
}

/** Strict intersection, so a marquee that only touches a card's edge does not
    take it. Same rule as `rectsIntersect` in scene.ts, applied in bulk. */
export function cardsInRect(
  cards: readonly SceneCard[],
  rect: Rect,
  heightOf: (card: SceneCard) => number,
): string[] {
  const ids: string[] = [];
  for (const card of cards) {
    const r = rectOf(card, heightOf);
    if (rect.x < r.x + r.w && rect.x + rect.w > r.x && rect.y < r.y + r.h && rect.y + rect.h > r.y) {
      ids.push(card.id);
    }
  }
  return ids;
}

export function boundingRect(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export type SnapResult = {
  dx: number;
  dy: number;
  /** Vertical guide, in scene coordinates, or null when nothing aligned. */
  x: number | null;
  /** Horizontal guide, in scene coordinates. */
  y: number | null;
};

const NO_SNAP: SnapResult = { dx: 0, dy: 0, x: null, y: null };

function bestDelta(mine: readonly number[], theirs: readonly number[], threshold: number) {
  let delta = 0;
  let distance = Infinity;
  let line: number | null = null;
  for (const t of theirs) {
    for (const m of mine) {
      const d = t - m;
      if (Math.abs(d) <= threshold && Math.abs(d) < distance) {
        delta = d;
        distance = Math.abs(d);
        line = t;
      }
    }
  }
  return { delta, line, hit: line !== null };
}

/** One snap per axis, chosen on release. `moving` is the selection's bounding
    box already displaced by the raw drag; `others` are the untouched cards.
    No magnetic pull while moving — the caller only applies `dx`/`dy` on drop. */
export function snapMove(
  moving: Rect,
  others: readonly Rect[],
  threshold = SNAP_THRESHOLD,
): SnapResult {
  if (others.length === 0) return NO_SNAP;
  const mineX = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const mineY = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];
  const theirX: number[] = [];
  const theirY: number[] = [];
  for (const r of others) {
    theirX.push(r.x, r.x + r.w / 2, r.x + r.w);
    theirY.push(r.y, r.y + r.h / 2, r.y + r.h);
  }
  const x = bestDelta(mineX, theirX, threshold);
  const y = bestDelta(mineY, theirY, threshold);
  return { dx: x.delta, dy: y.delta, x: x.line, y: y.line };
}

/** Keeps a card fully inside the scene without changing its size. Edits that
    drift off-canvas are lost work, so the boundary is enforced, not clipped. */
export function clampRect(r: Rect, sceneW = SCENE_W, sceneH = SCENE_H): Rect {
  return {
    ...r,
    x: Math.max(SCENE_MARGIN, Math.min(sceneW - r.w - SCENE_MARGIN, r.x)),
    y: Math.max(SCENE_MARGIN, Math.min(sceneH - r.h - SCENE_MARGIN, r.y)),
  };
}

/** Resize from the bottom-right handle. Minimum size is enforced here so the
    DOM never sees an impossible width mid-drag. */
export function resizeRect(from: Rect, dx: number, dy: number): { w: number; h: number } {
  return {
    w: Math.max(CARD_MIN_W, Math.min(SCENE_W - from.x - SCENE_MARGIN, from.w + dx)),
    h: Math.max(CARD_MIN_H, Math.min(SCENE_H - from.y - SCENE_MARGIN, from.h + dy)),
  };
}

/** A new card lands where the click landed, keeps its header on screen, and is
    assigned to whichever section contains its top-left corner. */
export function createCardAt(
  at: Point,
  id: string,
  sections: readonly { id: string; x: number; y: number; w: number; h: number }[],
): SceneCard {
  const rect = clampRect({ x: at.x, y: at.y, w: CARD_DEFAULT_W, h: CARD_DEFAULT_H });
  // Membership is decided by where the card actually landed, not by the raw
  // click: a click below the canvas folds the card back inside a section.
  const target = sections.find(
    (s) => rect.x >= s.x && rect.x <= s.x + s.w && rect.y >= s.y && rect.y <= s.y + s.h,
  );
  return {
    id,
    sectionId: target?.id ?? '',
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    eyebrow: 'CARD',
    title: '',
    lines: [],
  };
}
