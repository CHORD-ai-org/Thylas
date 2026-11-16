import { useEffect, useRef } from 'react';
import { createStars, starPoint, type Star } from '../../lib/starfield';
import s from './onboarding.module.css';

/**
 * The sky the sign-in warp leaves behind. Static for reduced motion; otherwise
 * a slow drift with no trails, colour or glow. Positions come from a pure
 * function, so the canvas keeps no state of its own.
 */
export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const started = performance.now();
    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let frame = 0;

    const render = (now: number) => {
      const elapsed = reduced ? 0 : now - started;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#F2F2F2';
      for (const star of stars) {
        const point = starPoint(star, elapsed, { width, height });
        ctx.globalAlpha = point.alpha;
        ctx.fillRect(point.x, point.y, star.size, star.size);
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = createStars({ width, height });
      render(performance.now());
    };

    resize();
    window.addEventListener('resize', resize);

    if (!reduced) {
      const loop = (now: number) => {
        render(now);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={s.starfield} aria-hidden data-onboarding-stars />;
}
