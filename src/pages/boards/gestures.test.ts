import { describe, expect, it } from 'vitest';
import {
  boundingRect,
  cardsInRect,
  clampRect,
  createCardAt,
  hitTest,
  rectFromPoints,
  resizeRect,
  scenePoint,
  snapMove,
} from './gestures';
import { CARD_MIN_W, SCENE_H, SCENE_W, type Rect, type SceneCard } from './scene';

function card(id: string, x: number, y: number, w = 200, h = 96): SceneCard {
  return { id, sectionId: 's-1', x, y, w, h, title: id, eyebrow: 'CARD', lines: [] };
}

const h = (c: SceneCard) => c.h;

describe('scenePoint', () => {
  it('divides by the combined fit × zoom scale', () => {
    expect(scenePoint(110, 60, { left: 10, top: 10 }, 1)).toEqual({ x: 100, y: 50 });
    expect(scenePoint(110, 60, { left: 10, top: 10 }, 2)).toEqual({ x: 50, y: 25 });
    expect(scenePoint(110, 60, { left: 10, top: 10 }, 0.5)).toEqual({ x: 200, y: 100 });
  });

  it('never divides by zero when the origin is not measured yet', () => {
    expect(scenePoint(40, 40, { left: 0, top: 0 }, 0)).toEqual({ x: 40, y: 40 });
  });
});

describe('hitTest', () => {
  const cards = [card('under', 0, 0), card('over', 100, 40)];

  it('returns the topmost card, which is the last one painted', () => {
    expect(hitTest(cards, { x: 120, y: 60 }, h)?.id).toBe('over');
    expect(hitTest(cards, { x: 20, y: 20 }, h)?.id).toBe('under');
  });

  it('treats the border as inside and the space beyond as outside', () => {
    expect(hitTest(cards, { x: 100, y: 40 }, h)?.id).toBe('over');
    expect(hitTest(cards, { x: 500, y: 500 }, h)).toBeNull();
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

  it('builds the bounding box of a multi-selection', () => {
    expect(boundingRect([
      { x: 10, y: 20, w: 100, h: 50 },
      { x: 200, y: 0, w: 50, h: 300 },
    ])).toEqual({ x: 10, y: 0, w: 240, h: 300 });
  });
});

describe('snapMove', () => {
  const neighbour: Rect = { x: 300, y: 100, w: 200, h: 96 };

  it('aligns the left edges when the drop is 4px away', () => {
    const result = snapMove({ x: 304, y: 400, w: 200, h: 96 }, [neighbour]);
    expect(result.dx).toBe(-4);
    expect(result.x).toBe(300);
  });

  it('picks the closest of several candidates on one axis', () => {
    const result = snapMove({ x: 497, y: 400, w: 200, h: 96 }, [neighbour]);
    // right edge 697 → 500 is the neighbour's right edge; 3px away.
    expect(result.dx).toBe(3);
    expect(result.x).toBe(500);
  });

  it('does nothing beyond the threshold', () => {
    const result = snapMove({ x: 312, y: 400, w: 200, h: 96 }, [neighbour]);
    expect(result).toEqual({ dx: 0, dy: 0, x: null, y: null });
  });

  it('snaps both axes independently', () => {
    const result = snapMove({ x: 302, y: 198, w: 200, h: 96 }, [neighbour]);
    expect(result.dx).toBe(-2);
    expect(result.dy).toBe(-2);
    expect(result.y).toBe(196);
  });

  it('has nothing to align to on an empty board', () => {
    expect(snapMove({ x: 10, y: 10, w: 10, h: 10 }, [])).toEqual({ dx: 0, dy: 0, x: null, y: null });
  });
});

describe('bounds', () => {
  it('keeps a card inside the scene without resizing it', () => {
    const r = clampRect({ x: -40, y: 900, w: 200, h: 96 });
    expect(r.x).toBe(8);
    expect(r.y).toBe(SCENE_H - 96 - 8);
    expect(r.w).toBe(200);
  });

  it('refuses to resize below the minimum card', () => {
    const size = resizeRect({ x: 0, y: 0, w: 200, h: 96 }, -400, -400);
    expect(size.w).toBe(CARD_MIN_W);
    expect(size.h).toBe(64);
  });

  it('stops at the scene edge while there is room for the minimum card', () => {
    const size = resizeRect({ x: 400, y: 100, w: 200, h: 96 }, 2000, 2000);
    expect(size.w).toBe(SCENE_W - 400 - 8);
    expect(size.h).toBe(SCENE_H - 100 - 8);
  });

  it('keeps a usable width even when the scene edge is nearer than the minimum', () => {
    const size = resizeRect({ x: 900, y: 500, w: 100, h: 40 }, 900, 900);
    expect(size.w).toBe(CARD_MIN_W);
  });
});

describe('createCardAt', () => {
  const sections = [{ id: 's-q', x: 0, y: 0, w: 300, h: 300 }];

  it('joins the section under the click and starts with an empty title', () => {
    const created = createCardAt({ x: 40, y: 40 }, 'c-1', sections);
    expect(created).toMatchObject({ id: 'c-1', sectionId: 's-q', x: 40, y: 40, title: '', eyebrow: 'CARD' });
  });

  it('lands outside every section without failing', () => {
    expect(createCardAt({ x: 500, y: 400 }, 'c-2', sections).sectionId).toBe('');
  });

  it('joins the section the clamped card lands in', () => {
    const created = createCardAt({ x: 100, y: 900 }, 'c-4', sections);
    expect(created.sectionId).toBe('');
    expect(created.y).toBeLessThanOrEqual(900);
  });

  it('shifts a click near the right edge back inside the scene', () => {
    const created = createCardAt({ x: SCENE_W - 2, y: 40 }, 'c-3', []);
    expect(created.x + created.w).toBeLessThanOrEqual(SCENE_W);
  });
});
