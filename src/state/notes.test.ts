import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The store reads `localStorage` on first use, so each case re-imports the
 * module after seeding. The three ways a note can be lost — a bad payload, a
 * stale version, a duplicate title — are checked here rather than in a browser.
 */

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  },
});

const fresh = async () => {
  vi.resetModules();
  return import('./notes');
};

beforeEach(() => {
  storage.clear();
});

describe('first run', () => {
  it('writes the six seeds and reads them back', async () => {
    const store = await fresh();
    expect(store.listNotes()).toHaveLength(6);
    expect(storage.has('thylas:notes:v1')).toBe(true);
    expect(storage.has('thylas:note:v1:n-method')).toBe(true);
  });
});

describe('save', () => {
  it('bumps the version and keeps the body', async () => {
    const store = await fresh();
    const before = store.getNoteById('n-method')!;
    const result = store.saveNote('n-method', 'new body', before.version);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.note.version).toBe(before.version + 1);
    expect(store.getNoteById('n-method')?.body).toBe('new body');
  });

  it('refuses a stale version and returns the stored note instead', async () => {
    const store = await fresh();
    const before = store.getNoteById('n-method')!;
    store.saveNote('n-method', 'first writer', before.version);
    const second = store.saveNote('n-method', 'second writer', before.version);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.theirs.body).toBe('first writer');
      expect(second.theirs.version).toBe(before.version + 1);
    }
    expect(store.getNoteById('n-method')?.body).toBe('first writer');
  });
});

describe('create and rename', () => {
  it('numbers a second Untitled in the same scope instead of refusing', async () => {
    const store = await fresh();
    const first = store.createNote({ scope: 'personal' });
    const second = store.createNote({ scope: 'personal' });
    expect(first.title).toBe('Untitled');
    expect(second.title).toBe('Untitled 2');
  });

  it('refuses a rename onto a title that exists in the same scope', async () => {
    const store = await fresh();
    const notes = store.listNotes().filter((n) => n.wsId === 'ws-research');
    const [a, b] = notes;
    expect(store.renameNote(a!.id, b!.title)).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('allows the same title in a different scope', async () => {
    const store = await fresh();
    const personal = store.createNote({ scope: 'personal', title: 'Method — how we measure comparability' });
    expect(store.listNotes().filter((n) => n.title === personal.title)).toHaveLength(2);
  });
});

describe('remove and reset', () => {
  it('drops one note and its key', async () => {
    const store = await fresh();
    store.removeNote('n-method');
    expect(store.getNoteById('n-method')).toBeUndefined();
    expect(storage.has('thylas:note:v1:n-method')).toBe(false);
  });

  it('restores the seeds after an edit', async () => {
    const store = await fresh();
    const before = store.getNoteById('n-method')!;
    store.saveNote('n-method', 'edited', before.version);
    store.resetNotes();
    expect(store.getNoteById('n-method')?.body).toBe(before.body);
    expect(store.listNotes()).toHaveLength(6);
  });
});

describe('bad storage', () => {
  it('drops a note whose payload is not JSON, keeping the rest', async () => {
    storage.set(
      'thylas:notes:v1',
      JSON.stringify({ version: 1, entries: [{ id: 'n-method' }, { id: 'broken' }] }),
    );
    storage.set(
      'thylas:note:v1:n-method',
      JSON.stringify({ id: 'n-method', title: 'M', scope: 'personal', body: '', version: 1, updatedAt: 0 }),
    );
    storage.set('thylas:note:v1:broken', '{not json');
    const store = await fresh();
    expect(store.listNotes().map((n) => n.id)).toEqual(['n-method']);
  });

  it('seeds again when the index is unreadable', async () => {
    storage.set('thylas:notes:v1', '{not json');
    const store = await fresh();
    expect(store.listNotes()).toHaveLength(6);
  });
});
