import { describe, expect, it } from 'vitest';
import { STAR_SEED, createStars, starCount, starPoint, type Star } from './starfield';

const VIEWPORT = { width: 1440, height: 900 };

describe('starfield', () => {
  it('is deterministic for the same seed and viewport', () => {
    expect(createStars(VIEWPORT)).toEqual(createStars(VIEWPORT));
    expect(createStars(VIEWPORT, 'other')).not.toEqual(createStars(VIEWPORT, STAR_SEED));
  });

  it('keeps the count in a calm range', () => {
    expect(starCount({ width: 390, height: 844 })).toBeGreaterThanOrEqual(90);
    expect(starCount({ width: 3840, height: 2160 })).toBeLessThanOrEqual(220);
    expect(createStars(VIEWPORT)).toHaveLength(starCount(VIEWPORT));
  });

  it('wraps lateral drift instead of letting stars leave the frame', () => {
    const star: Star = { x: 2, y: 300, size: 1, alpha: 0.5, drift: 0.01, phase: 0 };
    const point = starPoint(star, 1000, VIEWPORT);
    expect(point.x).toBeCloseTo(VIEWPORT.width - 8, 5);
    expect(point.x).toBeGreaterThanOrEqual(0);
    expect(point.x).toBeLessThan(VIEWPORT.width);
  });

  it('keeps alpha within the star\'s own range while breathing', () => {
    const star: Star = { x: 20, y: 20, size: 1, alpha: 0.5, drift: 0, phase: 0 };
    for (let t = 0; t < 8000; t += 250) {
      const point = starPoint(star, t, VIEWPORT);
      expect(point.alpha).toBeGreaterThan(0);
      expect(point.alpha).toBeLessThanOrEqual(star.alpha);
    }
  });
});
