/**
 * The User store: the one profile field a person owns here, and preferences.
 *
 * Identity comes from the CHORD identity provider — this store holds a display
 * name written over it, nothing more. Preferences are validated on read like
 * every other envelope (a hand-edited payload loses the entry, not the
 * library), and the landing page is read by the router's index redirect, which
 * makes it the one preference with a real effect on navigation.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'thylas:user:v1';

export type Landing = 'overview' | 'recently' | 'notes';
export type Density = 'comfortable' | 'compact';

export type Prefs = {
  landing: Landing;
  density: Density;
  /** A workspace id, resolved against the live list by whoever renders it. */
  defaultWorkspace: string | null;
};

export type UserState = {
  displayName?: string;
  prefs: Partial<Prefs>;
};

const LANDINGS: Landing[] = ['overview', 'recently', 'notes'];
const DENSITIES: Density[] = ['comfortable', 'compact'];

const EMPTY: UserState = { prefs: {} };

export const DEFAULT_PREFS: Prefs = {
  landing: 'overview',
  density: 'comfortable',
  defaultWorkspace: null,
};

function read(): UserState {
  if (typeof localStorage === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const p = parsed as Partial<UserState> & { version?: unknown };
    if (p.version !== 1) return EMPTY;
    const prefs: Partial<Prefs> = {};
    if (typeof p.prefs?.landing === 'string' && LANDINGS.includes(p.prefs.landing as Landing)) {
      prefs.landing = p.prefs.landing as Landing;
    }
    if (typeof p.prefs?.density === 'string' && DENSITIES.includes(p.prefs.density as Density)) {
      prefs.density = p.prefs.density as Density;
    }
    if (typeof p.prefs?.defaultWorkspace === 'string') {
      prefs.defaultWorkspace = p.prefs.defaultWorkspace;
    } else if (p.prefs?.defaultWorkspace === null) {
      prefs.defaultWorkspace = null;
    }
    return {
      displayName: typeof p.displayName === 'string' && p.displayName.trim() ? p.displayName : undefined,
      prefs,
    };
  } catch {
    return EMPTY;
  }
}

let snapshot: UserState = read();
const listeners = new Set<() => void>();

function commit(next: UserState): void {
  snapshot = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, ...snapshot }));
    } catch {
      /* quota: the session keeps working, the next one starts from defaults */
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
