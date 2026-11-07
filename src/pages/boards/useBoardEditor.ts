/* The board editor: one scene, one selection, one undo stack, and three pointer
   sessions (drag, marquee, resize).

   Two rules keep a 150-card drag at frame rate:
   1. Pointer movement never touches React state. Cards move through inline
      transforms, written once per animation frame.
   2. Geometry is measured once per session, not per move. Card heights are
      content-sized, so they are read from the DOM at pointerdown and reused.

   Committed positions go through `applyEdit` in history.ts, which is also what
   undo reverses — there is no second mutation path. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { CARD_DEFAULT_H, type BoardScene, type Point, type Rect, type SceneCard, type Viewport } from './scene';
import {
  applyEdit,
  editLabel,
  emptyHistory,
  pushEdit,
  redoEdit,
  undoEdit,
  type CardEdit,
  type History,
} from './history';
import {
  boundingRect,
  cardsInRect,
  clampRect,
  createCardAt,
  rectFromPoints,
  rectOf,
  resizeRect,
  scenePoint,
  snapMove,
  type SnapResult,
} from './gestures';
import type { BoardStore } from './store';

export type EditorRefs = {
  scene: RefObject<HTMLDivElement | null>;
  guideX: RefObject<HTMLDivElement | null>;
  guideY: RefObject<HTMLDivElement | null>;
  marquee: RefObject<HTMLDivElement | null>;
};

export type BoardEditorOptions = {
  /** Sample scene for this board; edits are layered on top of it. */
  initial: BoardScene;
  refs: EditorRefs;
  /** fitRatio × zoom — the whole transform applied to the scene element. */
  view: { current: Viewport };
  fitRatio: { current: number };
  store: BoardStore | null;
  /** Saved scene for this board, if one exists and matches the schema. */
  saved: BoardScene | null;
};

type DragSession = {
  kind: 'drag';
  startX: number;
  startY: number;
  ids: string[];
  els: HTMLElement[];
  heights: Map<string, number>;
  bbox: Rect;
  others: Rect[];
  scale: number;
  dx: number;
  dy: number;
  snap: SnapResult;
  moved: boolean;
  collapseTo: string | null;
};

type MarqueeSession = {
  kind: 'marquee';
  start: Point;
  base: string[];
  heights: Map<string, number>;
};

type ResizeSession = {
  kind: 'resize';
  id: string;
  el: HTMLElement;
  scale: number;
  startX: number;
  startY: number;
  base: { w: number; h: number };
  size: { w: number; h: number };
  prev: { width: string; minHeight: string };
};

type Session = DragSession | MarqueeSession | ResizeSession;

type Live = {
  scene: BoardScene;
  selection: string[];
  editingId: string | null;
};

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
  );
}

let cardSeq = 0;
function nextCardId(scene: BoardScene): string {
  const taken = new Set(scene.cards.map((c) => c.id));
  let id = '';
  do {
    cardSeq += 1;
    id = `c-${Date.now().toString(36).slice(-4)}${cardSeq}`;
  } while (taken.has(id));
  return id;
}

export function useBoardEditor(options: BoardEditorOptions) {
  const { initial, refs, view, fitRatio, store, saved } = options;

  const [scene, setSceneState] = useState<BoardScene>(() => saved ?? initial);
  const [selection, setSelectionState] = useState<string[]>([]);
  const [editingId, setEditingState] = useState<string | null>(null);
  const [history, setHistory] = useState<History>(emptyHistory);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const live = useRef<Live>({ scene, selection, editingId });
  live.current.scene = scene;
  live.current.selection = selection;
  live.current.editingId = editingId;

  const historyLive = useRef<History>(history);
  historyLive.current = history;

  const session = useRef<Session | null>(null);
  const marqueeRect = useRef<Rect | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const raf = useRef(0);

  const schedule = useCallback((fn: () => void) => {
    pending.current = fn;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const run = pending.current;
      pending.current = null;
      run?.();
    });
  }, []);

  const scale = useCallback(() => fitRatio.current * view.current.zoom, [fitRatio, view]);

  const putScene = useCallback(
    (next: BoardScene) => {
      live.current.scene = next;
      setSceneState(next);
      store?.save(next);
    },
    [store],
  );

  const setSelection = useCallback((ids: string[]) => {
    live.current.selection = ids;
    setSelectionState(ids);
  }, []);

  const setEditing = useCallback((id: string | null) => {
    live.current.editingId = id;
    setEditingState(id);
  }, []);

  const commit = useCallback(
    (edit: CardEdit) => {
      putScene(applyEdit(live.current.scene, edit, 'do'));
      setHistory(pushEdit(historyLive.current, edit));
      setLastAction(editLabel(edit));
    },
    [putScene],
  );

  /** Origin of the transformed scene element: pan and scale are already baked
      into its bounding box, so one rect carries the whole viewport. */
  const pointOf = useCallback(
    (clientX: number, clientY: number): Point => {
      const el = refs.scene.current;
      const origin = el ? el.getBoundingClientRect() : { left: 0, top: 0 };
      return scenePoint(clientX, clientY, origin, scale());
    },
    [refs.scene, scale],
  );

  const measureHeights = useCallback((): Map<string, number> => {
    const heights = new Map<string, number>();
    const root = refs.scene.current;
    if (!root) return heights;
    for (const el of root.querySelectorAll<HTMLElement>('[data-card-id]')) {
      heights.set(el.dataset.cardId ?? '', el.offsetHeight);
    }
    return heights;
  }, [refs.scene]);

  // A card with `h === 0` is content-sized, so the measured height is the only
  // truth; the constant is a last resort for a card that has not rendered yet.
  const heightReader = (heights: Map<string, number>) => (card: SceneCard) =>
    heights.get(card.id) ?? (card.h || CARD_DEFAULT_H);

  const showGuides = (snap: SnapResult) => {
    const gx = refs.guideX.current;
    const gy = refs.guideY.current;
    if (gx) {
      gx.style.opacity = snap.x === null ? '0' : '1';
      if (snap.x !== null) gx.style.left = `${snap.x}px`;
    }
    if (gy) {
      gy.style.opacity = snap.y === null ? '0' : '1';
      if (snap.y !== null) gy.style.top = `${snap.y}px`;
    }
  };

  const hideGuides = () => {
    if (refs.guideX.current) refs.guideX.current.style.opacity = '0';
    if (refs.guideY.current) refs.guideY.current.style.opacity = '0';
  };

  const hideMarquee = () => {
    if (refs.marquee.current) refs.marquee.current.style.opacity = '0';
    const root = refs.scene.current;
    if (root) {
      for (const el of root.querySelectorAll<HTMLElement>('[data-picked]')) {
        el.removeAttribute('data-picked');
      }
    }
    marqueeRect.current = null;
  };

  const detach = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };

  const attach = () => {
    // One binding per session. Re-binding on every move is the measured
    // 150-card frame killer in the reference implementation.
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  /* ---------- sessions ---------- */

  const endDrag = () => {
    const s = session.current;
    if (!s || s.kind !== 'drag') return;
    session.current = null;
    detach();
    hideGuides();

    if (!s.moved) {
      for (const el of s.els) el.style.transform = '';
      if (s.collapseTo) setSelection([s.collapseTo]);
      return;
    }

    const dx = s.dx + s.snap.dx;
    const dy = s.dy + s.snap.dy;
    const current = live.current.scene;
    const moves: Array<{ id: string; from: Point; to: Point }> = [];
    for (const id of s.ids) {
      const card = current.cards.find((c) => c.id === id);
      if (!card) continue;
      const h = s.heights.get(id) ?? (card.h || CARD_DEFAULT_H);
      const to = clampRect({ x: card.x + dx, y: card.y + dy, w: card.w, h });
      if (Math.abs(to.x - card.x) > 0.01 || Math.abs(to.y - card.y) > 0.01) {
        moves.push({ id, from: { x: card.x, y: card.y }, to: { x: to.x, y: to.y } });
      }
    }
    if (moves.length === 0) {
      for (const el of s.els) el.style.transform = '';
      return;
    }
    // Transforms stay until the commit renders; the layout effect below clears
    // them before paint, so the handover is invisible.
    commit({ kind: 'move', moves });
  };

  const moveDrag = (e: PointerEvent) => {
    const s = session.current;
    if (!s || s.kind !== 'drag') return;
    s.dx = (e.clientX - s.startX) / s.scale;
    s.dy = (e.clientY - s.startY) / s.scale;
    if (Math.abs(e.clientX - s.startX) > 2 || Math.abs(e.clientY - s.startY) > 2) s.moved = true;
    // Snap is resolved against the raw position and only applied on release:
    // the card must never fight the pointer.
    s.snap = snapMove({ ...s.bbox, x: s.bbox.x + s.dx, y: s.bbox.y + s.dy }, s.others);
    const { dx, dy } = s;
    const snap = s.snap;
    schedule(() => {
      for (const el of s.els) el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      showGuides(snap);
    });
  };

  const endMarquee = () => {
    const s = session.current;
    if (!s || s.kind !== 'marquee') return;
    session.current = null;
    detach();
    const rect = marqueeRect.current;
    hideMarquee();
    if (!rect || (rect.w < 2 && rect.h < 2)) {
      if (s.base.length === 0) setSelection([]);
      return;
    }
    const picked = cardsInRect(live.current.scene.cards, rect, heightReader(s.heights));
    const merged = [...s.base];
    for (const id of picked) if (!merged.includes(id)) merged.push(id);
    setSelection(merged);
  };

  const moveMarquee = (e: PointerEvent) => {
    const s = session.current;
    if (!s || s.kind !== 'marquee') return;
    const rect = rectFromPoints(s.start, pointOf(e.clientX, e.clientY));
    marqueeRect.current = rect;
    const picked = new Set(cardsInRect(live.current.scene.cards, rect, heightReader(s.heights)));
    schedule(() => {
      const box = refs.marquee.current;
      if (box) {
        box.style.opacity = '1';
        box.style.left = `${rect.x}px`;
        box.style.top = `${rect.y}px`;
        box.style.width = `${rect.w}px`;
        box.style.height = `${rect.h}px`;
      }
      const root = refs.scene.current;
      if (root) {
        for (const el of root.querySelectorAll<HTMLElement>('[data-card-id]')) {
          const id = el.dataset.cardId ?? '';
          el.toggleAttribute('data-picked', picked.has(id) && !s.base.includes(id));
        }
      }
    });
  };

  const endResize = () => {
    const s = session.current;
    if (!s || s.kind !== 'resize') return;
    session.current = null;
    detach();
    const changed = Math.abs(s.size.w - s.base.w) > 0.5 || Math.abs(s.size.h - s.base.h) > 0.5;
    if (!changed) {
      s.el.style.width = s.prev.width;
      s.el.style.minHeight = s.prev.minHeight;
      return;
    }
    // Leave the inline size in place: the render that follows writes the same
    // rounded numbers, so there is nothing to restore.
    commit({
      kind: 'resize',
      id: s.id,
      from: { w: s.base.w, h: s.base.h },
      to: { w: s.size.w, h: s.size.h },
    });
  };

  const moveResize = (e: PointerEvent) => {
    const s = session.current;
    if (!s || s.kind !== 'resize') return;
    const card = live.current.scene.cards.find((c) => c.id === s.id);
    if (!card) return;
    const dx = (e.clientX - s.startX) / s.scale;
    const dy = (e.clientY - s.startY) / s.scale;
    const size = resizeRect({ x: card.x, y: card.y, w: s.base.w, h: s.base.h }, dx, dy);
    s.size = { w: Math.round(size.w), h: Math.round(size.h) };
    const next = s.size;
    schedule(() => {
      s.el.style.width = `${next.w}px`;
      s.el.style.minHeight = `${next.h}px`;
    });
  };

  const onMove = (e: PointerEvent) => {
    const s = session.current;
    if (!s) return;
    if (s.kind === 'drag') moveDrag(e);
    else if (s.kind === 'marquee') moveMarquee(e);
    else moveResize(e);
  };

  const onUp = () => {
    const s = session.current;
    if (!s) return;
    if (s.kind === 'drag') endDrag();
    else if (s.kind === 'marquee') endMarquee();
    else endResize();
  };

  const startDrag = (
    e: React.PointerEvent,
    heights: Map<string, number>,
    ids: string[],
    collapseTo: string | null,
  ) => {
    const root = refs.scene.current;
    const current = live.current.scene;
    const read = heightReader(heights);
    const els: HTMLElement[] = [];
    const rects: Rect[] = [];
    for (const id of ids) {
      const el = root?.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
      const card = current.cards.find((c) => c.id === id);
      if (!el || !card) continue;
      els.push(el);
      rects.push(rectOf(card, read));
    }
    if (els.length === 0) return;
    session.current = {
      kind: 'drag',
      startX: e.clientX,
      startY: e.clientY,
      ids,
      els,
      heights,
      bbox: boundingRect(rects),
      others: current.cards.filter((c) => !ids.includes(c.id)).map((c) => rectOf(c, read)),
      scale: scale(),
      dx: 0,
      dy: 0,
      snap: { dx: 0, dy: 0, x: null, y: null },
      moved: false,
      collapseTo,
    };
    attach();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const cardEl = target.closest<HTMLElement>('[data-card-id]');

    // A click inside the card being edited belongs to the input.
    if (cardEl && cardEl.dataset.cardId === live.current.editingId) return;

    const heights = measureHeights();

    if (cardEl && target.closest('[data-resize]')) {
      const id = cardEl.dataset.cardId ?? '';
      const card = live.current.scene.cards.find((c) => c.id === id);
      if (!card) return;
      session.current = {
        kind: 'resize',
        id,
        el: cardEl,
        scale: scale(),
        startX: e.clientX,
        startY: e.clientY,
        base: { w: card.w, h: heights.get(id) ?? (card.h || CARD_DEFAULT_H) },
        size: { w: card.w, h: heights.get(id) ?? (card.h || CARD_DEFAULT_H) },
        prev: { width: cardEl.style.width, minHeight: cardEl.style.minHeight },
      };
      attach();
      return;
    }

    if (cardEl) {
      const id = cardEl.dataset.cardId ?? '';
      const selected = live.current.selection;
      const wasSelected = selected.includes(id);
      let ids = selected;
      let collapseTo: string | null = null;
      if (e.shiftKey) {
        ids = wasSelected ? selected.filter((x) => x !== id) : [...selected, id];
      } else if (!wasSelected) {
        ids = [id];
      } else if (selected.length > 1) {
        collapseTo = id;
      }
      setSelection(ids);
      if (ids.length === 0) return;
      startDrag(e, heights, ids, collapseTo);
      return;
    }

    const base = e.shiftKey ? live.current.selection : [];
    if (!e.shiftKey) setSelection([]);
    session.current = { kind: 'marquee', start: pointOf(e.clientX, e.clientY), base, heights };
    marqueeRect.current = null;
    attach();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const cardEl = target.closest<HTMLElement>('[data-card-id]');
    if (cardEl) {
      const id = cardEl.dataset.cardId ?? '';
      setSelection([id]);
      setEditing(id);
      return;
    }
    addCardAt(pointOf(e.clientX, e.clientY));
  };

  /* ---------- commands ---------- */

  const addCardAt = useCallback(
    (at: Point) => {
      const current = live.current.scene;
      const card = createCardAt(at, nextCardId(current), current.sections);
      commit({ kind: 'create', card });
      setSelection([card.id]);
      setEditing(card.id);
    },
    [commit, setEditing, setSelection],
  );

  const commitTitle = useCallback(
    (value: string) => {
      const id = live.current.editingId;
      if (!id) return;
      const card = live.current.scene.cards.find((c) => c.id === id);
      setEditing(null);
      if (!card || value === card.title) return;
      if (card.title === '' && value.trim() === '') {
        // A new card abandoned without a title carries nothing; dropping it
        // keeps the undo stack free of steps the user cannot see.
        const index = live.current.scene.cards.findIndex((c) => c.id === id);
        if (index >= 0) commit({ kind: 'delete', entries: [{ index, card }] });
        setSelection([]);
        return;
      }
      commit({ kind: 'title', id, from: card.title, to: value });
    },
    [commit, setEditing, setSelection],
  );

  const cancelTitle = useCallback(() => setEditing(null), [setEditing]);

  const removeSelected = useCallback(() => {
    const ids = new Set(live.current.selection);
    if (ids.size === 0) return;
    const entries = live.current.scene.cards
      .map((card, index) => ({ card, index }))
      .filter((e) => ids.has(e.card.id));
    if (entries.length === 0) return;
    commit({ kind: 'delete', entries });
    setSelection([]);
  }, [commit, setSelection]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      const current = live.current.scene;
      const moves: Array<{ id: string; from: Point; to: Point }> = [];
      for (const id of live.current.selection) {
        const card = current.cards.find((c) => c.id === id);
        if (!card) continue;
        const to = clampRect({ x: card.x + dx, y: card.y + dy, w: card.w, h: card.h || CARD_DEFAULT_H });
        if (to.x !== card.x || to.y !== card.y) {
          moves.push({ id, from: { x: card.x, y: card.y }, to: { x: to.x, y: to.y } });
        }
      }
      if (moves.length > 0) commit({ kind: 'move', moves });
    },
    [commit],
  );

  const undo = useCallback(() => {
    const result = undoEdit(historyLive.current);
    if (!result) return;
    setHistory(result.history);
    putScene(applyEdit(live.current.scene, result.edit, 'undo'));
    setSelection([]); // documented: undo clears selection
    setLastAction(`Undo · ${editLabel(result.edit)}`);
  }, [putScene, setSelection]);

  const redo = useCallback(() => {
    const result = redoEdit(historyLive.current);
    if (!result) return;
    setHistory(result.history);
    putScene(applyEdit(live.current.scene, result.edit, 'do'));
    setSelection([]);
    setLastAction(`Redo · ${editLabel(result.edit)}`);
  }, [putScene, setSelection]);

  const reset = useCallback(() => {
    historyLive.current = emptyHistory;
    setHistory(emptyHistory);
    // putScene schedules a save; clearing afterwards cancels it, so "reset"
    // leaves no stored copy behind to fight the sample on the next visit.
    putScene(initial);
    store?.clear(initial.id);
    setSelection([]);
    setLastAction('Reset to sample');
  }, [initial, putScene, setSelection, store]);

  /* ---------- effects ---------- */

  // Between renders the cards carry inline transforms from a drag that has now
  // been committed to the scene; clearing before paint hides the handover.
  useLayoutEffect(() => {
    const root = refs.scene.current;
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>('[data-card-id]')) {
      if (el.style.transform) el.style.transform = '';
    }
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || live.current.editingId) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (live.current.selection.length === 0) return;
        e.preventDefault();
        removeSelected();
        return;
      }
      if (e.key === 'Escape') {
        if (live.current.selection.length > 0) {
          e.preventDefault();
          setSelection([]);
        }
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudge(-step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudge(step, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nudge(0, -step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nudge(0, step);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nudge, redo, removeSelected, setSelection, undo]);

  useEffect(() => {
    const flush = () => store?.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
      detach();
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [store]);

  return {
    scene,
    selection,
    selectedCards: scene.cards.filter((c) => selection.includes(c.id)),
    editingId,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    lastAction,
    onPointerDown,
    onDoubleClick,
    undo,
    redo,
    removeSelected,
    nudge,
    setSelection,
    setEditing,
    commitTitle,
    cancelTitle,
    addCardAt,
    reset,
  };
}
