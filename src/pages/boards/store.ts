/* Versioned board persistence. An interface plus a localStorage adapter, so a
   service-backed store can replace it without touching the scene model.
   Writes are debounced; `flush` exists for tests and for page unload.

   v1 boards are read through `readSceneV1` and rewritten as v2 on the next
   edit: the schema moved (colours, folds, edge sides), nobody's work is lost. */

import { readScene, readSceneV1, type BoardScene } from './scene';

export const BOARD_VERSION = 2;
export const BOARD_KEY_PREFIX = 'thylas:board:v2:';
export const LEGACY_KEY_PREFIX = 'thylas:board:v1:';
export const WRITE_DELAY = 300;

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

export type LoadResult =
  | { ok: true; scene: BoardScene }
  | { ok: false; error: string };

export interface BoardStore {
  load(id: string): LoadResult;
  save(scene: BoardScene): void;
  flush(): void;
  /** Forgets the saved scene so the sample board shows again. */
  clear(id: string): void;
}

export function boardKey(id: string): string {
  return `${BOARD_KEY_PREFIX}${id}`;
}

export function legacyBoardKey(id: string): string {
  return `${LEGACY_KEY_PREFIX}${id}`;
}

export function createLocalBoardStore(
  storage: StorageLike,
  writeDelay = WRITE_DELAY,
): BoardStore {
  let pending: { key: string; value: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let warned = false;

  const write = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return;
    const { key, value } = pending;
    pending = null;
    try {
      storage.setItem(key, value);
    } catch {
      if (!warned) {
        warned = true;
        console.warn('[thylas] Board storage is full or blocked; edits stay in memory.');
      }
    }
  };

  return {
    load(id) {
      const raw = storage.getItem(boardKey(id));
      if (raw === null) {
        const legacy = storage.getItem(legacyBoardKey(id));
        if (legacy === null) return { ok: false, error: `No saved board for "${id}"` };
        try {
          const migrated = readSceneV1(JSON.parse(legacy));
          if (migrated) {
            return { ok: true, scene: { ...migrated, id } };
          }
        } catch {
          /* fall through to the error below */
        }
        return { ok: false, error: `Saved board "${id}" is not valid JSON` };
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { ok: false, error: `Saved board "${id}" is not valid JSON` };
      }
      const scene = readScene(parsed);
      if (!scene) {
        const version = (parsed as { version?: unknown } | null)?.version;
        if (typeof version === 'number' && version !== BOARD_VERSION) {
          return {
            ok: false,
            error: `Unsupported board schema version ${version}; expected ${BOARD_VERSION}`,
          };
        }
        return { ok: false, error: `Saved board "${id}" does not match schema v${BOARD_VERSION}` };
      }
      // The key and the payload must agree; a renamed board is not this board.
      return { ok: true, scene: { ...scene, id } };
    },

    save(scene) {
      if (scene.version !== BOARD_VERSION) {
        throw new Error(`Refusing to save board schema version ${scene.version}; expected ${BOARD_VERSION}`);
      }
      pending = { key: boardKey(scene.id), value: JSON.stringify(scene) };
      if (timer) clearTimeout(timer);
      timer = setTimeout(write, writeDelay);
    },

    flush: write,

    clear(id) {
      pending = null;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      storage.removeItem?.(boardKey(id));
      storage.removeItem?.(legacyBoardKey(id));
    },
  };
}
