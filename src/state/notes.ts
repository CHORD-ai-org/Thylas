/**
 * Notes, with the durable truth in the browser's local database (IndexedDB)
 * and a synchronous localStorage mirror in front of it.
 *
 * Why a database: notes must survive a reload, a restart, and a localStorage
 * wipe, and hold more than a few hundred kilobytes. IndexedDB does all that
 * locally with no server. The localStorage mirror keeps the synchronous reads
 * the list needs on first paint, and carries any pre-existing notes across on
 * first launch (a migration, not a re-seed).
 *
 * `version` is the conflict detector. Two saves in the same millisecond still
 * collide, which a timestamp could not guarantee.
 */
import { useSyncExternalStore } from 'react';
import { NOTE_SEEDS } from '../data/note-seed';
import type { Note, NoteIndexEntry } from '../data/types';
import { notesDb } from '../services/notes/localDb';

const INDEX_KEY = 'thylas:notes:v1';
const noteKey = (id: string) => `thylas:note:v1:${id}`;

const scopeKey = (note: Pick<Note, 'scope' | 'wsId'>): string =>
  note.scope === 'personal' ? 'personal' : `ws:${note.wsId ?? ''}`;

const toEntry = (note: Note): NoteIndexEntry => ({
  id: note.id,
  title: note.title,
  scope: note.scope,
  ...(note.wsId === undefined ? {} : { wsId: note.wsId }),
  updatedAt: note.updatedAt,
});

function readNote(id: string): Note | null {
  try {
    const raw = localStorage.getItem(noteKey(id));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Partial<Note>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.body !== 'string' ||
      typeof candidate.version !== 'number' ||
      typeof candidate.updatedAt !== 'number' ||
      (candidate.scope !== 'personal' && candidate.scope !== 'workspace')
    ) {
      return null;
    }
    return candidate as Note;
  } catch {
    return null;
  }
}

const hasStorage = (): boolean => typeof localStorage !== 'undefined';

function writeNote(note: Note): void {
  if (hasStorage()) {
    try {
      localStorage.setItem(noteKey(note.id), JSON.stringify(note));
    } catch {
      /* quota: the local database is still the durable copy */
    }
  }
  void notesDb().put(note).catch(() => {
    /* a failing local database must not break a save the surface already accepted */
  });
}

function writeIndex(notes: Note[]): void {
  if (!hasStorage()) return;
  localStorage.setItem(INDEX_KEY, JSON.stringify({ version: 1, entries: notes.map(toEntry) }));
}

function readIndexIds(): string[] | null {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const entries =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { entries?: unknown }).entries
        : null;
    if (!Array.isArray(entries)) return null;
    return entries
      .map((entry) => (typeof entry === 'object' && entry !== null ? (entry as { id?: unknown }).id : null))
      .filter((id): id is string => typeof id === 'string');
  } catch {
    return null;
  }
}

function loadFresh(): Note[] {
  /* No Storage (a unit test, a prerender): the seeds are the truth. Writing
     them would throw, and a count that throws is worse than a count of samples. */
  if (!hasStorage()) return [...NOTE_SEEDS];
  const ids = readIndexIds();
  if (ids === null) {
    /* First run: write the seeds, so what the surface shows is stored state and
       an edit is possible from the first frame. */
    for (const note of NOTE_SEEDS) writeNote(note);
    writeIndex(NOTE_SEEDS);
    return [...NOTE_SEEDS];
  }
  const notes: Note[] = [];
  for (const id of ids) {
    const note = readNote(id);
    if (note) notes.push(note);
  }
  return notes;
}

let snapshot: Note[] | null = null;
const listeners = new Set<() => void>();

function read(): Note[] {
  snapshot ??= loadFresh();
  return snapshot;
}

function commit(next: Note[]): void {
  snapshot = next;
  writeIndex(next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * One reconciliation between the synchronous cache and the local database,
 * run once at startup. The database wins on a shared note by recency; a note
 * only the cache holds is pushed into the database so nothing is lost to a
 * localStorage wipe. The result is written back to both sides.
 */
let hydrated: Promise<void> | null = null;

function hydrate(): Promise<void> {
  hydrated ??= (async () => {
    const db = notesDb();
    const before = read();
    const stored = await db.getAll().catch(() => [] as Note[]);
    const merged = new Map<string, Note>();
    for (const note of before) merged.set(note.id, note);
    for (const note of stored) {
      const existing = merged.get(note.id);
      if (!existing || note.updatedAt > existing.updatedAt) merged.set(note.id, note);
    }
    const notes = [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    /* Migration and drift repair: the database becomes the complete copy. */
    for (const note of notes) await db.put(note).catch(() => {});
    /* Nothing new to publish to the mirror — leave the snapshot alone. */
    const changed =
      notes.length !== before.length ||
      notes.some((note) => {
        const old = before.find((b) => b.id === note.id);
        return !old || old.version !== note.version || old.updatedAt !== note.updatedAt;
      });
    if (!changed) return;
    for (const note of notes) {
      if (hasStorage()) {
        try {
          localStorage.setItem(noteKey(note.id), JSON.stringify(note));
        } catch {
          /* quota: the database is still the durable copy */
        }
      }
    }
    writeIndex(notes);
    snapshot = notes;
    for (const listener of listeners) listener();
  })();
  return hydrated;
}

/** Test seam: resolves once the startup reconciliation has finished. */
export function whenNotesHydrated(): Promise<void> {
  return hydrate();
}

const getSnapshot = (): Note[] => read();

export function listNotes(): Note[] {
  return read();
}

export function getNoteById(id: string): Note | undefined {
  return read().find((note) => note.id === id);
}

export type SaveResult = { ok: true; note: Note } | { ok: false; conflict: true; theirs: Note };

export function saveNote(id: string, body: string, expectedVersion: number): SaveResult {
  const notes = read();
  const stored = notes.find((note) => note.id === id);
  if (!stored) {
    throw new Error(`saveNote: no note ${id}`);
  }
  if (stored.version !== expectedVersion) {
    return { ok: false, conflict: true, theirs: stored };
  }
  const saved: Note = { ...stored, body, version: stored.version + 1, updatedAt: Date.now() };
  writeNote(saved);
  commit(notes.map((note) => (note.id === id ? saved : note)));
  return { ok: true, note: saved };
}

function uniqueTitle(notes: Note[], title: string, scope: string, exceptId?: string): boolean {
  const wanted = title.trim().toLowerCase();
  return !notes.some(
    (note) => note.id !== exceptId && scopeKey(note) === scope && note.title.trim().toLowerCase() === wanted,
  );
}

export function createNote(input: {
  scope: 'personal' | 'workspace';
  wsId?: string;
  title?: string;
}): Note {
  const notes = read();
  const base = (input.title ?? 'Untitled').trim() || 'Untitled';
  const scope = input.scope === 'personal' ? 'personal' : `ws:${input.wsId ?? ''}`;
  let title = base;
  let counter = 2;
  while (!uniqueTitle(notes, title, scope)) {
    title = `${base} ${counter}`;
    counter += 1;
  }
  const note: Note = {
    id: `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    scope: input.scope,
    ...(input.wsId === undefined ? {} : { wsId: input.wsId }),
    body: '',
    version: 1,
    updatedAt: Date.now(),
  };
  writeNote(note);
  commit([note, ...notes]);
  return note;
}

export type RenameResult = { ok: true; note: Note } | { ok: false; reason: 'duplicate' | 'missing' };

export function renameNote(id: string, title: string): RenameResult {
  const notes = read();
  const stored = notes.find((note) => note.id === id);
  if (!stored) return { ok: false, reason: 'missing' };
  const next = title.trim();
  if (next === '' || !uniqueTitle(notes, next, scopeKey(stored), id)) {
    return { ok: false, reason: 'duplicate' };
  }
  const renamed: Note = { ...stored, title: next, version: stored.version + 1, updatedAt: Date.now() };
  writeNote(renamed);
  commit(notes.map((note) => (note.id === id ? renamed : note)));
  return { ok: true, note: renamed };
}

export function removeNote(id: string): void {
  const notes = read();
  if (hasStorage()) localStorage.removeItem(noteKey(id));
  void notesDb().delete(id).catch(() => {});
  commit(notes.filter((note) => note.id !== id));
}

/** Drops every stored note and writes the seeds back. Edits to a seed are lost. */
export function resetNotes(): void {
  for (const note of read()) {
    if (hasStorage()) localStorage.removeItem(noteKey(note.id));
  }
  void notesDb()
    .clear()
    .then(async () => {
      for (const note of NOTE_SEEDS) await notesDb().put(note);
    })
    .catch(() => {});
  for (const note of NOTE_SEEDS) writeNote(note);
  commit([...NOTE_SEEDS]);
}

export function useNotes(): Note[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/* Reconcile the synchronous cache with the local database once, at load. */
void hydrate().catch(() => {});
