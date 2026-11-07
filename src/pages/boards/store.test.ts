import { describe, expect, it, vi } from 'vitest';
import { BOARDS } from '../../data/mock';
import { sceneFromBoard, type BoardScene } from './scene';
import {
  BOARD_KEY_PREFIX,
  boardKey,
  createLocalBoardStore,
  type StorageLike,
} from './store';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const scene = (): BoardScene => sceneFromBoard(BOARDS[0]!);

describe('board store round trip', () => {
  it('save → flush → load returns a deep-equal scene', () => {
    const storage = memoryStorage();
    const store = createLocalBoardStore(storage, 0);
    const original = scene();
    store.save(original);
    store.flush();
    const loaded = store.load(original.id);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.scene).toEqual(original);
    expect(storage.data.has(boardKey(original.id))).toBe(true);
  });

  it('keys boards independently and reports a missing board', () => {
    const storage = memoryStorage();
    const store = createLocalBoardStore(storage, 0);
    expect(store.load('nope')).toEqual({ ok: false, error: 'No saved board for "nope"' });
    store.save(scene());
    store.flush();
    expect(storage.data.has(`${BOARD_KEY_PREFIX}b-lit`)).toBe(true);
  });

  it('debounces writes until flush', () => {
    const storage = memoryStorage();
    const store = createLocalBoardStore(storage, 10_000);
    store.save(scene());
    expect(storage.data.size).toBe(0);
    store.flush();
    expect(storage.data.size).toBe(1);
  });

  it('refuses a future schema version with a message, not silence', () => {
    const storage = memoryStorage();
    storage.setItem(boardKey('b-lit'), JSON.stringify({ version: 2, id: 'b-lit' }));
    const result = createLocalBoardStore(storage, 0).load('b-lit');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Unsupported board schema version 2');
  });

  it('reports malformed JSON and shape mismatches separately', () => {
    const storage = memoryStorage();
    const store = createLocalBoardStore(storage, 0);
    storage.setItem(boardKey('broken'), '{not json');
    expect(store.load('broken').ok).toBe(false);
    storage.setItem(boardKey('shape'), JSON.stringify({ version: 1, id: 'shape' }));
    const bad = store.load('shape');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('does not match schema v1');
  });

  it('refuses to save a scene whose version it does not own', () => {
    const store = createLocalBoardStore(memoryStorage(), 0);
    const wrong = { ...scene(), version: 2 } as unknown as BoardScene;
    expect(() => store.save(wrong)).toThrow(/Refusing to save board schema version 2/);
  });

  it('degrades without throwing when storage is full', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
    };
    const store = createLocalBoardStore(full, 0);
    store.save(scene());
    store.save(scene());
    store.flush();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('clear', () => {
  it('removes the saved scene so the sample shows again', () => {
    const storage = memoryStorage();
    const store = createLocalBoardStore(storage, 0);
    const id = scene().id;
    store.save(scene());
    store.flush();
    expect(storage.data.size).toBe(1);
    store.clear(id);
    expect(storage.data.size).toBe(0);
    expect(store.load(id).ok).toBe(false);
  });

  it('cancels a write that was still debouncing', () => {
    const storage = memoryStorage();
    const store = createLocalBoardStore(storage, 50);
    store.save(scene());
    store.clear(scene().id);
    store.flush();
    expect(storage.data.size).toBe(0);
  });
});

describe('serialisation budget', () => {
  it('serialises a 200-card scene in under 20ms', () => {
    const base = scene();
    const big: BoardScene = {
      ...base,
      cards: Array.from({ length: 200 }, (_, i) => ({
        ...base.cards[0]!,
        id: `c-${i}`,
        x: (i % 20) * 140,
        y: Math.floor(i / 20) * 120,
      })),
    };
    const start = performance.now();
    const json = JSON.stringify(big);
    const elapsed = performance.now() - start;
    expect(json.length).toBeGreaterThan(10_000);
    expect(elapsed).toBeLessThan(20);
  });
});
