/* Versioned board persistence. An interface plus a localStorage adapter, so
   SP-06c can swap in a service-backed store without touching the scene model.
   Writes are debounced; `flush` exists for tests and for page unload. */

import type { BoardScene } from './scene';

export const BOARD_VERSION = 1;
export const BOARD_KEY_PREFIX = 'thylas:board:v1:';
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
}

export function boardKey(id: string): string {
  return `${BOARD_KEY_PREFIX}${id}`;
}

function isScene(value: unknown): value is BoardScene {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<BoardScene>;
  return (
    v.version === BOARD_VERSION &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.sections) &&
    Array.isArray(v.cards) &&
    Array.isArray(v.edges) &&
    !!v.viewport &&
    Number.isFinite(v.viewport.zoom)
  );
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
      if (raw === null) return { ok: false, error: `No saved board for "${id}"` };
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { ok: false, error: `Saved board "${id}" is not valid JSON` };
      }
      if (!isScene(parsed)) {
        const version = (parsed as { version?: unknown } | null)?.version;
        if (typeof version === 'number' && version !== BOARD_VERSION) {
          return {
            ok: false,
            error: `Unsupported board schema version ${version}; expected ${BOARD_VERSION}`,
          };
        }
        return { ok: false, error: `Saved board "${id}" does not match schema v${BOARD_VERSION}` };
      }
      return { ok: true, scene: parsed };
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
  };
}
