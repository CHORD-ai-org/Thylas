import { describe, expect, it } from 'vitest';
import { BOARDS } from '../../data/mock';
import {
  MAX_SCALE,
  MIN_SCALE,
  SCENE_H,
  SCENE_W,
  anchorOf,
  clampScale,
  contentBounds,
  edgeArrowPoints,
  edgeMid,
  edgePath,
  estimateCardHeight,
  fitViewport,
  panBy,
  readScene,
  readSceneV1,
  rectsIntersect,
  sceneFromBoard,
  sceneVars,
  wheelZoom,
  zoomAt,
  type Rect,
  type SceneCard,
  type SceneSection,
} from './scene';

const rect = (x: number, y: number, w = 100, h = 60): Rect => ({ x, y, w, h });

function section(id: string, x: number, y: number, w = 300, h = 400): SceneSection {
  return { id, title: id, color: 'stone', x, y, w, h };
}

function card(id: string, x: number, y: number, lines: string[] = []): SceneCard {
  return { id, sectionId: '', x, y, w: 264, h: 0, title: id, eyebrow: 'CARD', lines, color: 'plain' };
}

describe('fitViewport', () => {
  it('fits the content, not the whole 2400 × 1600 workspace', () => {
    const bounds = rect(80, 120, 1368, 600);
    const view = fitViewport(bounds, 900, 560);
    const expected = Math.min(1, (900 - 96) / 1368, (560 - 96) / 600);
    expect(view.zoom).toBeCloseTo(expected, 5);
    // the content is centred: equal margins on both sides
    const left = bounds.x * view.zoom + view.x;
    const right = 900 - ((bounds.x + bounds.w) * view.zoom + view.x);
    expect(left).toBeCloseTo(right, 5);
  });

  it('never magnifies above 100%', () => {
    expect(fitViewport(rect(0, 0, 100, 80), 4000, 3000).zoom).toBe(1);
  });

  it('clamps an empty area instead of producing an invalid transform', () => {
    expect(fitViewport(rect(0, 0, 10, 10), 0, 0).zoom).toBe(MIN_SCALE);
  });
});

describe('clampScale', () => {
  it('keeps zoom inside the 10–400% range and rejects non-finite values', () => {
    expect(clampScale(0.001)).toBe(MIN_SCALE);
    expect(clampScale(99)).toBe(MAX_SCALE);
    expect(clampScale(Number.NaN)).toBe(1);
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('contentBounds', () => {
  it('covers cards and the capsules that sit above their sections', () => {
    const bounds = contentBounds({
      sections: [section('s-1', 80, 120, 300, 400)],
      cards: [card('c-1', 96, 160), card('c-2', 96, 700)],
    });
    expect(bounds.x).toBe(80);
    // the capsule is 30 units above the section frame
    expect(bounds.y).toBe(90);
    expect(bounds.w).toBe(300);
    expect(bounds.h).toBe(700 + estimateCardHeight(card('c-2', 0, 0)) - 90);
  });

  it('returns a frame for an empty board instead of infinities', () => {
    const bounds = contentBounds({ sections: [], cards: [] });
    expect(bounds).toEqual({ x: 0, y: 0, w: SCENE_W, h: SCENE_H });
  });
});

describe('estimateCardHeight', () => {
  it('grows with each line and each footer row', () => {
    const bare = estimateCardHeight({ title: 'x', lines: [] });
    const oneLine = estimateCardHeight({ title: 'x', lines: ['a'] });
    const withRef = estimateCardHeight({ title: 'x', lines: ['a'], ref: 'f.pdf' });
    expect(oneLine).toBeGreaterThan(bare);
    expect(withRef).toBeGreaterThan(oneLine);
  });

  it('a folded card is exactly one row tall', () => {
    expect(estimateCardHeight({ title: 'x', lines: ['a', 'b'], folded: true })).toBe(44);
  });
});

describe('anchors and edges', () => {
  it('puts the four anchors on the sides, not in the corners', () => {
    expect(anchorOf(rect(10, 20, 100, 60), 't')).toEqual({ x: 60, y: 20 });
    expect(anchorOf(rect(10, 20, 100, 60), 'r')).toEqual({ x: 110, y: 50 });
    expect(anchorOf(rect(10, 20, 100, 60), 'b')).toEqual({ x: 60, y: 80 });
    expect(anchorOf(rect(10, 20, 100, 60), 'l')).toEqual({ x: 10, y: 50 });
  });

  it('leaves each anchor along its own normal, so the line never cuts through the card', () => {
    const d = edgePath({ x: 0, y: 0 }, { x: 200, y: 120 }, 'r', 'l', 'curve');
    // first control point must sit to the right of the start
    const c1 = d.match(/C ([\d.-]+) ([\d.-]+)/);
    expect(Number(c1?.[1])).toBeGreaterThan(0);
    expect(Number(c1?.[2])).toBeCloseTo(0, 5);
  });

  it('draws an elbow in three straight segments when asked', () => {
    const d = edgePath({ x: 0, y: 0 }, { x: 200, y: 120 }, 'r', 'l', 'ortho');
    expect(d).toContain('L 100 0');
    expect(d.match(/L/g)).toHaveLength(3);
  });

  it('reports the midpoint of the curve for the label chip', () => {
    const mid = edgeMid({ x: 0, y: 0 }, { x: 200, y: 100 }, 'r', 'l');
    expect(mid.x).toBeCloseTo(100, 0);
    expect(mid.y).toBeGreaterThan(0);
    expect(mid.y).toBeLessThan(100);
  });

  it('points the arrowhead back along the curve, not along the canvas axis', () => {
    const head = edgeArrowPoints({ x: 0, y: 0 }, { x: 0, y: 200 }, 'r', 't');
    expect(head.tip).toEqual({ x: 0, y: 200 });
    expect(head.left.y).toBeLessThan(200);
    expect(head.right.y).toBeLessThan(200);
  });
});

describe('rectsIntersect', () => {
  it('detects overlap but not edge contact', () => {
    expect(rectsIntersect(rect(0, 0), rect(50, 30))).toBe(true);
    expect(rectsIntersect(rect(0, 0), rect(100, 0))).toBe(false);
    expect(rectsIntersect(rect(0, 0), rect(0, 60))).toBe(false);
    expect(rectsIntersect(rect(0, 0), rect(200, 200))).toBe(false);
  });
});

describe('viewport maths', () => {
  it('pans without touching zoom', () => {
    const view = { x: 0, y: 0, zoom: 0.6 };
    expect(panBy(view, -30, 12)).toEqual({ x: -30, y: 12, zoom: 0.6 });
  });

  it('keeps the scene point under the pointer fixed across a zoom change', () => {
    const view = { x: 20, y: 30, zoom: 1 };
    const pointer = { x: 200, y: 150 };
    const before = { x: (pointer.x - view.x) / view.zoom, y: (pointer.y - view.y) / view.zoom };
    const next = zoomAt(view, 2, pointer);
    expect((pointer.x - next.x) / next.zoom).toBeCloseTo(before.x, 6);
    expect((pointer.y - next.y) / next.zoom).toBeCloseTo(before.y, 6);
    expect(zoomAt(next, 1, pointer)).toEqual(view);
  });

  it('clamps zoom to 10–400%', () => {
    const p = { x: 0, y: 0 };
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, 100, p).zoom).toBe(MAX_SCALE);
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, 0.00001, p).zoom).toBe(MIN_SCALE);
  });

  it('accumulates 30 wheel gestures into 30 distinct steps, not one', () => {
    let view = { x: 0, y: 0, zoom: 1 };
    const values: number[] = [];
    for (let i = 0; i < 30; i++) {
      view = wheelZoom(view, -20, { x: 300, y: 200 });
      values.push(view.zoom);
    }
    expect(new Set(values).size).toBe(30);
    expect(view.zoom).toBeCloseTo(Math.exp(30 * 20 * 0.0015), 6);
    // the buggy closure-based version would have produced a single step
    expect(view.zoom).not.toBeCloseTo(Math.exp(20 * 0.0015), 2);
  });

  it('survives a long zoom-out without leaving the clamp range', () => {
    let view = { x: 0, y: 0, zoom: 1 };
    for (let i = 0; i < 200; i++) view = wheelZoom(view, 100, { x: 0, y: 0 });
    expect(view.zoom).toBe(MIN_SCALE);
  });
});

describe('scene constants', () => {
  it('exposes the size through CSS variables so no stylesheet repeats a number', () => {
    expect(sceneVars()).toEqual({
      '--scene-w': `${SCENE_W}px`,
      '--scene-h': `${SCENE_H}px`,
      '--scene-grid': '16px',
    });
  });

  it('is a workspace, not a poster', () => {
    expect(SCENE_W).toBeGreaterThan(2000);
    expect(SCENE_H).toBeGreaterThan(1200);
  });
});

describe('sceneFromBoard (mock migration)', () => {
  const legacy = BOARDS[0]!;

  it('produces a v2 scene with the same sections, cards and edges', () => {
    const scene = sceneFromBoard(legacy);
    expect(scene.version).toBe(2);
    expect(scene.id).toBe(legacy.id);
    expect(scene.name).toBe(legacy.name);
    expect(scene.sections).toHaveLength(legacy.sections.length);
    expect(scene.cards).toHaveLength(legacy.boardCards.length);
    expect(scene.edges).toHaveLength(legacy.edges.length);
  });

  it('leaves the height to the content, without mutating the sample', () => {
    const scene = sceneFromBoard(legacy);
    expect(scene.cards.every((c) => c.h === 0)).toBe(true);
    expect('h' in legacy.boardCards[0]!).toBe(false);
    expect(scene.sections[0]).not.toBe(legacy.sections[0]);
  });

  it('carries the colours and the edge sides the sample declares', () => {
    const scene = sceneFromBoard(legacy);
    expect(scene.cards.find((c) => c.id === 'c-1')?.color).toBe('clay');
    expect(scene.cards.find((c) => c.id === 'c-11')?.folded).toBe(true);
    const ortho = scene.edges.find((edge) => edge.shape === 'ortho');
    expect(ortho).toMatchObject({ fromSide: 'b', toSide: 'b', direction: 'both' });
  });

  it('migrates all sample boards', () => {
    for (const board of BOARDS) {
      expect(sceneFromBoard(board).version).toBe(2);
    }
  });
});

describe('stored scene validation', () => {
  const scene = sceneFromBoard(BOARDS[0]!);

  it('round-trips a v2 scene', () => {
    expect(readScene(JSON.parse(JSON.stringify(scene)))).toMatchObject({ id: scene.id, version: 2 });
  });

  it('rejects a card without coordinates rather than half-rendering it', () => {
    const broken = { ...scene, cards: [{ id: 'x', y: 2 }] };
    expect(readScene(broken)).toBeNull();
  });

  it('repairs an unknown colour instead of dropping the card', () => {
    const odd = { ...scene, cards: [{ ...scene.cards[0], color: 'chartreuse' }] };
    expect(readScene(odd)?.cards[0]?.color).toBe('plain');
  });

  it('reads a v1 scene and upgrades it, so nobody loses a board to a schema move', () => {
    const v1 = {
      version: 1,
      id: 'b-1',
      name: 'old',
      updated: 'yesterday',
      sections: [{ id: 's', title: 'S', tint: 'rgba(94, 107, 80, .05)', x: 0, y: 0, w: 300, h: 300 }],
      cards: [{ id: 'c', sectionId: 's', x: 8, y: 8, w: 200, h: 0, title: 't', eyebrow: 'CARD', lines: [] }],
      edges: [{ from: 'c', to: 'c', label: 'self' }],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const migrated = readSceneV1(v1);
    expect(migrated?.version).toBe(2);
    expect(migrated?.sections[0]?.color).toBe('sage');
    expect(migrated?.cards[0]?.color).toBe('plain');
    expect(migrated?.edges[0]).toMatchObject({ fromSide: 'r', toSide: 'l', shape: 'curve' });
  });

  it('refuses a version it does not know', () => {
    expect(readScene({ ...scene, version: 9 })).toBeNull();
    expect(readSceneV1({ version: 2 })).toBeNull();
  });
});
