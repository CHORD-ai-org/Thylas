/* The board editor: one scene, one selection, one undo stack, and five pointer
   sessions (drag, marquee, resize, link, bend).

   Three rules keep a 150-card drag at frame rate:
   1. Pointer movement never touches React state. Objects move through inline
      transforms, written once per animation frame.
   2. Geometry is measured once per session, not per move. Card heights are
      content-sized, so they are read from the DOM at pointerdown and reused.
   3. Listeners are bound once per session. Re-binding on every move is the
      measured frame killer in the reference implementation.

   Every committed change records the scene *before* it in history.ts. There is
   no second mutation path, so undo cannot disagree with the canvas. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  SCENE_H,
  SCENE_W,
  anchorOf,
  edgeMid,
  estimateCardHeight,
  nearestSide,
  pointInRect,
  type BoardScene,
  type CardColor,
  type Point,
  type Rect,
  type SceneCard,
  type SceneEdge,
  type Side,
  type Viewport,
} from './scene';
import {
  boundingRect,
  cardsInRect,
  clampRect,
  createCardAt,
  createSectionAt,
  growSection,
  alignRects,
  distributeRects,
  rectFromPoints,
  resizeRect,
  scenePoint,
  sectionForCard,
  snapMove,
  type AlignMode,
  type Guide,
  type ResizeDir,
  type SnapResult,
} from './gestures';
import { canRedo, canUndo, emptyHistory, pushHistory, redoHistory, undoHistory, type History } from './history';
import type { BoardStore } from './store';

export type Tool = 'select' | 'card' | 'section';

export type EditorRefs = {
  scene: RefObject<HTMLDivElement | null>;
  area: RefObject<HTMLDivElement | null>;
  marquee: RefObject<HTMLDivElement | null>;
  guides: RefObject<SVGGElement | null>;
};

export type Editing =
  | { kind: 'card'; id: string; title: string; body: string }
  | { kind: 'section'; id: string; title: string };

export type BoardEditorOptions = {
  /** Sample scene for this board; edits are layered on top of it. */
  initial: BoardScene;
  refs: EditorRefs;
  /** Screen pixels per scene unit, mutated by the viewport hook. */
  view: { current: Viewport };
  /** Scrolls the canvas during a drag near its edge; returns pixels moved. */
  panByScreen: (dx: number, dy: number) => void;
  store: BoardStore | null;
  /** Saved scene for this board, if one exists and matches the schema. */
  saved: BoardScene | null;
};

type DragSession = {
  kind: 'drag';
  startX: number;
  startY: number;
  cardIds: string[];
  sectionIds: string[];
  els: HTMLElement[];
  heights: Map<string, number>;
  bbox: Rect;
  others: Rect[];
  scale: number;
  dx: number;
  dy: number;
  panX: number;
  panY: number;
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
  target: 'card' | 'section';
  id: string;
  dir: ResizeDir;
  el: HTMLElement;
  scale: number;
  startX: number;
  startY: number;
  base: Rect;
  rect: Rect;
  prev: { width: string; height: string; left: string; top: string };
};

type LinkSession = {
  kind: 'link';
  from: string;
  fromSide: Side;
  start: Point;
  point: Point;
  target: { id: string; side: Side } | null;
};

type BendSession = { kind: 'bend'; id: string; point: Point; before: BoardScene };

type Session = DragSession | MarqueeSession | ResizeSession | LinkSession | BendSession;

type Live = {
  scene: BoardScene;
  selection: string[];
  editing: Editing | null;
};

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
  );
}

let seq = 0;
function nextId(scene: BoardScene, prefix: string): string {
  const taken = new Set([...scene.cards.map((c) => c.id), ...scene.sections.map((s) => s.id)]);
  let id = '';
  do {
    seq += 1;
    id = `${prefix}-${Date.now().toString(36).slice(-4)}${seq}`;
  } while (taken.has(id));
  return id;
}

/** Membership and section frames after any move: a card belongs to the section
   whose area holds its centre, and a section grows to contain its members. */
function reframe(scene: BoardScene, heights: Map<string, number>): BoardScene {
  const cards = scene.cards.map((card) => {
    const h = heights.get(card.id) ?? card.h ?? estimateCardHeight(card);
    return { ...card, sectionId: sectionForCard(scene.sections, { ...card, h }) };
  });
  const sections = scene.sections.map((section) => {
    const members = cards
      .filter((card) => card.sectionId === section.id)
      .map((card) => ({
        x: card.x,
        y: card.y,
        w: card.w,
        h: heights.get(card.id) ?? card.h ?? estimateCardHeight(card),
      }));
    return members.length === 0 ? section : { ...section, ...growSection(section, members) };
  });
  return { ...scene, cards, sections };
}

export function useBoardEditor(options: BoardEditorOptions) {
  const { initial, refs, view, panByScreen, store, saved } = options;

  const [scene, setSceneState] = useState<BoardScene>(() => saved ?? initial);
  const [selection, setSelectionState] = useState<string[]>([]);
  const [editing, setEditingState] = useState<Editing | null>(null);
  const [history, setHistory] = useState<History>(emptyHistory);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [tool, setToolState] = useState<Tool>('select');
  const [linkPreview, setLinkPreview] = useState<{ from: Point; to: Point; side: Side; toSide: Side } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: 'blank' | 'object' } | null>(null);

  const live = useRef<Live>({ scene, selection, editing });
  live.current.scene = scene;
  live.current.selection = selection;
  live.current.editing = editing;

  const historyLive = useRef<History>(history);
  historyLive.current = history;

  const session = useRef<Session | null>(null);
  const marqueeRect = useRef<Rect | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const raf = useRef(0);
  const autoPanRaf = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });

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

  const scale = useCallback(() => view.current.zoom, [view]);

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

  const setEditing = useCallback((next: Editing | null) => {
    live.current.editing = next;
    setEditingState(next);
  }, []);

  /** Every edit lands here: snapshot the current scene, then replace it. */
  const commit = useCallback(
    (next: BoardScene, label: string) => {
      setHistory(pushHistory(historyLive.current, live.current.scene, label));
      putScene(next);
      setLastAction(label);
    },
    [putScene],
  );

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

  const heightReader = (heights: Map<string, number>) => (card: SceneCard) =>
    heights.get(card.id) ?? (card.h || estimateCardHeight(card));

  /* ---------- guides and marquee paint directly to the DOM ---------- */

  const paintGuides = (guides: Guide[]) => {
    const g = refs.guides.current;
    if (g) {
      while (g.firstChild) g.removeChild(g.firstChild);
      for (const guide of guides) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        if (guide.axis === 'x') {
          line.setAttribute('x1', String(guide.pos));
          line.setAttribute('y1', String(guide.from));
          line.setAttribute('x2', String(guide.pos));
          line.setAttribute('y2', String(guide.to));
        } else {
          line.setAttribute('x1', String(guide.from));
          line.setAttribute('y1', String(guide.pos));
          line.setAttribute('x2', String(guide.to));
          line.setAttribute('y2', String(guide.pos));
        }
        g.appendChild(line);
      }
    }
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
    if (autoPanRaf.current) cancelAnimationFrame(autoPanRaf.current);
    autoPanRaf.current = 0;
  };

  const attach = () => {
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  /* ---------- drag ---------- */

  const paintDrag = (s: DragSession) => {
    const { dx, dy } = s;
    const snap = s.snap;
    schedule(() => {
      for (const el of s.els) el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      paintGuides(snap.guides);
    });
  };

  /** Dragging to the canvas edge scrolls the board; the scroll is folded back
     into the drag delta so the object stays under the cursor. */
  const tickAutoPan = () => {
    const s = session.current;
    const area = refs.area.current;
    if (!s || s.kind !== 'drag' || !area) {
      autoPanRaf.current = 0;
      return;
    }
    const rect = area.getBoundingClientRect();
    const edge = 56;
    let fx = 0;
    let fy = 0;
    if (pointer.current.x < rect.left + edge) fx = -(1 - Math.max(0, pointer.current.x - rect.left) / edge);
    else if (pointer.current.x > rect.right - edge) fx = 1 - Math.max(0, rect.right - pointer.current.x) / edge;
    if (pointer.current.y < rect.top + edge) fy = -(1 - Math.max(0, pointer.current.y - rect.top) / edge);
    else if (pointer.current.y > rect.bottom - edge) fy = 1 - Math.max(0, rect.bottom - pointer.current.y) / edge;

    if (Math.abs(fx) > 0.01 || Math.abs(fy) > 0.01) {
      const speed = 12;
      panByScreen(-fx * speed, -fy * speed);
      s.panX += (fx * speed) / s.scale;
      s.panY += (fy * speed) / s.scale;
      const rawX = (pointer.current.x - s.startX) / s.scale + s.panX;
      const rawY = (pointer.current.y - s.startY) / s.scale + s.panY;
      s.dx = rawX;
      s.dy = rawY;
      const box = { ...s.bbox, x: s.bbox.x + rawX, y: s.bbox.y + rawY };
      s.snap = snapMove(box, s.others);
      paintDrag(s);
    }
    autoPanRaf.current = requestAnimationFrame(tickAutoPan);
  };

  const endDrag = () => {
    const s = session.current;
    if (!s || s.kind !== 'drag') return;
    session.current = null;
    detach();
    paintGuides([]);

    if (!s.moved) {
      for (const el of s.els) el.style.transform = '';
      if (s.collapseTo) setSelection([s.collapseTo]);
      return;
    }

    const dx = s.dx + s.snap.dx;
    const dy = s.dy + s.snap.dy;
    const moving = new Set([...s.cardIds, ...s.sectionIds]);
    const current = live.current.scene;
    const next: BoardScene = {
      ...current,
      cards: current.cards.map((card) => {
        if (moving.has(card.id)) {
          const rect = clampRect({
            x: card.x + dx,
            y: card.y + dy,
            w: card.w,
            h: s.heights.get(card.id) ?? (card.h || estimateCardHeight(card)),
          });
          return { ...card, x: rect.x, y: rect.y };
        }
        return card;
      }),
      sections: current.sections.map((section) =>
        moving.has(section.id)
          ? { ...section, x: section.x + dx, y: section.y + dy }
          : section,
      ),
    };
    const label =
      s.cardIds.length + s.sectionIds.length > 1
        ? `Moved ${s.cardIds.length + s.sectionIds.length} objects`
        : s.sectionIds.length === 1
          ? 'Moved a section'
          : 'Moved a card';
    commit(reframe(next, s.heights), label);
  };

  const moveDrag = (e: PointerEvent) => {
    const s = session.current;
    if (!s || s.kind !== 'drag') return;
    pointer.current = { x: e.clientX, y: e.clientY };
    s.dx = (e.clientX - s.startX) / s.scale + s.panX;
    s.dy = (e.clientY - s.startY) / s.scale + s.panY;
    if (Math.abs(e.clientX - s.startX) > 2 || Math.abs(e.clientY - s.startY) > 2) s.moved = true;
    // Snap is resolved against the raw position and only applied on release:
    // the object must never fight the pointer.
    s.snap = snapMove({ ...s.bbox, x: s.bbox.x + s.dx, y: s.bbox.y + s.dy }, s.others);
    paintDrag(s);
  };

  const startDrag = (
    e: React.PointerEvent,
    heights: Map<string, number>,
    cardIds: string[],
    sectionIds: string[],
    collapseTo: string | null,
  ) => {
    const root = refs.scene.current;
    const current = live.current.scene;
    const read = heightReader(heights);
    const els: HTMLElement[] = [];
    const rects: Rect[] = [];
    // A dragged section carries its members: a frame that slides out from under
    // its cards would leave the tint describing the wrong set.
    const members = new Set(cardIds);
    for (const id of sectionIds) {
      for (const card of current.cards) {
        if (card.sectionId === id) members.add(card.id);
      }
    }
    const ids = [...members];
    for (const id of ids) {
      const el = root?.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
      const card = current.cards.find((c) => c.id === id);
      if (!el || !card) continue;
      els.push(el);
      rects.push({ x: card.x, y: card.y, w: card.w, h: read(card) });
    }
    for (const id of sectionIds) {
      const el = root?.querySelector<HTMLElement>(`[data-section-id="${id}"]`);
      const section = current.sections.find((s) => s.id === id);
      if (!el || !section) continue;
      els.push(el);
      rects.push(section);
    }
    if (els.length === 0) return;

    const movingIds = new Set([...ids, ...sectionIds]);
    const others: Rect[] = [
      ...current.cards
        .filter((c) => !movingIds.has(c.id))
        .map((c) => ({ x: c.x, y: c.y, w: c.w, h: read(c) })),
      ...current.sections.filter((s) => !movingIds.has(s.id)),
    ];

    session.current = {
      kind: 'drag',
      startX: e.clientX,
      startY: e.clientY,
      cardIds: ids,
      sectionIds,
      els,
      heights,
      bbox: boundingRect(rects),
      others,
      scale: scale(),
      dx: 0,
      dy: 0,
      panX: 0,
      panY: 0,
      snap: { dx: 0, dy: 0, guides: [] },
      moved: false,
      collapseTo,
    };
    pointer.current = { x: e.clientX, y: e.clientY };
    attach();
    if (!autoPanRaf.current) autoPanRaf.current = requestAnimationFrame(tickAutoPan);
  };

  /* ---------- marquee ---------- */

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

  /* ---------- resize ---------- */

  const endResize = () => {
    const s = session.current;
    if (!s || s.kind !== 'resize') return;
    session.current = null;
    detach();
    const changed =
      Math.abs(s.rect.w - s.base.w) > 0.5 || Math.abs(s.rect.h - s.base.h) > 0.5 ||
      Math.abs(s.rect.x - s.base.x) > 0.5 || Math.abs(s.rect.y - s.base.y) > 0.5;
    if (!changed) {
      s.el.style.width = s.prev.width;
      s.el.style.height = s.prev.height;
      s.el.style.left = s.prev.left;
      s.el.style.top = s.prev.top;
      return;
    }
    const current = live.current.scene;
    if (s.target === 'card') {
      const next = {
        ...current,
        cards: current.cards.map((card) =>
          card.id === s.id ? { ...card, x: s.rect.x, y: s.rect.y, w: s.rect.w, h: s.rect.h } : card,
        ),
      };
      commit(reframe(next, measureHeights()), 'Resized a card');
    } else {
      const next = {
        ...current,
        sections: current.sections.map((section) =>
          section.id === s.id
            ? { ...section, x: s.rect.x, y: s.rect.y, w: s.rect.w, h: s.rect.h }
            : section,
        ),
      };
      commit(reframe(next, measureHeights()), 'Resized a section');
    }
  };

  const moveResize = (e: PointerEvent) => {
    const s = session.current;
    if (!s || s.kind !== 'resize') return;
    const dx = (e.clientX - s.startX) / s.scale;
    const dy = (e.clientY - s.startY) / s.scale;
    const min =
      s.target === 'card' ? { w: 160, h: 52 } : { w: 240, h: 120 };
    s.rect = resizeRect(s.base, s.dir, dx, dy, min, { w: SCENE_W, h: SCENE_H });
    const next = s.rect;
    schedule(() => {
      s.el.style.left = `${next.x}px`;
      s.el.style.top = `${next.y}px`;
      s.el.style.width = `${next.w}px`;
      s.el.style.height = `${next.h}px`;
    });
  };

  /* ---------- link ---------- */

  const endLink = () => {
    const s = session.current;
    if (!s || s.kind !== 'link') return;
    session.current = null;
    detach();
    setLinkPreview(null);
    const current = live.current.scene;

    if (s.target) {
      const exists = current.edges.some(
        (edge) => edge.from === s.from && edge.to === s.target?.id && edge.fromSide === s.fromSide,
      );
      if (exists) {
        setLastAction('That edge already exists');
        return;
      }
      const edge: SceneEdge = {
        id: `e-${Date.now().toString(36)}`,
        from: s.from,
        to: s.target.id,
        fromSide: s.fromSide,
        toSide: s.target.side,
        shape: 'curve',
        direction: 'none',
      };
      commit({ ...current, edges: [...current.edges, edge] }, 'Connected two objects');
      setSelection([edge.id]);
      return;
    }

    if (Math.hypot(s.point.x - s.start.x, s.point.y - s.start.y) < 8) return;
    // Released on blank canvas: place a card there and connect it, so a map can
    // grow from an edge instead of from the toolbar.
    const card = createCardAt({ x: s.point.x - 60, y: s.point.y - 30 }, nextId(current, 'c'), current.sections);
    const opposite: Side = s.fromSide === 'l' ? 'r' : s.fromSide === 'r' ? 'l' : s.fromSide === 't' ? 'b' : 't';
    const edge: SceneEdge = {
      id: `e-${Date.now().toString(36)}`,
      from: s.from,
      to: card.id,
      fromSide: s.fromSide,
      toSide: opposite,
      shape: 'curve',
      direction: 'none',
    };
    const next = reframe(
      { ...current, cards: [...current.cards, { ...card, title: '' }], edges: [...current.edges, edge] },
      new Map(),
    );
    commit(next, 'Added a linked card');
    setSelection([card.id]);
    setEditing({ kind: 'card', id: card.id, title: '', body: '' });
  };

  const moveLink = (e: PointerEvent) => {
    const s = session.current;
    if (!s || s.kind !== 'link') return;
    const p = pointOf(e.clientX, e.clientY);
    s.point = p;
    const current = live.current.scene;
    let target: { id: string; side: Side } | null = null;
    for (let i = current.cards.length - 1; i >= 0; i -= 1) {
      const card = current.cards[i];
      if (!card || card.id === s.from) continue;
      const el = refs.scene.current?.querySelector<HTMLElement>(`[data-card-id="${card.id}"]`);
      const h = el?.offsetHeight ?? (card.h || estimateCardHeight(card));
      if (pointInRect(p, { x: card.x, y: card.y, w: card.w, h })) {
        target = { id: card.id, side: nearestSide({ ...card, h }, p) };
        break;
      }
    }
    s.target = target;
    setLinkPreview({
      from: anchorOf(objectRect(current, s.from) ?? { x: 0, y: 0, w: 0, h: 0 }, s.fromSide),
      to: target ? anchorOf(objectRect(current, target.id) ?? { x: 0, y: 0, w: 0, h: 0 }, target.side) : p,
      side: s.fromSide,
      toSide: target?.side ?? s.fromSide,
    });
  };

  /* ---------- bend ---------- */

  const moveBend = (e: PointerEvent) => {
    const s = session.current;
    if (!s || s.kind !== 'bend') return;
    const current = live.current.scene;
    const edge = current.edges.find((x) => x.id === s.id);
    if (!edge) return;
    const from = objectRect(current, edge.from);
    const to = objectRect(current, edge.to);
    if (!from || !to) return;
    const p = pointOf(e.clientX, e.clientY);
    const mid = edgeMid(anchorOf(from, edge.fromSide), anchorOf(to, edge.toSide), edge.fromSide, edge.toSide);
    const bend = { x: Math.round(p.x - mid.x), y: Math.round(p.y - mid.y) };
    s.point = p;
    schedule(() => {
      putScene({
        ...current,
        edges: current.edges.map((x) => (x.id === s.id ? { ...x, bend } : x)),
      });
    });
  };

  const endBend = () => {
    const s = session.current;
    if (!s || s.kind !== 'bend') return;
    session.current = null;
    detach();
    const after = live.current.scene;
    const before = s.before.edges.find((e) => e.id === s.id)?.bend;
    const now = after.edges.find((e) => e.id === s.id)?.bend;
    if ((before?.x ?? 0) === (now?.x ?? 0) && (before?.y ?? 0) === (now?.y ?? 0)) return;
    // The drag wrote the scene directly so the curve followed the pointer; the
    // history entry still records the shape it had before the drag started.
    setHistory(pushHistory(historyLive.current, s.before, 'Bent an edge'));
    setLastAction('Bent an edge');
  };

  /* ---------- pointer wiring ---------- */

  const onMove = (e: PointerEvent) => {
    const s = session.current;
    if (!s) return;
    if (s.kind === 'drag') moveDrag(e);
    else if (s.kind === 'marquee') moveMarquee(e);
    else if (s.kind === 'resize') moveResize(e);
    else if (s.kind === 'link') moveLink(e);
    else moveBend(e);
  };

  const onUp = () => {
    const s = session.current;
    if (!s) return;
    if (s.kind === 'drag') endDrag();
    else if (s.kind === 'marquee') endMarquee();
    else if (s.kind === 'resize') endResize();
    else if (s.kind === 'link') endLink();
    else endBend();
  };

  /** Committing before a new gesture means a click anywhere saves the open
      editor; nothing the user typed is lost by clicking away. */
  const commitEditing = useCallback(() => {
    const current = live.current.editing;
    if (!current) return;
    setEditing(null);
    const sceneNow = live.current.scene;
    if (current.kind === 'card') {
      const card = sceneNow.cards.find((c) => c.id === current.id);
      if (!card) return;
      const lines = current.body
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const title = current.title.trim();
      if (!title && lines.length === 0) {
        // An empty new card is not work; dropping it keeps the undo stack free
        // of steps the user cannot see. Its edges go with it: an edge to a card
        // that is not there any more would still be counted in the badge while
        // drawing nothing.
        commit(
          {
            ...sceneNow,
            cards: sceneNow.cards.filter((c) => c.id !== current.id),
            edges: sceneNow.edges.filter((e) => e.from !== current.id && e.to !== current.id),
          },
          'Discarded an empty card',
        );
        setSelection([]);
        return;
      }
      if (title === card.title && lines.join('\n') === card.lines.join('\n')) return;
      const renamed = current.title !== card.title;
      commit(
        {
          ...sceneNow,
          cards: sceneNow.cards.map((c) => (c.id === current.id ? { ...c, title: title || 'Untitled', lines } : c)),
        },
        renamed ? 'Renamed a card' : 'Edited a card',
      );
      return;
    }
    const section = sceneNow.sections.find((s) => s.id === current.id);
    if (!section || section.title === current.title.trim()) return;
    commit(
      {
        ...sceneNow,
        sections: sceneNow.sections.map((s) =>
          s.id === current.id ? { ...s, title: current.title.trim() || 'Untitled section' } : s,
        ),
      },
      'Renamed a section',
    );
  }, [commit, setEditing, setSelection]);

  const openCard = useCallback(
    (id: string) => {
      const card = live.current.scene.cards.find((c) => c.id === id);
      if (!card) return;
      setEditing({ kind: 'card', id, title: card.title, body: card.lines.join('\n') });
    },
    [setEditing],
  );

  const selectEdge = useCallback(
    (id: string) => {
      setSelection([id]);
    },
    [setSelection],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (live.current.editing) {
      const insideEditor = target.closest('[data-editor]');
      if (!insideEditor) commitEditing();
    }
    setContextMenu(null);
    const cardEl = target.closest<HTMLElement>('[data-card-id]');
    const sectionEl = target.closest<HTMLElement>('[data-section-id]');
    const handle = target.closest<HTMLElement>('[data-resize]');
    const anchor = target.closest<HTMLElement>('[data-anchor]');
    const toolNow = tool;

    // A click inside the open editor belongs to the input.
    if (cardEl && live.current.editing?.kind === 'card' && cardEl.dataset.cardId === live.current.editing.id) {
      return;
    }

    if (anchor) {
      const owner = anchor.closest<HTMLElement>('[data-card-id], [data-section-id]');
      const from = owner?.dataset.cardId ?? owner?.dataset.sectionId ?? '';
      const side = (anchor.dataset.anchor ?? 'r') as Side;
      const p = pointOf(e.clientX, e.clientY);
      session.current = { kind: 'link', from, fromSide: side, start: p, point: p, target: null };
      setSelection([]);
      attach();
      return;
    }

    const heights = measureHeights();

    if (handle) {
      const owner = handle.closest<HTMLElement>('[data-card-id], [data-section-id]');
      const dir = (handle.dataset.resize ?? 'se') as ResizeDir;
      if (!owner) return;
      const isCard = !!owner.dataset.cardId;
      const id = owner.dataset.cardId ?? owner.dataset.sectionId ?? '';
      const base = isCard
        ? (() => {
            const card = live.current.scene.cards.find((c) => c.id === id);
            return card ? { x: card.x, y: card.y, w: card.w, h: heights.get(id) ?? (card.h || estimateCardHeight(card)) } : null;
          })()
        : live.current.scene.sections.find((s) => s.id === id) ?? null;
      if (!base) return;
      session.current = {
        kind: 'resize',
        target: isCard ? 'card' : 'section',
        id,
        dir,
        el: owner,
        scale: scale(),
        startX: e.clientX,
        startY: e.clientY,
        base: { x: base.x, y: base.y, w: base.w, h: base.h },
        rect: { x: base.x, y: base.y, w: base.w, h: base.h },
        prev: { width: owner.style.width, height: owner.style.height, left: owner.style.left, top: owner.style.top },
      };
      attach();
      return;
    }

    if (toolNow === 'card') {
      addCardAt(pointOf(e.clientX, e.clientY));
      return;
    }
    if (toolNow === 'section') {
      addSectionAt(pointOf(e.clientX, e.clientY));
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
      startDrag(
        e,
        heights,
        ids.filter((x) => live.current.scene.cards.some((c) => c.id === x)),
        ids.filter((x) => live.current.scene.sections.some((s) => s.id === x)),
        collapseTo,
      );
      return;
    }

    if (sectionEl) {
      // Only the section's capsule is a drag handle; its body belongs to the
      // canvas so a marquee can start inside a section.
      const id = sectionEl.dataset.sectionId ?? '';
      const selected = live.current.selection;
      const ids = e.shiftKey
        ? selected.includes(id)
          ? selected.filter((x) => x !== id)
          : [...selected, id]
        : [id];
      setSelection(ids);
      if (ids.includes(id)) startDrag(e, heights, [], [id], null);
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
      openCard(id);
      return;
    }
    if (target.closest('[data-section-id]')) return;
    addCardAt(pointOf(e.clientX, e.clientY));
  };

  /* ---------- commands ---------- */

  const addCardAt = useCallback(
    (at: Point) => {
      const current = live.current.scene;
      const card = createCardAt(at, nextId(current, 'c'), current.sections);
      commit({ ...current, cards: [...current.cards, card] }, 'Added a card');
      setSelection([card.id]);
      setEditing({ kind: 'card', id: card.id, title: '', body: '' });
    },
    [commit, setEditing, setSelection],
  );

  const addSectionAt = useCallback(
    (at: Point) => {
      const current = live.current.scene;
      const section = createSectionAt(at, nextId(current, 's'));
      commit({ ...current, sections: [...current.sections, section] }, 'Added a section');
      setSelection([section.id]);
      setEditing({ kind: 'section', id: section.id, title: section.title });
    },
    [commit, setEditing, setSelection],
  );

  const deleteSelection = useCallback(() => {
    const ids = new Set(live.current.selection);
    if (ids.size === 0) return;
    const current = live.current.scene;
    const cards = current.cards.filter((c) => !ids.has(c.id));
    const sections = current.sections.filter((s) => !ids.has(s.id));
    const edges = current.edges.filter(
      (edge) => !ids.has(edge.id) && !ids.has(edge.from) && !ids.has(edge.to),
    );
    // Cards keep their place when their section frame is deleted; only the
    // frame goes. They become unassigned rather than vanishing with it.
    const orphaned = cards.map((card) =>
      ids.has(card.sectionId) ? { ...card, sectionId: '' } : card,
    );
    commit({ ...current, cards: orphaned, sections, edges }, ids.size > 1 ? `Deleted ${ids.size} objects` : 'Deleted an object');
    setSelection([]);
  }, [commit, setSelection]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      const current = live.current.scene;
      const ids = new Set(live.current.selection);
      const heights = measureHeights();
      let touched = 0;
      const cards = current.cards.map((card) => {
        if (!ids.has(card.id)) return card;
        touched += 1;
        const rect = clampRect({
          x: card.x + dx,
          y: card.y + dy,
          w: card.w,
          h: heights.get(card.id) ?? (card.h || estimateCardHeight(card)),
        });
        return { ...card, x: rect.x, y: rect.y };
      });
      const sections = current.sections.map((section) => {
        if (!ids.has(section.id)) return section;
        touched += 1;
        return { ...section, x: section.x + dx, y: section.y + dy };
      });
      if (touched === 0) return;
      commit(reframe({ ...current, cards, sections }, heights), 'Nudged');
    },
    [commit],
  );

  const duplicate = useCallback(() => {
    const current = live.current.scene;
    const ids = new Set(live.current.selection);
    const originals = current.cards.filter((card) => ids.has(card.id));
    if (originals.length === 0) return;
    const stamp = Date.now().toString(36).slice(-4);
    const copies = originals.map((card, index) => ({
      ...card,
      id: nextId(current, `c${stamp}${index}`),
      x: card.x + 24,
      y: card.y + 24,
    }));
    commit(reframe({ ...current, cards: [...current.cards, ...copies] }, measureHeights()), 'Duplicated');
    setSelection(copies.map((card) => card.id));
  }, [commit, setSelection]);

  const setColor = useCallback(
    (color: CardColor) => {
      const current = live.current.scene;
      const ids = new Set(live.current.selection);
      if (ids.size === 0) return;
      const cards = current.cards.map((card) => (ids.has(card.id) ? { ...card, color } : card));
      const sections = current.sections.map((section) => (ids.has(section.id) ? { ...section, color } : section));
      commit({ ...current, cards, sections }, `Colour · ${color}`);
    },
    [commit],
  );

  const toggleFold = useCallback(() => {
    const current = live.current.scene;
    const ids = new Set(live.current.selection);
    let anyOpen = false;
    for (const card of current.cards) {
      if (ids.has(card.id) && !card.folded) anyOpen = true;
    }
    if (!anyOpen && current.sections.some((s) => ids.has(s.id) && !s.collapsed)) anyOpen = true;
    const cards = current.cards.map((card) =>
      ids.has(card.id) ? { ...card, folded: anyOpen, h: anyOpen ? 0 : card.h } : card,
    );
    const sections = current.sections.map((section) =>
      ids.has(section.id) ? { ...section, collapsed: anyOpen } : section,
    );
    commit(reframe({ ...current, cards, sections }, measureHeights()), anyOpen ? 'Folded' : 'Unfolded');
  }, [commit]);

  const align = useCallback(
    (mode: AlignMode) => {
      const current = live.current.scene;
      const ids = new Set(live.current.selection);
      const heights = measureHeights();
      const read = heightReader(heights);
      const targets: Array<{ kind: 'card' | 'section'; id: string; rect: Rect }> = [
        ...current.cards.filter((c) => ids.has(c.id)).map((c) => ({ kind: 'card' as const, id: c.id, rect: { ...c, h: read(c) } })),
        ...current.sections.filter((s) => ids.has(s.id)).map((s) => ({ kind: 'section' as const, id: s.id, rect: s })),
      ];
      if (targets.length < 2) return;
      const aligned = alignRects(targets.map((t) => t.rect), mode);
      const byId = new Map(targets.map((t, i) => [t.id, aligned[i] as Rect]));
      const next = {
        ...current,
        cards: current.cards.map((card) => {
          const rect = byId.get(card.id);
          return rect ? { ...card, x: rect.x, y: rect.y } : card;
        }),
        sections: current.sections.map((section) => {
          const rect = byId.get(section.id);
          return rect ? { ...section, x: rect.x, y: rect.y } : section;
        }),
      };
      commit(reframe(next, heights), 'Aligned');
    },
    [commit],
  );

  const distribute = useCallback(
    (axis: 'h' | 'v') => {
      const current = live.current.scene;
      const ids = new Set(live.current.selection);
      const heights = measureHeights();
      const read = heightReader(heights);
      const targets: Array<{ kind: 'card' | 'section'; id: string; rect: Rect }> = [
        ...current.cards.filter((c) => ids.has(c.id)).map((c) => ({ kind: 'card' as const, id: c.id, rect: { ...c, h: read(c) } })),
        ...current.sections.filter((s) => ids.has(s.id)).map((s) => ({ kind: 'section' as const, id: s.id, rect: s })),
      ];
      if (targets.length < 3) return;
      const result = distributeRects(targets.map((t) => t.rect), axis);
      if (result.gap < 8) {
        setLastAction('No room to distribute — the selection is already tight');
        return;
      }
      const byId = new Map(targets.map((t, i) => [t.id, result.rects[i] as Rect]));
      const next = {
        ...current,
        cards: current.cards.map((card) => {
          const rect = byId.get(card.id);
          return rect ? { ...card, x: rect.x, y: rect.y } : card;
        }),
        sections: current.sections.map((section) => {
          const rect = byId.get(section.id);
          return rect ? { ...section, x: rect.x, y: rect.y } : section;
        }),
      };
      commit(reframe(next, heights), 'Distributed');
    },
    [commit],
  );

  const updateEdge = useCallback(
    (id: string, patch: Partial<Pick<SceneEdge, 'shape' | 'direction' | 'label'>>) => {
      const current = live.current.scene;
      commit(
        { ...current, edges: current.edges.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge)) },
        patch.label !== undefined ? 'Renamed an edge' : 'Changed an edge',
      );
    },
    [commit],
  );

  const startBend = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      session.current = {
        kind: 'bend',
        id,
        point: pointOf(e.clientX, e.clientY),
        before: live.current.scene,
      };
      attach();
    },
    [attach, pointOf],
  );

  const resetBend = useCallback(
    (id: string) => {
      const current = live.current.scene;
      commit(
        { ...current, edges: current.edges.map((edge) => (edge.id === id ? { ...edge, bend: undefined } : edge)) },
        'Straightened an edge',
      );
    },
    [commit],
  );

  const undo = useCallback(() => {
    const result = undoHistory(historyLive.current, live.current.scene);
    if (!result) return;
    setHistory(result.history);
    putScene(result.scene);
    setSelection([]); // documented: undo clears selection, so the change is visible
    setLastAction(`Undo · ${result.label}`);
  }, [putScene, setSelection]);

  const redo = useCallback(() => {
    const result = redoHistory(historyLive.current, live.current.scene);
    if (!result) return;
    setHistory(result.history);
    putScene(result.scene);
    setSelection([]);
    setLastAction(`Redo · ${result.label}`);
  }, [putScene, setSelection]);

  const reset = useCallback(() => {
    historyLive.current = emptyHistory;
    setHistory(emptyHistory);
    // putScene schedules a save; clearing afterwards cancels it, so "reset"
    // leaves no stored copy behind to fight the sample on the next visit.
    putScene(initial);
    store?.clear(initial.id);
    setSelection([]);
    setEditing(null);
    setLastAction('Reset to sample');
  }, [initial, putScene, setEditing, setSelection, store]);

  const selectAll = useCallback(() => {
    const current = live.current.scene;
    setSelection([...current.cards.map((c) => c.id), ...current.sections.map((s) => s.id)]);
  }, [setSelection]);

  const openContextMenu = useCallback(
    (e: React.MouseEvent, targetId: string | null) => {
      e.preventDefault();
      e.stopPropagation();
      if (targetId) {
        if (!live.current.selection.includes(targetId)) setSelection([targetId]);
        setContextMenu({ x: e.clientX, y: e.clientY, target: 'object' });
      } else {
        setSelection([]);
        setContextMenu({ x: e.clientX, y: e.clientY, target: 'blank' });
      }
    },
    [setSelection],
  );

  /* ---------- effects ---------- */

  // Between renders the objects carry inline transforms from a drag that has
  // now been committed to the scene; clearing before paint hides the handover.
  useLayoutEffect(() => {
    const root = refs.scene.current;
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>('[data-card-id]')) {
      if (el.style.transform) el.style.transform = '';
    }
    for (const el of root.querySelectorAll<HTMLElement>('[data-section-id]')) {
      if (el.style.transform) el.style.transform = '';
    }
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || live.current.editing) return;
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
      if (meta && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        selectAll();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (live.current.selection.length === 0) return;
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (e.key === 'Escape') {
        setContextMenu(null);
        setToolState('select');
        if (live.current.selection.length > 0) {
          e.preventDefault();
          setSelection([]);
        }
        return;
      }
      if (e.key.toLowerCase() === 'f' && live.current.selection.length > 0) {
        toggleFold();
        return;
      }
      if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 's') {
        const area = refs.area.current;
        const rect = area?.getBoundingClientRect();
        const at = rect
          ? pointOf(rect.left + rect.width / 2, rect.top + rect.height / 2)
          : { x: 200, y: 200 };
        e.preventDefault();
        if (e.key.toLowerCase() === 'n') addCardAt(at);
        else addSectionAt(at);
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
  }, [
    addCardAt,
    addSectionAt,
    deleteSelection,
    nudge,
    pointOf,
    redo,
    refs.area,
    selectAll,
    setSelection,
    toggleFold,
    undo,
  ]);

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

  const selectedCards = scene.cards.filter((c) => selection.includes(c.id));
  const selectedSections = scene.sections.filter((s) => selection.includes(s.id));
  const selectedEdge = selection.length === 1 ? scene.edges.find((e) => e.id === selection[0]) ?? null : null;

  return {
    scene,
    selection,
    selectedCards,
    selectedSections,
    selectedEdge,
    editing,
    tool,
    linkPreview,
    contextMenu,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    lastAction,
    onPointerDown,
    onDoubleClick,
    onContextMenu: openContextMenu,
    dismissMenu: () => setContextMenu(null),
    undo,
    redo,
    reset,
    nudge,
    deleteSelection,
    duplicate,
    setColor,
    toggleFold,
    align,
    distribute,
    updateEdge,
    startBend,
    resetBend,
    setSelection,
    selectEdge,
    selectAll,
    setTool: setToolState,
    setEditing,
    openCard,
    commitEditing,
    addCardAt,
    addSectionAt,
  };
}

function objectRect(scene: BoardScene, id: string): Rect | null {
  const card = scene.cards.find((c) => c.id === id);
  if (card) return { x: card.x, y: card.y, w: card.w, h: card.h || estimateCardHeight(card) };
  const section = scene.sections.find((s) => s.id === id);
  return section ? { x: section.x, y: section.y, w: section.w, h: section.h } : null;
}
