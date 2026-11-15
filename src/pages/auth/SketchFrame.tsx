import { useLayoutEffect, useRef, useState } from 'react';
import { paperShape, polygonPath, sketchHLine, sketchPolygon, sketchRect } from '../../lib/sketch';
import s from './login.module.css';

/**
 * The pen. Three components, one contract:
 *   - `SketchFrame` outlines at its *measured* size, so the wobble is in pixels
 *     and never stretches with the layout. `variant="paper"` fills an irregular
 *     silhouette and draws its edge; `variant="box"` is a plain drawn rectangle.
 *   - `SketchUnderline` and `SketchRule` are single horizontal strokes; there the
 *     viewBox is allowed to stretch because only x changes.
 * Colour is always `currentColor`; the caller decides the ink.
 */
type FrameProps = { seed: string; double?: boolean; variant?: 'box' | 'paper' };

export function SketchFrame({ seed, double = true, variant = 'box' }: FrameProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const paper = variant === 'paper';
  const points = paper ? paperShape(size.width, size.height) : null;
  const outline = (amplitude: number, suffix = '') =>
    points
      ? sketchPolygon(points, `${seed}${suffix}`, amplitude)
      : sketchRect(size.width, size.height, `${seed}${suffix}`, amplitude);

  return (
    <span className={s.frame} ref={ref} aria-hidden>
      {size.width > 12 && size.height > 12 ? (
        <svg width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`} fill="none">
          {/* The clean silhouette underneath: the page's body. The wobble lives
              in the stroke on top of it, not in the fill. */}
          {points ? <path d={polygonPath(points)} fill="var(--bg-surface)" /> : null}
          <path
            d={outline(2.2)}
            stroke="currentColor"
            strokeWidth={1.1}
            strokeLinecap="round"
            strokeOpacity={0.9}
          />
          {double ? (
            <path
              d={outline(2.8, ':again')}
              transform="translate(1.4 1.4)"
              stroke="currentColor"
              strokeWidth={1}
              strokeLinecap="round"
              strokeOpacity={0.28}
            />
          ) : null}
        </svg>
      ) : null}
    </span>
  );
}

export function SketchUnderline({ seed, width = 320 }: { seed: string; width?: number }) {
  return (
    <svg className={s.underline} viewBox={`0 0 ${width} 4`} preserveAspectRatio="none" aria-hidden>
      <path d={sketchHLine(width, 2, seed, 1.1)} stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** A hairline that reads as drawn, used for the panel's rule. */
export function SketchRule({ seed }: { seed: string }) {
  return (
    <svg className={s.rule} viewBox="0 0 320 4" preserveAspectRatio="none" aria-hidden>
      <path d={sketchHLine(320, 2, seed, 0.5)} stroke="currentColor" strokeWidth={1} strokeLinecap="round" fill="none" />
    </svg>
  );
}
