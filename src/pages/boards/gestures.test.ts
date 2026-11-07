import { describe, expect, it } from 'vitest';
import {
  alignRects,
  boundingRect,
  cardsInRect,
  clampRect,
  createCardAt,
  createSectionAt,
  distributeRects,
  growSection,
  rectFromPoints,
  resizeRect,
  scenePoint,
  sectionForCard,
  sideAtPoint,
  snapMove,
} from './gestures';
import {
  CARD_MIN_H,
  CARD_MIN_W,
  SCENE_H,
  SCENE_W,
  type Rect,
  type SceneCard,
  type SceneSection,
} from './scene';

function card(id: string, x: number, y: number, w = 200, h = 96): SceneCard {
  return { id, sectionId: 's-1', x, y, w, h, title: id, eyebrow: 'CARD', lines: [], color: 'plain' };
}

function section(id: string, x: number, y: number, w = 300, h = 400): SceneSection {
  return { id, title: id, color: 'stone', x, y, w, h };
}

const h = (c: SceneCard) => c.h;

describe('scenePoint', () => {
  it('divides by the zoom the scene element is drawn at', () => {
    expect(scenePoint(110, 60, { left: 10, top: 10 }, 1)).toEqual({ x: 100, y: 50 });
    expect(scenePoint(110, 60, { left: 10, top: 10 }, 2)).toEqual({ x: 50, y: 25 });
    expect(scenePoint(110, 60, { left: 10, top: 10 }, 0.5)).toEqual({ x: 200, y: 100 });
  });

  it('never divides by zero when the scene is not measured yet', () => {
    expect(scenePoint(40, 40, { left: 0, top: 0 }, 0)).toEqual({ x: 40, y: 40 });
  });
});

describe('rect helpers', () => {
  it('normalises a marquee dragged in any direction', () => {
    expect(rectFromPoints({ x: 100, y: 80 }, { x: 40, y: 20 })).toEqual({ x: 40, y: 20, w: 60, h: 60 });
  });

  it('selects only cards the marquee really overlaps', () => {
    const cards = [card('a', 0, 0), card('b', 300, 300)];
    expect(cardsInRect(cards, { x: 10, y: 10, w: 100, h: 100 }, h)).toEqual(['a']);
    // Touching the edge is not overlapping.
    expect(cardsInRect(cards, { x: 200, y: 0, w: 100, h: 96 }, h)).toEqual([]);
  });

  it('builds the bounding box of a mixed selection', () => {
    expect(
      boundingRect([
        { x: 10, y: 20, w: 100, h: 50 },
        { x: 200, y: 0, w: 50, h: 300 },
      ]),
    ).toEqual({ x: 10, y: 0, w: 240, h: 300 });
  });
});

describe('snapMove', () => {
  const neighbour: Rect = { x: 300, y: 100, w: 200, h: 96 };

  it('aligns the left edges when the drop is 4px away', () => {
    const result = snapMove({ x: 304, y: 400, w: 200, h: 96 }, [neighbour]);
    expect(result.dx).toBe(-4);
    expect(result.guides).toMatchObject([{ axis: 'x', pos: 300 }]);
  });

  it('picks the closest of several candidates on one axis', () => {
    const result = snapMove({ x: 497, y: 400, w: 200, h: 96 }, [neighbour]);
    // left edge 497 → the neighbour's right edge (500) is 3px away; the centre
    // (597) and right (697) have no target within the threshold.
    expect(result.dx).toBe(3);
    expect(result.guides[0]?.pos).toBe(500);
  });

  it('does nothing beyond the threshold', () => {
    const result = snapMove({ x: 312, y: 400, w: 200, h: 96 }, [neighbour]);
    expect(result).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('snaps both axes independently and spans both objects with the guide', () => {
    const result = snapMove({ x: 302, y: 198, w: 200, h: 96 }, [neighbour]);
    expect(result.dx).toBe(-2);
    expect(result.dy).toBe(-2);
    const vertical = result.guides.find((guide) => guide.axis === 'x');
    expect(vertical).toMatchObject({ pos: 300 });
    // the guide reaches from the neighbour to the moving box, not just a stub
    expect(vertical!.from).toBeLessThanOrEqual(100);
    // dashed line reaches the bottom of the moving box (196 + 96)
    expect(vertical!.to).toBeGreaterThanOrEqual(292);
  });

  it('has nothing to align to on an empty board', () => {
    expect(snapMove({ x: 10, y: 10, w: 10, h: 10 }, [])).toEqual({ dx: 0, dy: 0, guides: [] });
  });
});

describe('bounds', () => {
  it('keeps an object inside the workspace without resizing it', () => {
    const r = clampRect({ x: -40, y: 900, w: 200, h: 96 });
    expect(r.x).toBe(8);
    expect(r.y).toBe(900);
    expect(r.w).toBe(200);
    const far = clampRect({ x: 40, y: SCENE_H + 100, w: 200, h: 96 });
    expect(far.y).toBe(SCENE_H - 96 - 8);
  });

  it('refuses to resize below the minimum card, from any handle', () => {
    const small = resizeRect({ x: 0, y: 0, w: 200, h: 96 }, 'se', -400, -400);
    expect(small.w).toBe(CARD_MIN_W);
    expect(small.h).toBe(CARD_MIN_H);
  });

  it('stops at the workspace edge while there is room for the minimum', () => {
    const big = resizeRect({ x: 400, y: 100, w: 200, h: 96 }, 'se', 9000, 9000);
    expect(big.w).toBe(SCENE_W - 400 - 8);
    expect(big.h).toBe(SCENE_H - 100 - 8);
  });

  it('moves the origin when a north or west handle is dragged', () => {
    const west = resizeRect({ x: 400, y: 300, w: 200, h: 96 }, 'w', -60, 0);
    expect(west).toMatchObject({ x: 340, w: 260, y: 300 });
    const north = resizeRect({ x: 400, y: 300, w: 200, h: 96 }, 'n', 0, -40);
    expect(north).toMatchObject({ y: 260, h: 136 });
  });

  it('keeps the opposite edge pinned when the minimum is reached', () => {
    const west = resizeRect({ x: 400, y: 300, w: 200, h: 96 }, 'w', 400, 0);
    expect(west.w).toBe(CARD_MIN_W);
    expect(west.x + west.w).toBe(600);
  });
});

describe('sections', () => {
  it('creates a card inside the section it lands in', () => {
    const created = createCardAt({ x: 40, y: 40 }, 'c-1', [section('s-q', 0, 0)]);
    expect(created).toMatchObject({ id: 'c-1', sectionId: 's-q', x: 40, y: 40, title: '', color: 'plain' });
  });

  it('creates an unassigned card outside every section', () => {
    expect(createCardAt({ x: 900, y: 700 }, 'c-2', [section('s-q', 0, 0)]).sectionId).toBe('');
  });

  it('assigns by the card centre, so a card straddling the border belongs to one section', () => {
    const sections = [section('s-1', 0, 0, 300, 400), section('s-2', 320, 0, 300, 400)];
    // centre 250 → s-1, even though the card's right edge is inside the gap
    expect(sectionForCard(sections, { x: 200, y: 40, w: 100, h: 80 })).toBe('s-1');
    // centre 330 → s-2, even though the card starts inside s-1
    expect(sectionForCard(sections, { x: 280, y: 40, w: 100, h: 80 })).toBe('s-2');
  });

  it('grows to contain its members and never shrinks', () => {
    const grown = growSection({ x: 0, y: 0, w: 300, h: 200 }, [{ x: 100, y: 100, w: 250, h: 300 }]);
    expect(grown.w).toBe(366);
    expect(grown.h).toBe(416);
    const untouched = growSection({ x: 0, y: 0, w: 300, h: 200 }, []);
    expect(untouched).toEqual({ x: 0, y: 0, w: 300, h: 200 });
  });

  it('places a new section at the click with room to grow', () => {
    const created = createSectionAt({ x: 200, y: 160 }, 's-new');
    expect(created).toMatchObject({ id: 's-new', x: 200, y: 160, w: 320, h: 240 });
  });
});

describe('align and distribute', () => {
  const rects: Rect[] = [
    { x: 0, y: 0, w: 100, h: 40 },
    { x: 140, y: 60, w: 60, h: 80 },
    { x: 300, y: 20, w: 80, h: 40 },
  ];

  it('aligns left, centre and right without changing sizes', () => {
    expect(alignRects(rects, 'left').map((r) => r.x)).toEqual([0, 0, 0]);
    expect(alignRects(rects, 'right').map((r) => r.x + r.w)).toEqual([380, 380, 380]);
    const centred = alignRects(rects, 'centerH');
    expect(centred.map((r) => r.x + r.w / 2)).toEqual([190, 190, 190]);
    expect(alignRects(rects, 'left').map((r) => r.w)).toEqual([100, 60, 80]);
  });

  it('aligns top, centre and bottom vertically', () => {
    expect(alignRects(rects, 'top').map((r) => r.y)).toEqual([0, 0, 0]);
    expect(alignRects(rects, 'bottom').map((r) => r.y + r.h)).toEqual([140, 140, 140]);
  });

  it('leaves a single object alone', () => {
    expect(alignRects([rects[0]!], 'left')).toEqual([rects[0]!]);
  });

  it('spaces three objects with equal gaps', () => {
    const result = distributeRects(rects, 'h');
    const sorted = [...result.rects].sort((a, b) => a.x - b.x);
    const gapA = (sorted[1]?.x ?? 0) - ((sorted[0]?.x ?? 0) + (sorted[0]?.w ?? 0));
    const gapB = (sorted[2]?.x ?? 0) - ((sorted[1]?.x ?? 0) + (sorted[1]?.w ?? 0));
    expect(gapA).toBeCloseTo(gapB, 5);
    expect(result.gap).toBeGreaterThan(0);
  });

  it('refuses to distribute when the objects do not fit', () => {
    const tight: Rect[] = [
      { x: 0, y: 0, w: 100, h: 40 },
      { x: 100, y: 0, w: 100, h: 40 },
      { x: 200, y: 0, w: 100, h: 40 },
    ];
    expect(distributeRects(tight, 'h').gap).toBe(0);
  });
});

describe('anchor hit testing', () => {
  const box: Rect = { x: 100, y: 100, w: 200, h: 100 };

  it('finds the side a point is nearest to', () => {
    expect(sideAtPoint(box, { x: 98, y: 150 }, 10)).toBe('l');
    expect(sideAtPoint(box, { x: 302, y: 150 }, 10)).toBe('r');
    expect(sideAtPoint(box, { x: 200, y: 98 }, 10)).toBe('t');
    expect(sideAtPoint(box, { x: 200, y: 202 }, 10)).toBe('b');
  });

  it('ignores points far from any edge', () => {
    expect(sideAtPoint(box, { x: 200, y: 150 }, 10)).toBeNull();
    expect(sideAtPoint(box, { x: 600, y: 600 }, 10)).toBeNull();
  });
});
