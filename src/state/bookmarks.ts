/**
 * Note bookmarks — session facts under their own envelope. Kept separate from
 * `thylas:notes:v1` so the note contract never changes (NAV-PLAN §5).
 * Bookmarks are user-level: they intentionally ignore workspace scope.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'thylas:bookmarks:v1';
const MAX = 200;

type State = { ids: string[] };

function read(): State {
  if (typeof localStorage === 'undefined') return { ids: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ids: [] };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ids: [] };
    const p = parsed as { version?: unknown; ids?: unknown };
    if (p.version !== 1 || !Array.isArray(p.ids)) return { ids: [] };
    /* Duplicates and non-strings lose, not the whole library. */
    return { ids: [...new Set(p.ids.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, MAX) };
  } catch {
    return { ids: [] };
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

export function useBookmarks(): State {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function bookmarkedIds(): string[] {
  return snapshot.ids;
}

export function isBookmarked(noteId: string): boolean {
  return snapshot.ids.includes(noteId);
}

export function toggleBookmark(noteId: string): void {
  const ids = snapshot.ids.includes(noteId)
    ? snapshot.ids.filter((id) => id !== noteId)
    : [...snapshot.ids, noteId].slice(-MAX);
  commit({ ids });
}

export function resetBookmarks(): void {
  commit({ ids: [] });
}

/** Test seam. */
export function __readForTest(): State {
  return read();
}
