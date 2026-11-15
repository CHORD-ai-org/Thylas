import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import {
  centerSheet,
  clampSheet,
  readSheetPosition,
  serializeSheetPosition,
  type SheetPosition,
} from '../../lib/sheet-position';
import { SketchFrame } from './SketchFrame';
import s from './login.module.css';

const KEY = 'thylas:login-sheet:v1';
const STEP = 8;
const STEP_LARGE = 32;
/** Below this width the sheet is part of the flow, not a loose object. */
const DRAGGABLE = '(min-width: 960px)';

type Bounds = { viewport: { width: number; height: number }; size: { width: number; height: number } };

/**
 * The paper: a loose object on the left half, held by one grip.
 *
 * Rules (LOGIN-PLAN §4):
 *   - Only the grip starts a drag. A pointerdown anywhere else would eat text
 *     selection inside the fields.
 *   - Every position goes through `clampSheet`, so the sheet cannot be dropped
 *     out of reach.
 *   - The position is written on release, not on every frame.
 */
export function LoginSheet({
  title,
  children,
  corner,
}: {
  title: string;
  children: ReactNode;
  /** Rendered inside the stage, above the sheet: the mark, in this page's case. */
  corner?: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<SheetPosition | null>(null);
  const positionRef = useRef<SheetPosition | null>(null);
  positionRef.current = position;

  const measure = useCallback((): Bounds | null => {
    const stage = stageRef.current;
    const sheet = sheetRef.current;
    if (!stage || !sheet) return null;
    return {
      viewport: { width: stage.clientWidth, height: stage.clientHeight },
      size: { width: sheet.offsetWidth, height: sheet.offsetHeight },
    };
  }, []);

  const clampTo = useCallback(
    (next: SheetPosition): SheetPosition => {
      const bounds = measure();
      return bounds ? clampSheet(next, bounds.viewport, bounds.size) : next;
    },
    [measure],
  );

  const persist = useCallback((next: SheetPosition) => {
    try {
      localStorage.setItem(KEY, serializeSheetPosition(next));
    } catch {
      /* storage full or blocked: the sheet still moves in this session */
    }
  }, []);

  const place = useCallback(
    (next: SheetPosition, save = true) => {
      const clamped = clampTo(next);
      setPosition(clamped);
      if (save) persist(clamped);
    },
    [clampTo, persist],
  );

  useLayoutEffect(() => {
    const bounds = measure();
    if (!bounds) return;
    let stored: SheetPosition | null = null;
    try {
      stored = readSheetPosition(localStorage.getItem(KEY));
    } catch {
      stored = null;
    }
    setPosition(stored ? clampSheet(stored, bounds.viewport, bounds.size) : centerSheet(bounds.viewport, bounds.size));
  }, [measure]);

  useEffect(() => {
    const onResize = () => {
      const current = positionRef.current;
      const bounds = measure();
      if (current && bounds) setPosition(clampSheet(current, bounds.viewport, bounds.size));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    if (typeof window === 'undefined' || !window.matchMedia(DRAGGABLE).matches) return;
    const origin = positionRef.current;
    if (!origin) return;
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const sheet = sheetRef.current;

    const move = (moveEvent: globalThis.PointerEvent) => {
      place({ x: origin.x + (moveEvent.clientX - startX), y: origin.y + (moveEvent.clientY - startY) }, false);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      sheet?.removeAttribute('data-dragging');
      document.body.style.removeProperty('user-select');
      const finalPosition = positionRef.current;
      if (finalPosition) persist(finalPosition);
    };

    sheet?.setAttribute('data-dragging', 'true');
    document.body.style.setProperty('user-select', 'none');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const onGripKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const current = positionRef.current;
    if (!current) return;
    const step = event.shiftKey ? STEP_LARGE : STEP;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    place({ x: current.x + delta[0], y: current.y + delta[1] });
  };

  const reset = () => {
    const bounds = measure();
    if (!bounds) return;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
    setPosition(centerSheet(bounds.viewport, bounds.size));
  };

  return (
    <div className={s.stage} ref={stageRef} data-sheet-stage>
      {corner}
      <div
        className={s.sheet}
        ref={sheetRef}
        data-login-sheet
        style={{
          left: position?.x ?? -9999,
          top: position?.y ?? -9999,
          opacity: position ? 1 : 0,
        }}
      >
        <SketchFrame seed="login-paper" variant="paper" />
        <button
          type="button"
          className={s.grip}
          onPointerDown={startDrag}
          onKeyDown={onGripKey}
          onDoubleClick={reset}
          aria-label="Move the sheet"
          title="Drag to move · double-click to reset"
          data-sheet-grip
        >
          <span className={s.gripMarks} aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className={s.gripTitle}>{title}</span>
        </button>
        {children}
      </div>
    </div>
  );
}
