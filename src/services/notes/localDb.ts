/**
 * The notes local database: IndexedDB, the browser's own durable store.
 *
 * Why here and not localStorage: notes must survive a reload, a browser
 * restart, and a localStorage wipe — and they must hold more than a few
 * hundred kilobytes. IndexedDB is a real local database that gives all three
 * with no server and no dependency.
 *
 * The same interface is backed by an in-memory map when IndexedDB is absent
 * (a unit test, a prerender), so callers never branch on the environment.
 */
import type { Note } from '../../data/types';

export type NotesDb = {
  getAll(): Promise<Note[]>;
  put(note: Note): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
};

const DB_NAME = 'thylas';
const DB_VERSION = 1;
const STORE = 'notes';

const hasIndexedDb = (): boolean => typeof indexedDB !== 'undefined' && indexedDB !== null;

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        /* Out-of-line keys: the Note already owns its id. */
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('notes: IndexedDB open failed'));
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('notes: IndexedDB request failed'));
  });
}

function createIdbNotesDb(): NotesDb {
  let opening: Promise<IDBDatabase> | null = null;
  const ready = (): Promise<IDBDatabase> => (opening ??= idbOpen());
  return {
    async getAll() {
      const db = await ready();
      return (await tx<Note[]>(db, 'readonly', (store) => store.getAll() as IDBRequest<Note[]>)) ?? [];
    },
    async put(note) {
      const db = await ready();
      await tx(db, 'readwrite', (store) => store.put(note) as IDBRequest<IDBValidKey>);
    },
    async delete(id) {
      const db = await ready();
      await tx(db, 'readwrite', (store) => store.delete(id) as unknown as IDBRequest<undefined>);
    },
    async clear() {
      const db = await ready();
      await tx(db, 'readwrite', (store) => store.clear() as unknown as IDBRequest<undefined>);
    },
  };
}

function createMemoryNotesDb(): NotesDb {
  const rows = new Map<string, Note>();
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

let instance: NotesDb | null = null;

export function notesDb(): NotesDb {
  instance ??= hasIndexedDb() ? createIdbNotesDb() : createMemoryNotesDb();
  return instance;
}

/** Test seam: replaces the backing store. */
export function __setNotesDbForTest(db: NotesDb | null): void {
  instance = db;
}

export { hasIndexedDb };
