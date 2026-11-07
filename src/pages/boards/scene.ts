/* Pure board geometry. No React, no storage, no application imports.

   The canvas is a workspace, not a poster: 2400 × 1600 scene units, cards and
   sections placed freely inside it. `fit` measures the *content* bounds, so a
   nearly empty board is not shrunk to a stamp. */

export const SCENE_W = 2400;
export const SCENE_H = 1600;
export const GRID = 16;

export const CARD_W = 264;
export const CARD_MIN_W = 160;
export const CARD_MIN_H = 52;
export const CARD_FOLD_H = 44;
export const SECTION_MIN_W = 240;
export const SECTION_MIN_H = 120;
export const SECTION_HEAD = 30;

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;
export const SNAP_THRESHOLD = 6;
export const WHEEL_ZOOM_SENSITIVITY = 0.0015;
export const ZOOM_STEP = 1.15;

/* Space reserved for the floating chrome: toolbar, status dock, zoom dock and
   the header. Fit measures what is actually left. */
export const FIT_PAD_X = 96;
export const FIT_PAD_Y = 96;

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Side = 't' | 'r' | 'b' | 'l';
export type Viewport = { x: number; y: number; zoom: number };

/* Five fills, no more. Each is a tint of a palette hue already in the app, so
   a coloured card still reads as paper rather than a sticky note. */
export const CARD_COLORS = ['plain', 'sage', 'amber', 'clay', 'stone'] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export function isCardColor(value: unknown): value is CardColor {
  return typeof value === 'string' && (CARD_COLORS as readonly string[]).includes(value);
}

export type SceneSection = Rect & {
  id: string;
  title: string;
  color: CardColor;
  collapsed?: boolean;
};

export type SceneCard = Rect & {
  id: string;
  sectionId: string;
  title: string;
  eyebrow: string;
  lines: string[];
  color: CardColor;
  /** A folded card shows its title only. */
  folded?: boolean;
  ref?: string;
  live?: { runLabel: string; note: string };
};

export type EdgeShape = 'curve' | 'ortho';
export type EdgeDirection = 'none' | 'one' | 'both';

export type SceneEdge = {
  id: string;
  from: string;
  to: string;
  fromSide: Side;
  toSide: Side;
  shape: EdgeShape;
  direction: EdgeDirection;
  label?: string;
  /** Offset of the curve's control point from its natural midpoint. */
  bend?: Point;
};

export type BoardScene = {
  version: 2;
  id: string;
  name: string;
  updated: string;
  sections: SceneSection[];
  cards: SceneCard[];
  edges: SceneEdge[];
};

/** The shape the sample boards ship in. Declared here rather than imported so
    this module stays pure; structurally compatible with `data/types.ts`. */
export type LegacyBoard = {
  id: string;
  name: string;
  updated: string;
  sections: Array<Rect & { id: string; title: string; tint?: string; color?: CardColor }>;
  boardCards: Array<{
    id: string;
    sectionId: string;
    x: number;
    y: number;
    w: number;
    title: string;
    eyebrow: string;
    lines: string[];
    color?: CardColor;
    folded?: boolean;
    ref?: string;
    live?: { runLabel: string; note: string };
  }>;
  edges: Array<{
    from: string;
    to: string;
    label: string;
    fromSide?: Side;
    toSide?: Side;
    shape?: EdgeShape;
    direction?: EdgeDirection;
  }>;
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

/** Cards are content-sized (`h === 0`) until the user resizes one. Geometry
    that runs before the DOM exists needs a number anyway, so this is the
    estimate: header + eyebrow + one line per entry + optional footer rows. */
export function estimateCardHeight(card: {
  title: string;
  lines: string[];
  folded?: boolean;
  ref?: string;
  live?: unknown;
}): number {
  if (card.folded) return CARD_FOLD_H;
  const titleRows = Math.min(2, Math.max(1, Math.ceil(card.title.length / 30)));
  let h = 10 + 14 + 4 + titleRows * 18 + 4;
  h += card.lines.length * 16;
  if (card.ref) h += 16;
  if (card.live) h += 16;
  return Math.round(h + 8);
}

export function heightOf(card: SceneCard, measured?: Map<string, number>): number {
  return measured?.get(card.id) ?? (card.h || estimateCardHeight(card));
}

export function rectOfCard(card: SceneCard, measured?: Map<string, number>): Rect {
  return { x: card.x, y: card.y, w: card.w, h: heightOf(card, measured) };
}

/** Everything the board contains, with a floor so an empty board still has a
    frame to centre. */
export function contentBounds(
  scene: Pick<BoardScene, 'sections' | 'cards'>,
  measured?: Map<string, number>,
): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const section of scene.sections) {
    minX = Math.min(minX, section.x);
    minY = Math.min(minY, section.y - SECTION_HEAD);
    maxX = Math.max(maxX, section.x + section.w);
    maxY = Math.max(maxY, section.y + section.h);
  }
  for (const card of scene.cards) {
    minX = Math.min(minX, card.x);
    minY = Math.min(minY, card.y);
    maxX = Math.max(maxX, card.x + card.w);
    maxY = Math.max(maxY, card.y + heightOf(card, measured));
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: SCENE_W, h: SCENE_H };
  return { x: minX, y: minY, w: Math.max(120, maxX - minX), h: Math.max(120, maxY - minY) };
}

/** Fit `bounds` into the area, never above 100%: a four-card board should not
   be blown up until its text is poster-sized. */
export function fitViewport(bounds: Rect, width: number, height: number): Viewport {
  const availableW = Math.max(1, width - FIT_PAD_X);
  const availableH = Math.max(1, height - FIT_PAD_Y);
  const zoom = clampScale(Math.min(1, availableW / bounds.w, availableH / bounds.h));
  return {
    zoom,
    x: (width - bounds.w * zoom) / 2 - bounds.x * zoom,
    y: (height - bounds.h * zoom) / 2 - bounds.y * zoom,
  };
}

export function panBy(view: Viewport, dx: number, dy: number): Viewport {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

/** Keep the scene point under `pointer` fixed while the zoom changes.
    `pointer` is in screen pixels relative to the scene origin. */
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

export function scenePoint(clientX: number, clientY: number, origin: Point, zoom: number): Point {
  return { x: (clientX - origin.x) / zoom, y: (clientY - origin.y) / zoom };
}

export function centerOf(view: Viewport, width: number, height: number): Point {
  return { x: (width / 2 - view.x) / view.zoom, y: (height / 2 - view.y) / view.zoom };
}

/** Strict overlap: rectangles that only touch an edge do not intersect. A
   marquee that ends exactly on a card's border must not select it. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/* ---------- edges ---------- */

export function anchorOf(rect: Rect, side: Side): Point {
  switch (side) {
    case 't':
      return { x: rect.x + rect.w / 2, y: rect.y };
    case 'b':
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    case 'l':
      return { x: rect.x, y: rect.y + rect.h / 2 };
    default:
      return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
  }
}

function normal(side: Side): Point {
  switch (side) {
    case 't':
      return { x: 0, y: -1 };
    case 'b':
      return { x: 0, y: 1 };
    case 'l':
      return { x: -1, y: 0 };
    default:
      return { x: 1, y: 0 };
  }
}

/** Control points leave each anchor along the side's normal, so an edge never
   exits through the object it just left. */
export function edgeControls(
  from: Point,
  to: Point,
  fromSide: Side,
  toSide: Side,
  bend?: Point,
): { c1: Point; c2: Point } {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const k = Math.max(36, distance * 0.4);
  const n1 = normal(fromSide);
  const n2 = normal(toSide);
  const bx = bend?.x ?? 0;
  const by = bend?.y ?? 0;
  return {
    c1: { x: from.x + n1.x * k + bx, y: from.y + n1.y * k + by },
    c2: { x: to.x + n2.x * k + bx, y: to.y + n2.y * k + by },
  };
}

export function edgePath(
  from: Point,
  to: Point,
  fromSide: Side,
  toSide: Side,
  shape: EdgeShape,
  bend?: Point,
): string {
  if (shape === 'ortho') {
    const horizontal = fromSide === 'l' || fromSide === 'r';
    const mid = horizontal ? (from.x + to.x) / 2 : (from.y + to.y) / 2;
    const a = horizontal ? `L ${mid} ${from.y}` : `L ${from.x} ${mid}`;
    const b = horizontal ? `L ${mid} ${to.y}` : `L ${to.x} ${mid}`;
    return `M ${from.x} ${from.y} ${a} ${b} L ${to.x} ${to.y}`;
  }
  const { c1, c2 } = edgeControls(from, to, fromSide, toSide, bend);
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`;
}

/** Midpoint of the cubic at t = 0.5, plus its tangent, for the label chip. */
export function edgeMid(
  from: Point,
  to: Point,
  fromSide: Side,
  toSide: Side,
  bend?: Point,
): Point & { angle: number } {
  const { c1, c2 } = edgeControls(from, to, fromSide, toSide, bend);
  const x = (from.x + 3 * c1.x + 3 * c2.x + to.x) / 8;
  const y = (from.y + 3 * c1.y + 3 * c2.y + to.y) / 8;
  const dx = 3 * (c2.x - c1.x) + 3 * (to.x - from.x);
  const dy = 3 * (c2.y - c1.y) + 3 * (to.y - from.y);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

export function edgeArrowPoints(
  from: Point,
  to: Point,
  fromSide: Side,
  toSide: Side,
  bend?: Point,
): { tip: Point; left: Point; right: Point; angle: number } {
  const { c2 } = edgeControls(from, to, fromSide, toSide, bend);
  const angle = Math.atan2(to.y - c2.y, to.x - c2.x);
  const size = 7;
  return {
    tip: to,
    angle: (angle * 180) / Math.PI,
    left: {
      x: to.x - Math.cos(angle - 0.42) * size,
      y: to.y - Math.sin(angle - 0.42) * size,
    },
    right: {
      x: to.x - Math.cos(angle + 0.42) * size,
      y: to.y - Math.sin(angle + 0.42) * size,
    },
  };
}

/** Which side of `rect` a point is closest to — used when a link is dropped
   somewhere on the target, rather than exactly on one of its anchors. */
export function nearestSide(rect: Rect, p: Point): Side {
  const options: Array<[Side, number]> = [
    ['l', Math.abs(p.x - rect.x)],
    ['r', Math.abs(p.x - (rect.x + rect.w))],
    ['t', Math.abs(p.y - rect.y)],
    ['b', Math.abs(p.y - (rect.y + rect.h))],
  ];
  options.sort((a, b) => a[1] - b[1]);
  return options[0]?.[0] ?? 'l';
}

/* ---------- migration ---------- */

export function sceneFromBoard(legacy: LegacyBoard): BoardScene {
  const sections: SceneSection[] = legacy.sections.map((section) => ({
    id: section.id,
    title: section.title,
    // The sample's tint is a colour decision already made; the five fills are
    // the only ones the canvas can render, so it is mapped by position.
    color: section.color ?? colorFromTint(section.tint ?? ''),
    x: section.x,
    y: section.y,
    w: section.w,
    h: section.h,
  }));
  return {
    version: 2,
    id: legacy.id,
    name: legacy.name,
    updated: legacy.updated,
    sections,
    cards: legacy.boardCards.map((card) => ({
      ...card,
      h: 0,
      color: card.color ?? 'plain',
    })),
    edges: legacy.edges.map((edge, index) => ({
      id: `e-${index}-${edge.from}-${edge.to}`,
      from: edge.from,
      to: edge.to,
      fromSide: edge.fromSide ?? 'r',
      toSide: edge.toSide ?? 'l',
      shape: edge.shape ?? 'curve',
      direction: edge.direction ?? 'one',
      label: edge.label,
    })),
  };
}

function colorFromTint(tint: string): CardColor {
  if (tint.includes('94, 107, 80')) return 'sage';
  if (tint.includes('168, 121, 44')) return 'amber';
  if (tint.includes('181, 111, 80')) return 'clay';
  return 'stone';
}

/** v1 stored content-sized cards, no colours, and edges without sides. It is
    read once and rewritten as v2 on the next edit, so nobody loses a board
    because the schema moved. */
export function readSceneV1(value: unknown): BoardScene | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as {
    version?: number;
    id?: string;
    name?: string;
    updated?: string;
    sections?: Array<Rect & { id: string; title: string; tint?: string; color?: unknown }>;
    cards?: Array<SceneCard & { color?: unknown }>;
    edges?: Array<{ from: string; to: string; label: string }>;
  };
  if (raw.version !== 1 || !Array.isArray(raw.cards) || !Array.isArray(raw.sections)) return null;
  return {
    version: 2,
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    updated: String(raw.updated ?? ''),
    sections: raw.sections.map((section) => ({
      id: section.id,
      title: section.title,
      color: isCardColor(section.color) ? section.color : colorFromTint(section.tint ?? ''),
      x: section.x,
      y: section.y,
      w: section.w,
      h: section.h,
    })),
    cards: raw.cards.map((card) => ({
      ...card,
      color: isCardColor(card.color) ? card.color : 'plain',
      lines: Array.isArray(card.lines) ? card.lines : [],
    })),
    edges: (raw.edges ?? []).map((edge, index) => ({
      id: `e-${index}-${edge.from}-${edge.to}`,
      from: edge.from,
      to: edge.to,
      fromSide: 'r',
      toSide: 'l',
      shape: 'curve',
      direction: 'one',
      label: edge.label,
    })),
  };
}

export function readScene(value: unknown): BoardScene | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<BoardScene> & { version?: number };
  if (raw.version !== 2) return null;
  if (!Array.isArray(raw.sections) || !Array.isArray(raw.cards) || !Array.isArray(raw.edges)) {
    return null;
  }
  for (const card of raw.cards) {
    if (!card || typeof card.id !== 'string' || typeof card.x !== 'number' || typeof card.y !== 'number') {
      return null;
    }
  }
  return {
    version: 2,
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    updated: String(raw.updated ?? ''),
    sections: raw.sections.map((section) => ({
      ...section,
      color: isCardColor(section.color) ? section.color : 'stone',
    })),
    cards: raw.cards.map((card) => ({
      ...card,
      color: isCardColor(card.color) ? card.color : 'plain',
      lines: Array.isArray(card.lines) ? card.lines : [],
    })),
    edges: raw.edges.map((edge, index) => ({
      ...edge,
      id: edge.id || `e-${index}`,
      shape: edge.shape === 'ortho' ? 'ortho' : 'curve',
      direction: edge.direction === 'both' || edge.direction === 'one' ? edge.direction : 'none',
      fromSide: edge.fromSide ?? 'r',
      toSide: edge.toSide ?? 'l',
    })),
  };
}
