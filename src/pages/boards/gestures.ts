/* Pure gesture geometry. Answers four questions and nothing else: where did the
   pointer land in scene space, which object is under it, what does a marquee
   cover, and what is the single snap a released drag gets. No React, no DOM
   writes, so a 150-card drag can be tested without a browser. */

import {
  CARD_MIN_H,
  CARD_MIN_W,
  CARD_W,
  SCENE_H,
  SCENE_W,
  SNAP_THRESHOLD,
  SECTION_MIN_H,
  SECTION_MIN_W,
  type Point,
  type Rect,
  type SceneCard,
  type SceneSection,
  type Side,
} from './scene';

export const SCENE_MARGIN = 8;

/** Screen pixels to scene units. `zoom` is the full transform applied to the
    scene element, so this stays correct after a resize as well as a zoom. */
export function scenePoint(
  clientX: number,
  clientY: number,
  origin: { left: number; top: number },
  zoom: number,
): Point {
  const z = Number.isFinite(zoom) && zoom > 0.01 ? zoom : 1;
  return { x: (clientX - origin.left) / z, y: (clientY - origin.top) / z };
}

export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
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
    const r = { x: card.x, y: card.y, w: card.w, h: heightOf(card) };
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

/** A guide spans both the moving box and the object it aligned to, so the line
   reads as a ruler rather than a segment floating in the middle. */
export type Guide = { axis: 'x' | 'y'; pos: number; from: number; to: number };
export type SnapResult = { dx: number; dy: number; guides: Guide[] };

const NO_SNAP: SnapResult = { dx: 0, dy: 0, guides: [] };

type Match = { delta: number; pos: number; other: Rect } | null;

function bestX(mine: readonly number[], others: readonly Rect[], threshold: number): Match {
  let best: Match = null;
  for (const other of others) {
    for (const target of [other.x, other.x + other.w / 2, other.x + other.w]) {
      for (const m of mine) {
        const delta = target - m;
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, pos: target, other };
        }
      }
    }
  }
  return best;
}

function bestY(mine: readonly number[], others: readonly Rect[], threshold: number): Match {
  let best: Match = null;
  for (const other of others) {
    for (const target of [other.y, other.y + other.h / 2, other.y + other.h]) {
      for (const m of mine) {
        const delta = target - m;
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, pos: target, other };
        }
      }
    }
  }
  return best;
}

/** One snap per axis, chosen on release. `moving` is the selection's bounding
    box already displaced by the raw drag; `others` are the untouched objects.
    No magnetic pull while moving — the caller only applies `dx`/`dy` on drop. */
export function snapMove(
  moving: Rect,
  others: readonly Rect[],
  threshold = SNAP_THRESHOLD,
): SnapResult {
  if (others.length === 0) return NO_SNAP;
  const mineX = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const mineY = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];
  const x = bestX(mineX, others, threshold);
  const y = bestY(mineY, others, threshold);
  const guides: Guide[] = [];
  if (x) {
    guides.push({
      axis: 'x',
      pos: x.pos,
      from: Math.min(moving.y + (y?.delta ?? 0), x.other.y),
      to: Math.max(moving.y + moving.h + (y?.delta ?? 0), x.other.y + x.other.h),
    });
  }
  if (y) {
    guides.push({
      axis: 'y',
      pos: y.pos,
      from: Math.min(moving.x + (x?.delta ?? 0), y.other.x),
      to: Math.max(moving.x + moving.w + (x?.delta ?? 0), y.other.x + y.other.w),
    });
  }
  return { dx: x?.delta ?? 0, dy: y?.delta ?? 0, guides };
}

/** Keeps an object inside the scene without changing its size. Edits that
    drift off-canvas are lost work, so the boundary is enforced, not clipped. */
export function clampRect(rect: Rect, sceneW = SCENE_W, sceneH = SCENE_H): Rect {
  const maxX = sceneW - rect.w - SCENE_MARGIN;
  const maxY = sceneH - rect.h - SCENE_MARGIN;
  return {
    ...rect,
    x: Math.max(SCENE_MARGIN, Math.min(maxX, rect.x)),
    y: Math.max(SCENE_MARGIN, Math.min(maxY, rect.y)),
  };
}

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Resize from any of the eight handles. `dx`/`dy` are scene units since
    pointerdown. Minimum sizes live here so the DOM never sees an impossible
    box mid-drag, and the far edge stays put when dragging a north or west
    handle. */
export function resizeRect(
  base: Rect,
  dir: ResizeDir,
  dx: number,
  dy: number,
  min: { w: number; h: number } = { w: CARD_MIN_W, h: CARD_MIN_H },
  scene: { w: number; h: number } = { w: SCENE_W, h: SCENE_H },
): Rect {
  let { x, y, w, h } = base;
  if (dir.includes('e')) w = Math.min(scene.w - SCENE_MARGIN - x, base.w + dx);
  if (dir.includes('s')) h = Math.min(scene.h - SCENE_MARGIN - y, base.h + dy);
  if (dir.includes('w')) {
    w = base.w - dx;
    if (w < min.w) w = min.w;
    x = base.x + base.w - w;
    if (x < SCENE_MARGIN) {
      x = SCENE_MARGIN;
      w = base.x + base.w - SCENE_MARGIN;
    }
  }
  if (dir.includes('n')) {
    h = base.h - dy;
    if (h < min.h) h = min.h;
    y = base.y + base.h - h;
    if (y < SCENE_MARGIN) {
      y = SCENE_MARGIN;
      h = base.y + base.h - SCENE_MARGIN;
    }
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(Math.max(min.w, w)), h: Math.round(Math.max(min.h, h)) };
}

/** Where a new card lands: at the click, fully inside the scene, and a member
    of whichever section actually contains it afterwards. */
export function createCardAt(
  at: Point,
  id: string,
  sections: readonly SceneSection[],
): SceneCard {
  const rect = clampRect({ x: at.x, y: at.y, w: CARD_W, h: 0 });
  const host = sectionAt(sections, { x: rect.x + 12, y: rect.y + 12 });
  return {
    id,
    sectionId: host ?? '',
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: 0,
    eyebrow: 'CARD',
    title: '',
    lines: [],
    color: 'plain',
  };
}

export function sectionAt(
  sections: readonly SceneSection[],
  p: Point,
): string | null {
  for (let i = sections.length - 1; i >= 0; i -= 1) {
    const s = sections[i];
    if (!s) continue;
    if (p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) return s.id;
  }
  return null;
}

/** Membership follows the card's centre, so nudging a card across a section
    border reassigns it instead of leaving it stranded in the old one. */
export function sectionForCard(
  sections: readonly SceneSection[],
  card: Rect,
): string {
  const centre = { x: card.x + card.w / 2, y: card.y + card.h / 2 };
  return sectionAt(sections, centre) ?? '';
}

/** New sections are placed at the click and grow from there. */
export function createSectionAt(at: Point, id: string): SceneSection {
  const rect = clampRect({ x: at.x, y: at.y, w: 320, h: 240 });
  return { id, title: 'New section', color: 'stone', x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}

export const SECTION_MIN: { w: number; h: number } = { w: SECTION_MIN_W, h: SECTION_MIN_H };

/** A section grows to contain its members, never shrinks below its own frame:
    a card dropped past the bottom edge extends the box rather than escaping. */
export function growSection(section: Rect, memberRects: readonly Rect[]): Rect {
  let { w, h } = section;
  for (const r of memberRects) {
    w = Math.max(w, r.x + r.w - section.x + 16);
    h = Math.max(h, r.y + r.h - section.y + 16);
  }
  return { ...section, w, h };
}

/** Alignment and distribution for a mixed selection of cards and sections. */
export type AlignMode = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom';

export function alignRects(rects: readonly Rect[], mode: AlignMode): Rect[] {
  if (rects.length < 2) return rects.slice();
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return rects.map((r) => {
    switch (mode) {
      case 'left':
        return { ...r, x: left };
      case 'centerH':
        return { ...r, x: Math.round((left + right) / 2 - r.w / 2) };
      case 'right':
        return { ...r, x: right - r.w };
      case 'top':
        return { ...r, y: top };
      case 'centerV':
        return { ...r, y: Math.round((top + bottom) / 2 - r.h / 2) };
      default:
        return { ...r, y: bottom - r.h };
    }
  });
}

/** Equal gaps between neighbours. Returns the gap actually used, so the caller
    can refuse the move when the objects do not fit (gap below 8). */
export function distributeRects(
  rects: readonly Rect[],
  axis: 'h' | 'v',
): { rects: Rect[]; gap: number } {
  if (rects.length < 3) return { rects: rects.slice(), gap: 0 };
  const size = (r: Rect) => (axis === 'h' ? r.w : r.h);
  const order = rects
    .map((r, index) => ({ r, index }))
    .sort((a, b) => (axis === 'h' ? a.r.x - b.r.x : a.r.y - b.r.y));
  const first = order[0]?.r;
  const last = order[order.length - 1]?.r;
  if (!first || !last) return { rects: rects.slice(), gap: 0 };
  const span =
    axis === 'h' ? last.x + last.w - first.x : last.y + last.h - first.y;
  const total = order.reduce((sum, o) => sum + size(o.r), 0);
  const gap = (span - total) / (order.length - 1);
  if (gap < 8) return { rects: rects.slice(), gap };
  const out = rects.slice();
  let cursor = axis === 'h' ? first.x : first.y;
  // `index` is the position in the caller's array — the order in the scene, not
  // the sort order. Writing to the sorted slot swaps the objects instead.
  for (const { r, index } of order) {
    out[index] =
      axis === 'h' ? { ...r, x: Math.round(cursor) } : { ...r, y: Math.round(cursor) };
    cursor += size(r) + gap;
  }
  return { rects: out, gap };
}

/** The four anchor dots sit on the sides; a hit test in screen pixels is
    divided by the zoom so the target is the same size at 10% and 400%. */
export function sideAtPoint(rect: Rect, p: Point, tolerance: number): Side | null {
  const inside =
    p.x >= rect.x - tolerance &&
    p.x <= rect.x + rect.w + tolerance &&
    p.y >= rect.y - tolerance &&
    p.y <= rect.y + rect.h + tolerance;
  if (!inside) return null;
  const options: Array<[Side, number, number]> = [
    ['l', Math.abs(p.x - rect.x), Math.abs(p.y - (rect.y + rect.h / 2))],
    ['r', Math.abs(p.x - (rect.x + rect.w)), Math.abs(p.y - (rect.y + rect.h / 2))],
    ['t', Math.abs(p.y - rect.y), Math.abs(p.x - (rect.x + rect.w / 2))],
    ['b', Math.abs(p.y - (rect.y + rect.h)), Math.abs(p.x - (rect.x + rect.w / 2))],
  ];
  const nearest = options
    .filter(([, edge]) => edge <= tolerance)
    .sort((a, b) => a[1] - b[1])[0];
  return nearest?.[0] ?? null;
}
