import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import {
  GRID,
  SCENE_H,
  SCENE_W,
  ZOOM_STEP,
  fitScale,
  fitViewport,
  panBy,
  wheelZoom,
  zoomAt,
  type Point,
  type Viewport,
} from './scene';

export type ViewportRefs = {
  area: RefObject<HTMLDivElement | null>;
  stage: RefObject<HTMLDivElement | null>;
  scene: RefObject<HTMLDivElement | null>;
  zoomLabel: RefObject<HTMLSpanElement | null>;
};

type PanSession = { startX: number; startY: number; x: number; y: number };

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

/**
 * The viewport ref is the single source of truth. Wheel and pointer handlers
 * mutate it synchronously and schedule one rAF commit, so 30 wheel events in
 * one frame accumulate into 30 zoom steps instead of all reading the same
 * render closure. The commit writes DOM properties only — no React state, no
 * card re-render. Listeners are bound once per pointer session, never per move.
 */
export function useCanvasViewport(refs: ViewportRefs, enabled = true) {
  const refsRef = useRef(refs);
  refsRef.current = refs;

  const view = useRef<Viewport>(fitViewport());
  const fitRatio = useRef(1);
  const frame = useRef<number | null>(null);
  const session = useRef<PanSession | null>(null);
  const space = useRef(false);

  const apply = useCallback(() => {
    const r = refsRef.current;
    const v = view.current;
    const scale = fitRatio.current * v.zoom;

    if (r.scene.current) {
      r.scene.current.style.transform = `translate(${v.x}px, ${v.y}px) scale(${scale})`;
    }
    if (r.stage.current) {
      r.stage.current.style.width = `${SCENE_W * fitRatio.current}px`;
      r.stage.current.style.height = `${SCENE_H * fitRatio.current}px`;
    }
    if (r.area.current) {
      // The grid follows pan and zoom, but the dot radius stays 1px because it
      // is an absolute length inside the radial-gradient. Below 8px spacing a
      // 1px dot grid turns into a grey sheet, so the spacing doubles instead.
      let grid = GRID * v.zoom;
      while (grid < 8) grid *= 2;
      const ox = (((v.x % grid) + grid) % grid) - 1;
      const oy = (((v.y % grid) + grid) % grid) - 1;
      r.area.current.style.backgroundSize = `${grid}px ${grid}px`;
      r.area.current.style.backgroundPosition = `${ox}px ${oy}px`;
    }
    if (r.zoomLabel.current) {
      r.zoomLabel.current.textContent = `${Math.round(v.zoom * 100)}%`;
    }
  }, []);

  const schedule = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      apply();
    });
  }, [apply]);

  const stagePointer = useCallback((clientX: number, clientY: number): Point => {
    const stage = refsRef.current.stage.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const zoomAtCenter = useCallback(
    (factor: number) => {
      const area = refsRef.current.area.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      const pointer = stagePointer(rect.left + rect.width / 2, rect.top + rect.height / 2);
      view.current = zoomAt(view.current, view.current.zoom * factor, pointer);
      schedule();
    },
    [schedule, stagePointer],
  );

  const zoomIn = useCallback(() => zoomAtCenter(ZOOM_STEP), [zoomAtCenter]);
  const zoomOut = useCallback(() => zoomAtCenter(1 / ZOOM_STEP), [zoomAtCenter]);
  const fit = useCallback(() => {
    view.current = fitViewport();
    schedule();
  }, [schedule]);

  useLayoutEffect(() => {
    apply();
  });

  useEffect(() => {
    if (!enabled) return;
    const area = refsRef.current.area.current;
    if (!area) return;

    const measure = () => {
      fitRatio.current = fitScale(area.clientWidth, area.clientHeight);
      apply();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(area);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        view.current = wheelZoom(view.current, e.deltaY, stagePointer(e.clientX, e.clientY));
      } else {
        const horizontal = e.shiftKey && e.deltaX === 0;
        view.current = panBy(
          view.current,
          -(horizontal ? e.deltaY : e.deltaX),
          -(horizontal ? 0 : e.deltaY),
        );
      }
      schedule();
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = session.current;
      if (!s) return;
      view.current = {
        ...view.current,
        x: s.x + (e.clientX - s.startX),
        y: s.y + (e.clientY - s.startY),
      };
      schedule();
    };

    const endSession = () => {
      session.current = null;
      refsRef.current.area.current?.toggleAttribute('data-panning', false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endSession);
      window.removeEventListener('pointercancel', endSession);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!space.current && e.button !== 1) return;
      e.preventDefault();
      const v = view.current;
      session.current = { startX: e.clientX, startY: e.clientY, x: v.x, y: v.y };
      area.toggleAttribute('data-panning', true);
      // One binding per session. Re-binding on every move is the measured
      // 150-card frame killer in the reference implementation.
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', endSession);
      window.addEventListener('pointercancel', endSession);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isTyping(e.target)) {
        e.preventDefault();
        space.current = true;
        area.toggleAttribute('data-space', true);
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === '0') {
        e.preventDefault();
        fit();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        space.current = false;
        area.toggleAttribute('data-space', false);
      }
    };

    const onBlur = () => {
      space.current = false;
      area.toggleAttribute('data-space', false);
    };

    area.addEventListener('wheel', onWheel, { passive: false });
    area.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      ro.disconnect();
      area.removeEventListener('wheel', onWheel);
      area.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      endSession();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [enabled, apply, schedule, fit, zoomIn, zoomOut, stagePointer]);

  return { zoomIn, zoomOut, fit, view, fitRatio };
}
