import { useSyncExternalStore } from 'react';
import type { RunState } from '../data/types';

/**
 * A local copy of a run's state, and nothing else (SP-07c).
 *
 * Why this exists at all: the process surface has controls and a simulator, and
 * neither may pretend to reach WAM. Mutating `data/mock.ts` would leak a click
 * into every other surface and outlive a reload with no way to tell the sample
 * from an edit. A separate, persisted map keeps the sample pristine, survives a
 * reload (so "the list reflects it" is a real claim), and can be cleared.
 */

const KEY = 'thylas:runs:v1';

const STATES: RunState[] = ['queued', 'running', 'needs_input', 'succeeded', 'failed', 'stopped'];
const isRunState = (value: unknown): value is RunState =>
  typeof value === 'string' && (STATES as string[]).includes(value);

type Overrides = Record<string, RunState>;

function read(): Overrides {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    const states =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { states?: Record<string, unknown> }).states
        : null;
    if (!states) return {};
    /* Only known ids and known states survive a hand-edited payload. */
    return Object.fromEntries(Object.entries(states).filter(([, v]) => isRunState(v))) as Overrides;
  } catch {
    return {};
  }
}

let snapshot: Overrides = read();
const listeners = new Set<() => void>();

function commit(next: Overrides) {
  snapshot = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, states: snapshot }));
    } catch {
      /* quota or a locked profile: the map still works for this session */
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

const getSnapshot = (): Overrides => snapshot;

/** The current map, for code that is not a component. */
export function runStates(): Overrides {
  return snapshot;
}

export function setRunState(id: string, state: RunState): void {
  commit({ ...snapshot, [id]: state });
}

/**
 * Drops one override, so a control that can change a run can also stop having
 * changed it. Without this the sample is a one-way door and the second
 * demonstration of the simulator has nowhere to start from.
 */
export function clearRunState(id: string): void {
  if (!(id in snapshot)) return;
  const next = { ...snapshot };
  delete next[id];
  commit(next);
}

export function clearRunStates(): void {
  commit({});
}

/** The page calls this once; every surface that reads it re-renders together. */
export function useRunOverrides(): Overrides {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
