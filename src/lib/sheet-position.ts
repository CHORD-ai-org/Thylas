/**
 * Where the login sheet sits, and how it is not allowed to get lost.
 *
 * A draggable sheet that can be dropped completely outside the viewport is a bug
 * that cannot be undone by the user, so every position goes through
 * `clampSheet`: at least `margin` pixels of the sheet stay reachable on each
 * axis. Contract: docs/development/auth/LOGIN-PLAN.md §4.
 */

export type SheetPosition = { x: number; y: number };
export type SheetSize = { width: number; height: number };
export type SheetViewport = { width: number; height: number };

export const KEEP_VISIBLE = 56;

export function clampSheet(
  position: SheetPosition,
  viewport: SheetViewport,
  size: SheetSize,
  margin = KEEP_VISIBLE,
): SheetPosition {
  const minX = margin - size.width;
  const maxX = viewport.width - margin;
  const minY = margin - size.height;
  const maxY = viewport.height - margin;

  return {
    x: Math.max(minX, Math.min(maxX, position.x)),
    y: Math.max(minY, Math.min(maxY, position.y)),
  };
}

/** Centred, then lifted a little: a sheet put down by hand, not by a layout. */
export function centerSheet(viewport: SheetViewport, size: SheetSize, bias = 0.06): SheetPosition {
  return {
    x: Math.round((viewport.width - size.width) / 2),
    y: Math.round((viewport.height - size.height) / 2 - viewport.height * bias),
  };
}

export function readSheetPosition(raw: string | null): SheetPosition | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { x, y } = parsed as { x?: unknown; y?: unknown };
    if (typeof x !== 'number' || typeof y !== 'number') return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  } catch {
    return null;
  }
}

export function serializeSheetPosition(position: SheetPosition): string {
  return JSON.stringify({ x: Math.round(position.x), y: Math.round(position.y) });
}
