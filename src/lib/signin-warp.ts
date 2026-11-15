/**
 * The sign-in warp: one timeline, no library.
 *
 * Every position here is a pure function of elapsed milliseconds, so the canvas
 * loop only asks "where is the comet now" instead of keeping state of its own —
 * and the curve can be tested without a browser.
 *
 * Storyboard (LOGIN-PLAN §13):
 *   0ms      quote dissolves into stars
 *   380ms    the black panel becomes the page
 *   880ms    the comet is put on screen, flying in from the left
 *   1760ms   the camera starts closing in; stars stretch
 *   2430ms   white flood
 *   3000ms   hand over to onboarding
 */
export const WARP = {
  starSpawn: 520,
  starTravel: 640,
  sheetCollapse: 900,
  cometIn: 880,
  cometInEnd: 1760,
  approachEnd: 2460,
  flashStart: 2430,
  flashEnd: 2890,
  done: 3000,
} as const;

export type WarpViewport = { width: number; height: number };

export type CometState = {
  visible: boolean;
  x: number;
  y: number;
  radius: number;
  /** Tail length multiplier: 0.25 when it enters, ~2.4 at closest approach. */
  tail: number;
};

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/**
 * Where the comet is at `elapsed` ms.
 *
 * Leg one: it leaves from the centre, where the sheet just collapsed, and
 * shoots off to the right — the "flying" beat. Leg two: it is pulled back into
 * the middle of the frame while it grows, which reads as the camera catching
 * up and closing in.
 */
export function cometState(elapsed: number, viewport: WarpViewport): CometState {
  const { width, height } = viewport;

  if (elapsed < WARP.cometIn) {
    return { visible: false, x: 0, y: 0, radius: 0, tail: 0 };
  }

  if (elapsed < WARP.cometInEnd) {
    const t = easeOutCubic((elapsed - WARP.cometIn) / (WARP.cometInEnd - WARP.cometIn));
    return {
      visible: true,
      x: lerp(width * 0.5, width * 0.84, t),
      y: lerp(height * 0.5, height * 0.42, t),
      radius: lerp(5, 9, t),
      tail: lerp(0.3, 1, t),
    };
  }

  const t = easeOutCubic((elapsed - WARP.cometInEnd) / (WARP.approachEnd - WARP.cometInEnd));
  return {
    visible: true,
    x: lerp(width * 0.84, width * 0.5, t),
    y: lerp(height * 0.42, height * 0.5, t),
    radius: lerp(9, 74, t),
    tail: lerp(1, 2.4, t),
  };
}

/** -1 until the star exists, then 0 → 1 across its flight. */
export function starProgress(spawnAt: number, elapsed: number, travel = WARP.starTravel): number {
  if (elapsed <= spawnAt) return -1;
  return Math.min(1, (elapsed - spawnAt) / travel);
}

/** 0 → 1 across the white flood, and 1 afterwards. */
export function flashOpacity(elapsed: number): number {
  if (elapsed <= WARP.flashStart) return 0;
  if (elapsed >= WARP.flashEnd) return 1;
  return (elapsed - WARP.flashStart) / (WARP.flashEnd - WARP.flashStart);
}
