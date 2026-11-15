/**
 * Hand-drawn geometry, without a library.
 *
 * The only thing that separates "hand-drawn" from "wobbly CSS" is that the
 * wobble must be *stable*: the same seed has to draw the same line on every
 * render, every reload and every screenshot. So: FNV-1a for the seed, mulberry32
 * for the stream, fixed subdivision per edge, and endpoints left exactly on the
 * corner so four edges still meet.
 *
 * Contract: docs/development/auth/LOGIN-PLAN.md §3.3.
 */

/** Interior points per edge. Three is enough to read as a pen, few enough to
    stay crisp at 1px. */
const SUBDIVISIONS = 3;

export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/** Small, fast, deterministic PRNG — the whole point is reproducibility. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number): string => (Math.round(value * 100) / 100).toString();

/**
 * A polyline through `points`, with every straight edge bowed by up to
 * `amplitude` pixels. Each edge is its own subpath so corners stay sharp
 * instead of being rounded off by a spline that does not exist.
 */
export function sketchPath(points: [number, number][], seed: string, amplitude = 0.8): string {
  const random = mulberry32(hashSeed(seed));
  const parts: string[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[i + 1]!;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    /* Unit normal: the only direction a pen deviates from a straight edge. */
    const nx = -dy / length;
    const ny = dx / length;

    const segment = [`M ${round(x1)} ${round(y1)}`];
    for (let step = 1; step <= SUBDIVISIONS; step++) {
      const t = step / (SUBDIVISIONS + 1);
      const drift = (random() * 2 - 1) * amplitude;
      segment.push(`L ${round(x1 + dx * t + nx * drift)} ${round(y1 + dy * t + ny * drift)}`);
    }
    segment.push(`L ${round(x2)} ${round(y2)}`);
    parts.push(segment.join(' '));
  }

  return parts.join(' ');
}

/** A closed polygon, filled crisply — the paper's body. The jittered outline
    is drawn on top of this, so the silhouette stays clean while the edge wobbles. */
export function polygonPath(points: [number, number][]): string {
  if (points.length < 3) return '';
  return `M ${points.map(([x, y]) => `${round(x)} ${round(y)}`).join(' L ')} Z`;
}

/** Every edge of a polygon, drawn separately and running past both corners. */
export function sketchPolygon(
  points: [number, number][],
  seed: string,
  amplitude = 0.8,
  overshoot = amplitude * 1.4,
): string {
  if (points.length < 2) return '';
  const parts: string[] = [];

  for (let i = 0; i < points.length; i++) {
    const from = points[i]!;
    const to = points[(i + 1) % points.length]!;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = Math.hypot(dx, dy) || 1;
    const ux = (dx / length) * overshoot;
    const uy = (dy / length) * overshoot;
    parts.push(
      sketchPath(
        [
          [from[0] - ux, from[1] - uy],
          [to[0] + ux, to[1] + uy],
        ],
        `${seed}:${i}`,
        amplitude,
      ),
    );
  }

  return parts.join(' ');
}

/** Four separate edges, inset by `inset`, each running slightly past its
    corner — the overshoot is what makes a rectangle read as drawn rather than
    as a border. */
export function sketchRect(
  width: number,
  height: number,
  seed: string,
  amplitude = 0.8,
  inset = 1.5,
  overshoot = amplitude * 1.4,
): string {
  const left = inset;
  const top = inset;
  const right = Math.max(left + 1, width - inset);
  const bottom = Math.max(top + 1, height - inset);
  return sketchPolygon(
    [
      [left, top],
      [right, top],
      [right, bottom],
      [left, bottom],
    ],
    seed,
    amplitude,
    overshoot,
  );
}

/**
 * The sheet's silhouette: not a rectangle. The top edge slants up to the right,
 * the top-right corner is cut like a folded page, and the bottom edge sits a
 * little high on the left. All offsets are small — the content still has room,
 * the shape just refuses to be a box.
 */
export function paperShape(width: number, height: number): [number, number][] {
  const w = Math.max(width, 12);
  const h = Math.max(height, 12);
  const at = (rx: number, ry: number): [number, number] => [
    Math.round(rx * w * 100) / 100,
    Math.round(ry * h * 100) / 100,
  ];
  return [
    at(0.018, 0.03),
    at(0.55, 0.012),
    at(0.9, 0.022),
    at(0.972, 0.082),
    at(0.99, 0.9),
    at(0.9, 0.986),
    at(0.03, 0.978),
  ];
}

/** A single horizontal stroke, for input underlines. */
export function sketchHLine(width: number, y: number, seed: string, amplitude = 0.6): string {
  return sketchPath([[1.5, y], [Math.max(2.5, width - 1.5), y]], seed, amplitude);
}
