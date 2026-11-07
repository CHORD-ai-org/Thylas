import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import {
  GRID,
  ZOOM_STEP,
  fitViewport,
  panBy,
  wheelZoom,
  zoomAt,
  type Point,
  type Rect,
  type Viewport,
} from './scene';

export type ViewportRefs = {
  area: RefObject<HTMLDivElement | null>;
  scene: RefObject<HTMLDivElement | null>;
  zoomLabel: RefObject<HTMLSpanElement | null>;
};

type PanSession = { startX: number; startY: number; x: number; y: number };

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  );
}

/**
 * The viewport ref is the single source of truth. Wheel and pointer handlers
 * mutate it synchronously and schedule one rAF commit, so 30 wheel events in
 * one frame accumulate into 30 zoom steps instead of all reading the same
 * render closure. The commit writes DOM properties only — no React state, no
 * card re-render. Listeners are bound once per pointer session, never per move.
 *
 * `x`/`y` are screen pixels and `zoom` is the full scene transform, so the
 * scene's bounding box alone converts pointer coordinates to scene units.
 */
export function useCanvasViewport(
  refs: ViewportRefs,
  options: {
    getBounds: () => Rect;
    enabled?: boolean;
    /** Called once a pan or zoom gesture has stopped moving, so the caller can
        reposition screen-space chrome without listening to every frame. */
    onSettle?: () => void;
  } = { getBounds: () => ({ x: 0, y: 0, w: 2400, h: 1600 }) },
) {
  const refsRef = useRef(refs);
  refsRef.current = refs;
  const boundsRef = useRef(options.getBounds);
  boundsRef.current = options.getBounds;
  const settleRef = useRef(options.onSettle);
  settleRef.current = options.onSettle;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = options.enabled ?? true;

  const settle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      settleRef.current?.();
    }, 140);
  }, []);

  const view = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const frame = useRef<number | null>(null);
  const session = useRef<PanSession | null>(null);
  const space = useRef(false);
  const fitted = useRef(false);

  const apply = useCallback(() => {
    const r = refsRef.current;
    const v = view.current;
    if (r.scene.current) {
      r.scene.current.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.zoom})`;
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

  const areaSize = useCallback(() => {
    const area = refsRef.current.area.current;
    return { w: area?.clientWidth ?? 1200, h: area?.clientHeight ?? 800 };
  }, []);

  /** Zoom is always relative to the canvas origin, which is where `view.x`
      is measured from. */
  const pointerOf = useCallback((clientX: number, clientY: number): Point => {
    const area = refsRef.current.area.current;
    if (!area) return { x: 0, y: 0 };
    const rect = area.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const fit = useCallback(() => {
    const { w, h } = areaSize();
    view.current = fitViewport(boundsRef.current(), w, h);
    schedule();
  }, [areaSize, schedule]);

  const zoomTo = useCallback(
    (next: number) => {
      const { w, h } = areaSize();
      view.current = zoomAt(view.current, next, { x: w / 2, y: h / 2 });
      schedule();
    },
    [areaSize, schedule],
  );

  /** Used by the drag session's auto-pan: the caller keeps its own compensation
      so the dragged object still tracks the pointer. */
  const panByScreen = useCallback(
    (dx: number, dy: number) => {
      view.current = panBy(view.current, dx, dy);
      schedule();
    },
    [schedule],
  );

  const centerOn = useCallback(
    (point: Point) => {
      const { w, h } = areaSize();
      view.current = {
        ...view.current,
        x: w / 2 - point.x * view.current.zoom,
        y: h / 2 - point.y * view.current.zoom,
      };
      schedule();
    },
    [areaSize, schedule],
  );

  const zoomIn = useCallback(() => zoomTo(view.current.zoom * ZOOM_STEP), [zoomTo]);
  const zoomOut = useCallback(() => zoomTo(view.current.zoom / ZOOM_STEP), [zoomTo]);

  useLayoutEffect(() => {
    apply();
  });

  useEffect(() => {
    if (!enabled) return;
    const area = refsRef.current.area.current;
    if (!area) return;

    const measure = () => {
      // Fit once, on the first measurement: after that the zoom belongs to the
      // reader, and a window resize must not throw their framing away.
      if (!fitted.current) {
        fitted.current = true;
        fit();
        return;
      }
      apply();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(area);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        view.current = wheelZoom(view.current, e.deltaY, pointerOf(e.clientX, e.clientY));
      } else {
        const horizontal = e.shiftKey && e.deltaX === 0;
        view.current = panBy(
          view.current,
          -(horizontal ? e.deltaY : e.deltaX),
          -(horizontal ? 0 : e.deltaY),
        );
      }
      schedule();
      settle();
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
      const wasPanning = session.current !== null;
      session.current = null;
      refsRef.current.area.current?.toggleAttribute('data-panning', false);
      if (wasPanning) settle();
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
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [enabled, apply, schedule, fit, zoomIn, zoomOut, pointerOf, settle]);

  return { zoomIn, zoomOut, zoomTo, fit, panByScreen, centerOn, view };
}
