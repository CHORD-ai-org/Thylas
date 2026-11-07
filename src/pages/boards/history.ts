/* Undo history as labelled scene snapshots.

   SP-06c stored inverse edits (move back, re-insert at index, restore title).
   That worked for one object kind; with cards, sections and edges, every new
   command would need a hand-written inverse, and a single wrong inverse
   corrupts the board silently. A snapshot is one array of cards — a few
   hundred KB at worst — and it cannot be wrong.

   The label travels with the snapshot so the status bar can say what an undo
   will do instead of just "Undo". */

import type { BoardScene } from './scene';

export const HISTORY_LIMIT = 40;

export type HistoryEntry = { scene: BoardScene; label: string };
export type History = { past: HistoryEntry[]; future: HistoryEntry[] };

export const emptyHistory: History = { past: [], future: [] };

/** Record the state *before* an edit. Any new edit drops the redo stack: a
   redo that no longer matches the document is a lie. */
export function pushHistory(history: History, before: BoardScene, label: string): History {
  return {
    past: [...history.past, { scene: before, label }].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export function undoHistory(
  history: History,
  current: BoardScene,
): { history: History; scene: BoardScene; label: string } | null {
  const entry = history.past[history.past.length - 1];
  if (!entry) return null;
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [{ scene: current, label: entry.label }, ...history.future].slice(0, HISTORY_LIMIT),
    },
    scene: entry.scene,
    label: entry.label,
  };
}

export function redoHistory(
  history: History,
  current: BoardScene,
): { history: History; scene: BoardScene; label: string } | null {
  const entry = history.future[0];
  if (!entry) return null;
  return {
    history: {
      past: [...history.past, { scene: current, label: entry.label }].slice(-HISTORY_LIMIT),
      future: history.future.slice(1),
    },
    scene: entry.scene,
    label: entry.label,
  };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}
