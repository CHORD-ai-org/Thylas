/**
 * The User store: the one profile field a person owns here, and preferences.
 *
 * Identity comes from the CHORD identity provider — this store holds a display
 * name written over it, nothing more. Preferences are validated on read like
 * every other envelope (a hand-edited payload loses the entry, not the
 * library), and the landing page is read by the router's index redirect, which
 * makes it the one preference with a real effect on navigation.
 *
 * Phase 2 A0: types and validated reads live in `src/lib/user.ts` so a server
 * route can share them. Re-exported here so no UI import path changes.
 *
 * A1 (D-059): `VITE_USER_SOURCE=local|api` selects the persistence backing.
 * `local` is byte-for-byte the original behaviour. `api` hydrates once on
 * startup and syncs name changes in the background; every action stays
 * optimistic and synchronous, and the local envelope is never discarded.
 */
import { useSyncExternalStore } from 'react';
import {
  DEFAULT_PREFS,
  readDisplayName,
  readPrefs,
  type Density,
  type Landing,
  type Prefs,
} from '../lib/user';
import { createUserClient } from '../services/user/client';

export { DEFAULT_PREFS };
export type { Density, Landing, Prefs };

const KEY = 'thylas:user:v1';

const MODE: 'local' | 'api' =
  (import.meta.env.VITE_USER_SOURCE as string | undefined) === 'api' ? 'api' : 'local';
const SYNC_DELAY_MS = 300;
const userClient = createUserClient();
let booting = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export type UserState = {
  displayName?: string;
  prefs: Partial<Prefs>;
};

const EMPTY: UserState = { prefs: {} };

function read(): UserState {
  if (typeof localStorage === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const p = parsed as Partial<UserState> & { version?: unknown };
    if (p.version !== 1) return EMPTY;
    return {
      displayName: readDisplayName(p.displayName),
      prefs: readPrefs(p.prefs),
    };
  } catch {
    return EMPTY;
  }
}

let snapshot: UserState = read();
const listeners = new Set<() => void>();

/** `null` means no override, matching the server's UserDto. */
function remoteName(): string | null {
  const name = snapshot.displayName;
  return name?.trim() ? name : null;
}

function scheduleSync(): void {
  if (MODE !== 'api' || booting) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void flushSync();
  }, SYNC_DELAY_MS);
}

async function flushSync(): Promise<void> {
  if (MODE !== 'api' || booting) return;
  const result = await userClient.patch({ displayName: remoteName() });
  if (!result.ok) {
    /* The local envelope is already written. Never lose it on a failed sync. */
    console.warn('[user] remote sync failed — local envelope kept');
  }
}

/** Hydrate once on startup: a remote name wins over a stale local one. */
async function bootstrap(): Promise<void> {
  if (MODE !== 'api') return;
  booting = true;
  try {
    const remote = await userClient.get();
    if (!remote.ok) {
      console.warn('[user] could not load remote name — local envelope kept');
      return;
    }
    const local = remoteName();
    if (remote.user.displayName === null && local !== null) {
      const put = await userClient.patch({ displayName: local });
      if (!put.ok) console.warn('[user] local name import failed — local copy kept');
      return;
    }
    if (remote.user.displayName !== local) {
      commit(
        { ...snapshot, displayName: remote.user.displayName ?? undefined },
        { sync: false },
      );
    }
  } finally {
    booting = false;
  }
}

function commit(next: UserState, options: { sync?: boolean } = {}): void {
  snapshot = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, ...snapshot }));
    } catch {
      /* quota: the session keeps working, the next one starts from defaults */
    }
  }
  if (MODE === 'api' && options.sync !== false) scheduleSync();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): UserState => snapshot;

/* --------------------------------------------------------------------------
   Reads
   -------------------------------------------------------------------------- */

export function useUser(): UserState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** The effective preferences: stored values over defaults. */
export function prefsOf(state: UserState): Prefs {
  return { ...DEFAULT_PREFS, ...state.prefs };
}

/** The name the interface shows: the override, or the identity-provider name. */
export function displayNameOf(state: UserState, fallback: string): string {
  return state.displayName?.trim() || fallback;
}

/** The landing route the index redirect should use. */
export function landingPath(state: UserState): string {
  const landing = prefsOf(state).landing;
  if (landing === 'recently') return '/recently';
  if (landing === 'notes') return '/notes';
  return '/overview';
}

/* --------------------------------------------------------------------------
   Writes
   -------------------------------------------------------------------------- */

export function setDisplayName(name: string): void {
  const trimmed = name.trim();
  commit({ ...snapshot, displayName: trimmed || undefined });
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  commit({ ...snapshot, prefs: { ...snapshot.prefs, [key]: value } });
}

export function resetUser(): void {
  commit(EMPTY);
}

/** Test seam: the module reads storage once, so a test needs a fresh read. */
export function __readForTest(): UserState {
  return read();
}

if (MODE === 'api') void bootstrap();
