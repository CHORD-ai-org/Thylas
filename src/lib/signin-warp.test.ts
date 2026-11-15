import { describe, expect, it } from 'vitest';
import { WARP, cometState, easeOutCubic, flashOpacity, starProgress } from './signin-warp';

const viewport = { width: 1440, height: 900 };

describe('comet path', () => {
  it('is not on screen before it enters', () => {
    expect(cometState(0, viewport).visible).toBe(false);
    expect(cometState(WARP.cometIn - 1, viewport).visible).toBe(false);
  });

  it('leaves from the centre, where the sheet collapsed, and shoots right', () => {
    const start = cometState(WARP.cometIn, viewport);
    expect(start.visible).toBe(true);
    expect(Math.round(start.x)).toBe(720);
    expect(Math.round(start.y)).toBe(450);

    const end = cometState(WARP.cometInEnd, viewport);
    expect(end.x).toBeGreaterThan(viewport.width * 0.75);
  });

  it('is pulled to the centre and grows while the camera closes in', () => {
    const end = cometState(WARP.approachEnd, viewport);
    expect(Math.round(end.x)).toBe(720);
    expect(Math.round(end.y)).toBe(450);
    expect(end.radius).toBeGreaterThan(40);
    expect(end.tail).toBeGreaterThan(2);
    expect(cometState(WARP.cometInEnd, viewport).radius).toBeLessThan(end.radius);
  });
});

describe('stars', () => {
  it('do not exist before their spawn time', () => {
    expect(starProgress(200, 100)).toBe(-1);
    expect(starProgress(200, 200)).toBe(-1);
  });

  it('travel from 0 to 1 and stop there', () => {
    expect(starProgress(0, 0)).toBe(-1);
    expect(starProgress(0, WARP.starTravel / 2)).toBeCloseTo(0.5, 5);
    expect(starProgress(0, WARP.starTravel * 4)).toBe(1);
  });
});

describe('flash', () => {
  it('holds black, floods to white, then stays white', () => {
    expect(flashOpacity(0)).toBe(0);
    expect(flashOpacity(WARP.flashStart)).toBe(0);
    expect(flashOpacity((WARP.flashStart + WARP.flashEnd) / 2)).toBeCloseTo(0.5, 5);
    expect(flashOpacity(WARP.flashEnd)).toBe(1);
    expect(flashOpacity(WARP.done)).toBe(1);
  });
});

describe('easing', () => {
  it('clamps outside 0..1 and finishes at 1', () => {
    expect(easeOutCubic(-2)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(4)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
