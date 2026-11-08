import type { Process, RunAction, RunState } from './types';

/**
 * The process surface's own vocabulary. It lives in `data/` rather than in the
 * page because three things have to agree on it: the URL, the filter buttons,
 * and the empty state — and a filter id invented in a click handler is how the
 * URL and the label drift apart.
 */

export type RunFilter = 'all' | 'running' | 'needs_input' | 'done';

export const RUN_FILTERS: { id: RunFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'needs_input', label: 'Needs you' },
  { id: 'done', label: 'Done' },
];

/** An unknown `?state=` is `all`, not an empty list with no explanation. */
export function parseFilter(raw: string | null): RunFilter {
  const match = RUN_FILTERS.find((f) => f.id === raw);
  return match ? match.id : 'all';
}

export function filterHref(filter: RunFilter): string {
  return filter === 'all' ? '' : `?state=${filter}`;
}

/**
 * What an empty view says. It names the filter, because "no data" is the one
 * sentence a reader cannot act on.
 */
export const FILTER_EMPTY: Record<RunFilter, string> = {
  all: 'This workspace has no runs yet.',
  running: 'No run in this workspace is running.',
  needs_input: 'No run is waiting on you.',
  done: 'No run has finished yet.',
};

export function matchesFilter(filter: RunFilter, state: RunState): boolean {
  if (filter === 'all') return true;
  if (filter === 'running') return state === 'running' || state === 'queued';
  if (filter === 'needs_input') return state === 'needs_input';
  return state === 'succeeded' || state === 'failed' || state === 'stopped';
}

export function countFor(filter: RunFilter, runs: Process[], stateOf: (run: Process) => RunState): number {
  return runs.filter((r) => matchesFilter(filter, stateOf(r))).length;
}

/**
 * queued → running → needs you → done. The only path the simulator walks, and
 * a path, not a graph: a simulator that can jump anywhere teaches nothing about
 * how a run reads while it moves.
 */
const NEXT: Record<RunState, RunState | null> = {
  queued: 'running',
  running: 'needs_input',
  needs_input: 'succeeded',
  succeeded: null,
  failed: null,
  stopped: null,
};

export function nextSimulated(state: RunState): RunState | null {
  return NEXT[state];
}

/**
 * What a capability does to the local copy of a run.
 *
 * `pause` lands on `queued` because the state set has no `paused`, and inventing
 * a seventh state for one button would put a word in the UI that WAM may never
 * emit. A run that stopped moving is waiting to run; saying so is more honest
 * than a button that changes a word nobody can see.
 */
const OUTCOME: Record<RunAction, RunState> = {
  pause: 'queued',
  resume: 'running',
  stop: 'stopped',
  answer: 'running',
  approve: 'succeeded',
  rerun: 'queued',
};

export function actionOutcome(action: RunAction): RunState {
  return OUTCOME[action];
}

/** True when the local copy differs from the sample, i.e. the surface must say so. */
export function isLocal(state: RunState, sample: RunState): boolean {
  return state !== sample;
}
