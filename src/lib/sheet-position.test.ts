import { describe, expect, it } from 'vitest';
import {
  KEEP_VISIBLE,
  centerSheet,
  clampSheet,
  readSheetPosition,
  serializeSheetPosition,
} from './sheet-position';

const viewport = { width: 1200, height: 900 };
const sheet = { width: 420, height: 540 };

describe('clampSheet', () => {
  it('keeps a sliver of the sheet on screen in every direction', () => {
    const far = clampSheet({ x: -5000, y: -5000 }, viewport, sheet);
    expect(far.x).toBe(KEEP_VISIBLE - sheet.width);
    expect(far.y).toBe(KEEP_VISIBLE - sheet.height);

    const overflow = clampSheet({ x: 9000, y: 9000 }, viewport, sheet);
    expect(overflow.x).toBe(viewport.width - KEEP_VISIBLE);
    expect(overflow.y).toBe(viewport.height - KEEP_VISIBLE);
  });

  it('leaves a reachable position untouched', () => {
    expect(clampSheet({ x: 200, y: 120 }, viewport, sheet)).toEqual({ x: 200, y: 120 });
  });

  it('still returns a finite position when the viewport is smaller than the sheet', () => {
    const tiny = clampSheet({ x: 10, y: 10 }, { width: 300, height: 200 }, sheet);
    expect(Number.isFinite(tiny.x)).toBe(true);
    expect(Number.isFinite(tiny.y)).toBe(true);
  });
});

describe('centerSheet', () => {
  it('centres horizontally and sits slightly above the middle', () => {
    const position = centerSheet(viewport, sheet);
    expect(position.x).toBe(390);
    expect(position.y).toBeLessThan((viewport.height - sheet.height) / 2);
  });
});

describe('persisted position', () => {
  it('round-trips through storage', () => {
    expect(readSheetPosition(serializeSheetPosition({ x: 12.4, y: 99.6 }))).toEqual({ x: 12, y: 100 });
  });

  it('refuses anything that is not a pair of finite numbers', () => {
    for (const raw of [null, '', 'nope', '[]', '{}', '{"x":"1","y":2}', '{"x":null,"y":2}']) {
      expect(readSheetPosition(raw)).toBeNull();
    }
    expect(readSheetPosition('{"x":1e999,"y":0}')).toBeNull();
  });
});
