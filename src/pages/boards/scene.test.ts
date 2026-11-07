import { describe, expect, it } from 'vitest';
import { BOARDS } from '../../data/mock';
import {
  ANCHOR_DOT,
  ANCHOR_HIT,
  CARD_DEFAULT_H,
  CARD_HEADER_CENTER,
  MAX_SCALE,
  MIN_SCALE,
  SCENE_H,
  SCENE_W,
  anchorDotSize,
  anchorHitSize,
  anchorPoints,
  cardCenter,
  clampScale,
  fitScale,
  fitViewport,
  panBy,
  rectsIntersect,
  sceneFromBoard,
  sceneVars,
  snap,
  wheelZoom,
  zoomAt,
  type Rect,
} from './scene';

const rect = (x: number, y: number, w = 100, h = 60): Rect => ({ x, y, w, h });

describe('fitScale', () => {
  it('fits the scene inside the area left by the floating chrome', () => {
    const w = 800;
    const h = 500;
    const expected = Math.min((w - 72) / SCENE_W, (h - 104) / SCENE_H);
    expect(fitScale(w, h)).toBeCloseTo(expected, 5);
    expect(fitScale(w, h)).toBeLessThan(1);
  });

  it('never magnifies above 100%', () => {
    expect(fitScale(4000, 3000)).toBe(1);
  });

  it('clamps a zero or negative area instead of producing an invalid transform', () => {
    expect(fitScale(0, 0)).toBe(MIN_SCALE);
    expect(fitScale(-20, 900)).toBe(MIN_SCALE);
    expect(fitScale(10, 10)).toBe(MIN_SCALE);
  });

  it('honours custom padding', () => {
    expect(fitScale(SCENE_W, SCENE_H, 0, 0)).toBe(1);
    expect(fitScale(SCENE_W / 2, SCENE_H / 2, 0, 0)).toBeCloseTo(0.5, 5);
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

describe('snap', () => {
  it('snaps at the threshold (inclusive), not beyond it', () => {
    expect(snap(106, [100])).toBe(100);
    expect(snap(106.01, [100])).toBe(106.01);
    expect(snap(94, [100])).toBe(100);
  });

  it('chooses the nearest target and leaves the value alone otherwise', () => {
    expect(snap(203, [100, 200, 300])).toBe(200);
    expect(snap(250, [100, 400])).toBe(250);
    expect(snap(250, [])).toBe(250);
  });
});

describe('anchors', () => {
  it('returns four axis-aligned points clockwise from the top', () => {
    const points = anchorPoints(rect(10, 20, 100, 60));
    expect(points).toEqual([
      { x: 60, y: 20 },
      { x: 110, y: 50 },
      { x: 60, y: 80 },
      { x: 10, y: 50 },
    ]);
  });

  it('keeps the hit area constant on screen at any zoom', () => {
    expect(anchorHitSize(0.25) * 0.25).toBe(ANCHOR_HIT);
    expect(anchorHitSize(4) * 4).toBe(ANCHOR_HIT);
    expect(anchorDotSize(0.25) * 0.25).toBe(ANCHOR_DOT);
    expect(anchorDotSize(4) * 4).toBe(ANCHOR_DOT);
  });

  it('places the edge attachment at the card header centre', () => {
    expect(cardCenter(rect(10, 20, 100, 60))).toEqual({ x: 60, y: 20 + CARD_HEADER_CENTER });
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

describe('viewport maths (SP-06b)', () => {
  it('starts neutral and pans without touching zoom', () => {
    expect(fitViewport()).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(panBy(fitViewport(), -30, 12)).toEqual({ x: -30, y: 12, zoom: 1 });
  });

  it('keeps the scene point under the pointer fixed across a zoom change', () => {
    const view = { x: 20, y: 30, zoom: 1 };
    const pointer = { x: 200, y: 150 };
    const scenePoint = {
      x: (pointer.x - view.x) / view.zoom,
      y: (pointer.y - view.y) / view.zoom,
    };
    const next = zoomAt(view, 2, pointer);
    expect((pointer.x - next.x) / next.zoom).toBeCloseTo(scenePoint.x, 6);
    expect((pointer.y - next.y) / next.zoom).toBeCloseTo(scenePoint.y, 6);
    // reversing the zoom returns to the original viewport
    expect(zoomAt(next, 1, pointer)).toEqual(view);
  });

  it('clamps zoom to 10–400%', () => {
    const p = { x: 0, y: 0 };
    expect(zoomAt(fitViewport(), 100, p).zoom).toBe(MAX_SCALE);
    expect(zoomAt(fitViewport(), 0.00001, p).zoom).toBe(MIN_SCALE);
  });

  it('accumulates 30 wheel gestures into 30 distinct steps, not one', () => {
    let view = fitViewport();
    const values: number[] = [];
    for (let i = 0; i < 30; i++) {
      view = wheelZoom(view, -20, { x: 300, y: 200 });
      values.push(view.zoom);
    }
    expect(new Set(values).size).toBe(30);
    expect(view.zoom).toBeGreaterThan(2);
    expect(view.zoom).toBeCloseTo(Math.exp(30 * 20 * 0.0015), 6);
    // the buggy closure-based version would have produced a single step
    expect(view.zoom).not.toBeCloseTo(Math.exp(20 * 0.0015), 2);
  });

  it('survives a long zoom-out without leaving the clamp range', () => {
    let view = fitViewport();
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
});

describe('sceneFromBoard (mock migration)', () => {
  const legacy = BOARDS[0]!;

  it('produces a v1 scene with the same sections, cards and edges', () => {
    const scene = sceneFromBoard(legacy);
    expect(scene.version).toBe(1);
    expect(scene.id).toBe(legacy.id);
    expect(scene.name).toBe(legacy.name);
    expect(scene.sections).toHaveLength(legacy.sections.length);
    expect(scene.cards).toHaveLength(legacy.boardCards.length);
    expect(scene.edges).toHaveLength(legacy.edges.length);
    expect(scene.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('gives every card a height for geometry without mutating the sample', () => {
    const scene = sceneFromBoard(legacy);
    expect(scene.cards.every((c) => c.h === CARD_DEFAULT_H)).toBe(true);
    expect('h' in legacy.boardCards[0]!).toBe(false);
    expect(scene.sections[0]).not.toBe(legacy.sections[0]);
  });

  it('migrates all sample boards', () => {
    for (const board of BOARDS) {
      expect(sceneFromBoard(board).version).toBe(1);
    }
  });
});
