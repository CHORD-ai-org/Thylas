/**
 * The quiet starfield behind first-run onboarding.
 *
 * Pure positions only: the canvas loop asks where a star is at time t instead
 * of keeping any state. The same seed always draws the same sky, so screenshots
 * and a second visit agree.
 */
import { hashSeed, mulberry32 } from './sketch';

export type Star = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  drift: number;
  phase: number;
};

export type Viewport = { width: number; height: number };

export type StarPoint = { x: number; y: number; alpha: number };

export const STAR_SEED = 'thylas-onboarding-sky';

/** Stars per megapixel, capped so a large screen stays calm. */
export function starCount(viewport: Viewport): number {
  const area = Math.max(0, viewport.width * viewport.height);
  return Math.min(220, Math.max(90, Math.round(area / 7200)));
}

export function createStars(viewport: Viewport, seed = STAR_SEED): Star[] {
  const random = mulberry32(hashSeed(seed));
  return Array.from({ length: starCount(viewport) }, () => ({
    x: random() * viewport.width,
    y: random() * viewport.height,
    size: 0.45 + random() * 1.05,
    alpha: 0.18 + random() * 0.52,
    drift: 0.003 + random() * 0.009,
    phase: random() * Math.PI * 2,
  }));
}

const wrap = (value: number, span: number): number => ((value % span) + span) % span;

/** Slow lateral drift + a one-pixel breath. No trails, no glow, no colour. */
export function starPoint(star: Star, elapsed: number, viewport: Viewport): StarPoint {
  const x = wrap(star.x - elapsed * star.drift, viewport.width);
  const y = wrap(star.y + Math.sin(elapsed * 0.00022 + star.phase) * 2, viewport.height);
  const breath = 0.78 + Math.sin(elapsed * 0.0009 + star.phase) * 0.22;
  return { x, y, alpha: star.alpha * breath };
}
