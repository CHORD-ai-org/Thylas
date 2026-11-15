import { useEffect, useRef, type CSSProperties } from 'react';
import { hashSeed, mulberry32 } from '../../lib/sketch';
import { WARP, cometState, flashOpacity, starProgress } from '../../lib/signin-warp';
import s from './login.module.css';

const STARS = 150;
/** Tail samples, 5ms apart: 42 samples ≈ 210ms of flight, drawn as a stroke so
    it reads as one trail rather than a row of dots. */
const TAIL_STEPS = 42;
const TAIL_STEP_MS = 5;
/** Where the ink's leading edge is at time t: it runs from the panel's left
    edge to the viewport edge over the same 760ms the CSS uses. */
const WIPE_START = 700;
const WIPE_MS = 760;
function wipeLeft(t: number, panelLeft: number): number {
  const raw = Math.min(1, Math.max(0, (t - WIPE_START) / WIPE_MS));
  const eased = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
  return panelLeft * (1 - eased);
}

type Props = {
  /** Where the black panel was: the ink starts as exactly this rectangle. */
  panel: DOMRect;
  onDone: () => void;
};

/**
 * The warp after a successful sign-in attempt.
 *
 * Three layers, in order:
 *   1. the quote's words become stars (canvas, drawn from the panel's text area)
 *   2. an ink veil grows from the panel's rectangle to the whole viewport
 *   3. a comet flies, the camera closes in, everything floods white
 *
 * The sheet itself collapses via CSS on `.page[data-warp]`; the canvas picks up
 * where it disappears, so there is no visible hand-off.
 *
 * All the timing lives in `lib/signin-warp.ts` — the loop here only asks what
 * the comet's position is at time t.
 */
export function SignInTransition({ panel, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(onDone, WARP.done);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    /* Deterministic: the same show every run, which keeps screenshots and the
       one e2e that watches it honest. */
    const random = mulberry32(hashSeed('signin-warp'));

    /* Where the words were. Approximated from the panel: the quote block sits
       just above the panel's vertical centre, 40px in from its edges. */
    const from = {
      x: panel.left + 40,
      y: panel.top + panel.height * 0.36,
      w: Math.max(80, panel.width - 80),
      h: Math.max(80, panel.height * 0.2),
    };

    const stars = Array.from({ length: STARS }, () => ({
      sx: from.x + random() * from.w,
      sy: from.y + random() * from.h,
      tx: random() * width,
      ty: random() * height,
      spawn: random() * WARP.starSpawn,
      size: 0.7 + random() * 1.5,
      phase: random() * Math.PI * 2,
    }));

    const streaks = Array.from({ length: 110 }, () => ({
      angle: random() * Math.PI * 2,
      start: 0.1 + random() * 0.7,
      len: 0.4 + random(),
    }));

    const started = performance.now();
    let frame = 0;

    const draw = (now: number) => {
      const t = now - started;
      ctx.clearRect(0, 0, width, height);

      /* 1. stars: born in the text, thrown across the panel, then drifting.
         Until the ink starts covering the page they stay inside the panel —
         stars on the cream half would look like dust on paper. */
      const coverX = wipeLeft(t, panel.left);
      ctx.save();
      ctx.beginPath();
      ctx.rect(coverX, 0, Math.max(0, width - coverX), height);
      ctx.clip();
      ctx.fillStyle = '#F2F2F2';
      for (const star of stars) {
        const progress = starProgress(star.spawn, t);
        if (progress < 0) continue;
        const drift = t > WARP.cometInEnd ? Math.min(40, (t - WARP.cometInEnd) * 0.012) : 0;
        const x = star.sx + (star.tx - star.sx) * progress + Math.cos(star.phase) * drift;
        const y = star.sy + (star.ty - star.sy) * progress + Math.sin(star.phase) * drift;
        ctx.globalAlpha = Math.min(1, progress * 1.8) * (0.35 + 0.6 * progress);
        ctx.beginPath();
        ctx.arc(x, y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      /* 2. the camera starts moving: everything stretches away from centre. */
      if (t > WARP.cometInEnd) {
        const p = Math.min(1, (t - WARP.cometInEnd) / (WARP.approachEnd - WARP.cometInEnd));
        const radiusBase = Math.max(width, height);
        ctx.strokeStyle = '#F2F2F2';
        ctx.lineWidth = 0.8;
        for (const streak of streaks) {
          const r0 = radiusBase * streak.start * (0.2 + p * 0.9);
          const len = radiusBase * 0.16 * p * streak.len;
          const cx = width / 2 + Math.cos(streak.angle) * r0;
          const cy = height / 2 + Math.sin(streak.angle) * r0;
          ctx.globalAlpha = 0.05 + 0.16 * p;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(streak.angle) * len, cy + Math.sin(streak.angle) * len);
          ctx.stroke();
        }
      }

      /* 3. the comet: a tail sampled from its own past positions, so it bends
         with the curve instead of following a straight line. */
      const head = cometState(t, { width, height });
      if (head.visible) {
        /* Tail: sampled from the comet's own past positions and stroked, so it
           bends with the curve and thins as it fades. */
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#F2F2F2';
        for (let i = TAIL_STEPS; i >= 1; i--) {
          const back = cometState(t - i * TAIL_STEP_MS, { width, height });
          const ahead = cometState(t - (i - 1) * TAIL_STEP_MS, { width, height });
          if (!back.visible || !ahead.visible) continue;
          const fade = 1 - i / TAIL_STEPS;
          ctx.globalAlpha = 0.5 * fade * Math.min(1.4, head.tail);
          ctx.lineWidth = Math.max(0.8, head.radius * 0.85 * fade);
          ctx.beginPath();
          ctx.moveTo(back.x, back.y);
          ctx.lineTo(ahead.x, ahead.y);
          ctx.stroke();
        }

        /* Bloom: a radial gradient inside the canvas. The no-gradients rule is
           about static UI surfaces; a light source needs falloff or it reads as
           a bullseye. */
        const bloom = ctx.createRadialGradient(
          head.x,
          head.y,
          head.radius * 0.4,
          head.x,
          head.y,
          head.radius * 7,
        );
        bloom.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        bloom.addColorStop(0.35, 'rgba(255, 255, 255, 0.18)');
        bloom.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(head.x, head.y, head.radius * 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(head.x, head.y, head.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      /* 4. white flood. */
      const flash = flashOpacity(t);
      if (flash > 0) {
        ctx.globalAlpha = flash;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [panel]);

  /* The veil starts as the panel's exact rectangle and grows to the viewport.
     The geometry goes in as custom properties and the keyframes read them, so
     there is no first-frame race between mount and the transition. */
  const veilVars = {
    '--ink-top': `${panel.top}px`,
    '--ink-right': `${Math.max(0, window.innerWidth - panel.right)}px`,
    '--ink-bottom': `${Math.max(0, window.innerHeight - panel.bottom)}px`,
    '--ink-left': `${panel.left}px`,
  } as CSSProperties;

  return (
    <>
      <div className={s.veil} style={veilVars} data-signin-warp />
      <canvas ref={canvasRef} className={s.warpCanvas} aria-hidden data-warp-canvas />
    </>
  );
}
