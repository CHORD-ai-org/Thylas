/* Board edit commands and a bounded undo stack. Every mutation goes through
   `applyEdit`, including keyboard nudges and delete, so there is exactly one
   way a card can change and exactly one way it can be reversed. Pure: no
   React, no storage. */

import type { BoardScene, SceneCard } from './scene';

export type CardEdit =
  | { kind: 'create'; card: SceneCard }
  | { kind: 'delete'; entries: Array<{ index: number; card: SceneCard }> }
  | { kind: 'move'; moves: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }> }
  | { kind: 'resize'; id: string; from: { w: number; h: number }; to: { w: number; h: number } }
  | { kind: 'title'; id: string; from: string; to: string };

export type Direction = 'do' | 'undo';

export function applyEdit(scene: BoardScene, edit: CardEdit, direction: Direction): BoardScene {
  const forward = direction === 'do';
  switch (edit.kind) {
    case 'create': {
      const cards = forward
        ? [...scene.cards, edit.card]
        : scene.cards.filter((c) => c.id !== edit.card.id);
      return { ...scene, cards };
    }
    case 'delete': {
      if (forward) {
        const gone = new Set(edit.entries.map((e) => e.card.id));
        return { ...scene, cards: scene.cards.filter((c) => !gone.has(c.id)) };
      }
      // Reinsert by original index so z-order survives an undo.
      const cards = [...scene.cards];
      for (const { index, card } of [...edit.entries].sort((a, b) => a.index - b.index)) {
        cards.splice(Math.min(index, cards.length), 0, card);
      }
      return { ...scene, cards };
    }
    case 'move': {
      const by = new Map(edit.moves.map((m) => [m.id, forward ? m.to : m.from]));
      return {
        ...scene,
        cards: scene.cards.map((c) => {
          const p = by.get(c.id);
          return p ? { ...c, x: p.x, y: p.y } : c;
        }),
      };
    }
    case 'resize': {
      const size = forward ? edit.to : edit.from;
      return {
        ...scene,
        cards: scene.cards.map((c) => (c.id === edit.id ? { ...c, w: size.w, h: size.h } : c)),
      };
    }
    case 'title': {
      const title = forward ? edit.to : edit.from;
      return {
        ...scene,
        cards: scene.cards.map((c) => (c.id === edit.id ? { ...c, title } : c)),
      };
    }
  }
}

export function editLabel(edit: CardEdit): string {
  switch (edit.kind) {
    case 'create':
      return 'Card added';
    case 'delete':
      return edit.entries.length === 1 ? 'Card deleted' : `${edit.entries.length} cards deleted`;
    case 'move':
      return edit.moves.length === 1 ? 'Moved' : `Moved ${edit.moves.length}`;
    case 'resize':
      return 'Resized';
    case 'title':
      return 'Title changed';
  }
}

export const HISTORY_LIMIT = 50;

export type History = { past: CardEdit[]; future: CardEdit[] };

export const emptyHistory: History = { past: [], future: [] };

export function pushEdit(history: History, edit: CardEdit, limit = HISTORY_LIMIT): History {
  const past = [...history.past, edit];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, future: [] };
}

export function undoEdit(history: History): { history: History; edit: CardEdit } | null {
  if (history.past.length === 0) return null;
  const edit = history.past[history.past.length - 1];
  if (!edit) return null;
  return {
    history: { past: history.past.slice(0, -1), future: [edit, ...history.future] },
    edit,
  };
}

export function redoEdit(history: History): { history: History; edit: CardEdit } | null {
  if (history.future.length === 0) return null;
  const edit = history.future[0];
  if (!edit) return null;
  return {
    history: { past: [...history.past, edit], future: history.future.slice(1) },
    edit,
  };
}
