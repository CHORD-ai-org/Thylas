import { describe, expect, it } from 'vitest';
import {
  hashSeed,
  mulberry32,
  paperShape,
  polygonPath,
  sketchHLine,
  sketchPath,
  sketchPolygon,
  sketchRect,
} from './sketch';

const numbers = (d: string): number[] => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('seeded jitter', () => {
  it('draws the same line for the same seed, every time', () => {
    const a = sketchRect(300, 356, 'paper');
    const b = sketchRect(300, 356, 'paper');
    expect(a).toBe(b);
  });

  it('draws a different line for a different seed', () => {
    expect(sketchRect(300, 356, 'paper')).not.toBe(sketchRect(300, 356, 'paper-2'));
  });

  it('hashes seeds into unsigned 32-bit values', () => {
    for (const seed of ['', 'a', 'paper', 'paper-2']) {
      const hash = hashSeed(seed);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(2 ** 32);
    }
  });

  it('keeps the first draw of the stream in [0, 1)', () => {
    for (const seed of ['x', 'y', 'z']) {
      const value = mulberry32(hashSeed(seed))();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('rect', () => {
  it('draws four separate edges so corners stay sharp', () => {
    const d = sketchRect(300, 356, 'paper');
    expect((d.match(/M /g) ?? []).length).toBe(4);
    expect(d.includes('Z')).toBe(false);
  });

  it('stays inside the canvas plus the wobble amplitude', () => {
    const width = 300;
    const height = 356;
    const amplitude = 0.8;
    const coords = numbers(sketchRect(width, height, 'paper', amplitude));
    expect(coords.some(Number.isNaN)).toBe(false);
    /* Edges overshoot their corners by 1.4× the amplitude — that is the
       drawn look, so the bound is the amplitude plus the overshoot. */
    const slack = amplitude * 1.4;
    for (const value of coords) {
      expect(value).toBeGreaterThanOrEqual(-slack);
      expect(value).toBeLessThanOrEqual(Math.max(width, height) + slack);
    }
  });

  it('handles a canvas smaller than the inset without producing NaN', () => {
    const d = sketchRect(4, 4, 'tiny');
    expect(d.includes('NaN')).toBe(false);
    expect(d.startsWith('M ')).toBe(true);
  });
});

describe('paper silhouette', () => {
  it('is not a rectangle: seven corners, and the top edge is not level', () => {
    const points = paperShape(424, 470);
    expect(points).toHaveLength(7);
    const ys = new Set(points.map((p) => p[1]));
    expect(ys.size).toBeGreaterThan(4);
  });

  it('stays inside the box it was given', () => {
    for (const [x, y] of paperShape(424, 470)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(424);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(470);
    }
  });

  it('closes the fill path and draws one subpath per edge', () => {
    const points = paperShape(424, 470);
    expect(polygonPath(points).endsWith(' Z')).toBe(true);
    expect((sketchPolygon(points, 'paper').match(/M /g) ?? []).length).toBe(points.length);
  });
});

describe('lines', () => {
  it('subdivides an edge into three interior points plus its ends', () => {
    const d = sketchPath([[0, 0], [100, 0]], 'edge');
    expect((d.match(/L /g) ?? []).length).toBe(4);
  });

  it('keeps an underline on its own row within the amplitude', () => {
    const d = sketchHLine(320, 3, 'underline', 0.6);
    const ys = numbers(d).filter((_, i) => i % 2 === 1);
    for (const y of ys) expect(Math.abs(y - 3)).toBeLessThanOrEqual(0.6);
  });
});
