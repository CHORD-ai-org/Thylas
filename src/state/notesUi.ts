/**
 * Notes workspace UI state: which sidebar view is open and whether the panel
 * is collapsed. Persisted under its own versioned envelope — the note store
 * holds documents, not layout (NAV-PLAN §2).
 */
import { useSyncExternalStore } from 'react';

const KEY = 'thylas:notes-ui:v1';

export type NotesView = 'files' | 'search' | 'bookmarks';

type State = { view: NotesView; collapsed: boolean };

const VIEWS: NotesView[] = ['files', 'search', 'bookmarks'];

function read(): State {
  const fallback: State = {
    view: 'files',
    collapsed: typeof window !== 'undefined' && window.innerWidth < 900,
  };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const p = parsed as { version?: unknown; view?: unknown; collapsed?: unknown };
    if (p.version !== 1) return fallback;
    return {
      view: typeof p.view === 'string' && VIEWS.includes(p.view as NotesView) ? (p.view as NotesView) : fallback.view,
      collapsed: typeof p.collapsed === 'boolean' ? p.collapsed : fallback.collapsed,
    };
  } catch {
    return fallback;
  }
}

let snapshot: State = read();
const listeners = new Set<() => void>();

function commit(next: State): void {
  snapshot = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, ...snapshot }));
    } catch {
      /* quota: the session keeps working in memory */
    }
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNotesUi(): State {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function setNotesView(view: NotesView): void {
  commit({ view, collapsed: false });
}

export function toggleNotesPanel(): void {
  commit({ ...snapshot, collapsed: !snapshot.collapsed });
}

export function resetNotesUi(): void {
  commit({ view: 'files', collapsed: false });
}

/** Test seam. */
export function __readForTest(): State {
  return read();
}
