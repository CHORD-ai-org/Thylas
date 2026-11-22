import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '../data/types';
import type { NotesDb } from '../services/notes/localDb';

/**
 * The local database is the durable truth: on first launch the notes already
 * sitting in localStorage are migrated into it, and after a localStorage wipe
 * they are read back from the database rather than lost or re-seeded.
 *
 * A module reload in the tests would reset the in-memory fallback, so one
 * shared backing store stands in for IndexedDB — it outlives `resetModules()`
 * exactly as a real database outlives a page reload.
 */
const storage = new Map<string, string>();
const rows = new Map<string, Note>();

function sharedDb(): NotesDb {
  return {
    async getAll() {
      return [...rows.values()];
    },
    async put(note) {
      rows.set(note.id, note);
    },
    async delete(id) {
      rows.delete(id);
    },
    async clear() {
      rows.clear();
    },
  };
}

function stubStorage() {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
}

const seedCachedLibrary = () => {
  const notes: Note[] = [
    { id: 'n-a', title: 'Alpha', scope: 'personal', body: 'one', version: 1, updatedAt: 100 },
    { id: 'n-b', title: 'Beta', scope: 'personal', body: 'two', version: 3, updatedAt: 200 },
  ];
  for (const note of notes) {
    storage.set(`thylas:note:v1:${note.id}`, JSON.stringify(note));
  }
  storage.set(
    'thylas:notes:v1',
    JSON.stringify({
      version: 1,
      entries: notes.map((n) => ({ id: n.id, title: n.title, scope: n.scope, updatedAt: n.updatedAt })),
    }),
  );
  return notes;
};

/** Import a fresh store wired to the one shared database. */
async function loadStore() {
  vi.resetModules();
  const localDb = await import('../services/notes/localDb');
  localDb.__setNotesDbForTest(sharedDb());
  const store = await import('./notes');
  return store;
}

beforeEach(() => {
  storage.clear();
  rows.clear();
  stubStorage();
});

describe('notes local database', () => {
  it('migrates existing localStorage notes into the database on first launch', async () => {
    seedCachedLibrary();
    const store = await loadStore();
    await store.whenNotesHydrated();

    expect([...rows.keys()].sort()).toEqual(['n-a', 'n-b']);
    expect(rows.get('n-b')?.body).toBe('two');
  });

  it('reads notes back from the database after a localStorage wipe', async () => {
    seedCachedLibrary();
    await (await loadStore()).whenNotesHydrated();

    /* Everything in localStorage is gone — the old fragility. */
    storage.clear();

    const second = await loadStore();
    await second.whenNotesHydrated();
    /* Recovered from the database (the demo seeds may re-seed alongside). */
    const ids = second.listNotes().map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(['n-a', 'n-b']));
    expect(second.getNoteById('n-b')?.body).toBe('two');
    expect(second.getNoteById('n-a')?.body).toBe('one');
  });

  it('keeps a save in the database across a reload', async () => {
    const store = await loadStore();
    await store.whenNotesHydrated();
    const created = store.createNote({ scope: 'personal', title: 'Persisted' });
    store.saveNote(created.id, 'durable body', created.version);
    /* writeNote persists in the background; let the puts land. */
    await new Promise((resolve) => setTimeout(resolve, 0));

    storage.clear();
    const reloaded = await loadStore();
    await reloaded.whenNotesHydrated();
    expect(reloaded.getNoteById(created.id)?.body).toBe('durable body');
  });
});
