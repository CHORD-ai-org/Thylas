/**
 * The Compute store: what changed since the page loaded.
 *
 * Nothing here talks to a provider. The store owns exactly the facts a
 * prototype can own — a connection someone just made, a machine someone just
 * added, a run someone just stopped, a recommendation someone accepted — and
 * keeps the seed data in `data/compute.ts` untouched so the sample is still the
 * sample after a session of clicking.
 *
 * Two rules carried over from the rest of the app:
 *   - connection state and availability are separate fields, never merged;
 *   - utilization is dropped the moment a machine stops being reachable.
 */
import { useSyncExternalStore } from 'react';
import {
  PROVIDERS,
  RESOURCES,
  WORKLOADS,
  type Decision,
  type Provider,
  type Requirements,
  type Resource,
  type Workload,
  type WorkloadState,
} from '../data/compute';

const KEY = 'thylas:compute:v1';

type State = {
  /** Machines added in this session through the Add Resource flow. */
  added: Resource[];
  /** Connection overrides, keyed by resource id. */
  connections: Record<string, Resource['connection']>;
  /** Runs the user stopped or queued runs they cancelled. */
  workloadStates: Record<string, WorkloadState>;
  /** Runs created by accepting a recommendation. */
  addedWorkloads: Workload[];
  decisions: Decision[];
};

const EMPTY: State = { added: [], connections: {}, workloadStates: {}, addedWorkloads: [], decisions: [] };

const CONNECTIONS: Resource['connection'][] = ['connected', 'connecting', 'disconnected', 'error'];
const WORKLOAD_STATES: WorkloadState[] = ['running', 'queued', 'completed', 'failed', 'cancelled'];

function isResource(value: unknown): value is Resource {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Partial<Resource>;
  return (
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.providerId === 'string' &&
    typeof r.scope === 'string' &&
    typeof r.connection === 'string' &&
    CONNECTIONS.includes(r.connection) &&
    typeof r.hardware === 'object' &&
    r.hardware !== null
  );
}

function isWorkload(value: unknown): value is Workload {
  if (typeof value !== 'object' || value === null) return false;
  const w = value as Partial<Workload>;
  return (
    typeof w.id === 'string' &&
    typeof w.name === 'string' &&
    typeof w.resourceId === 'string' &&
    typeof w.state === 'string' &&
    WORKLOAD_STATES.includes(w.state)
  );
}

function read(): State {
  if (typeof localStorage === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const p = parsed as Partial<State> & { version?: unknown };
    if (p.version !== 1) return EMPTY;
    const connections: State['connections'] = {};
    if (p.connections && typeof p.connections === 'object') {
      for (const [id, value] of Object.entries(p.connections)) {
        if (typeof value === 'string' && CONNECTIONS.includes(value as Resource['connection'])) {
          connections[id] = value as Resource['connection'];
        }
      }
    }
    const workloadStates: State['workloadStates'] = {};
    if (p.workloadStates && typeof p.workloadStates === 'object') {
      for (const [id, value] of Object.entries(p.workloadStates)) {
        if (typeof value === 'string' && WORKLOAD_STATES.includes(value as WorkloadState)) {
          workloadStates[id] = value as WorkloadState;
        }
      }
    }
    return {
      added: Array.isArray(p.added) ? p.added.filter(isResource) : [],
      connections,
      workloadStates,
      addedWorkloads: Array.isArray(p.addedWorkloads) ? p.addedWorkloads.filter(isWorkload) : [],
      decisions: Array.isArray(p.decisions)
        ? p.decisions.filter((d): d is Decision => typeof d === 'object' && d !== null && typeof (d as Decision).text === 'string')
        : [],
    };
  } catch {
    return EMPTY;
  }
}

let snapshot: State = read();
const listeners = new Set<() => void>();

function commit(next: State): void {
  snapshot = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, ...snapshot }));
    } catch {
      /* quota: the session keeps working, the next one starts from the seeds */
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

const getSnapshot = (): State => snapshot;

/* --------------------------------------------------------------------------
   Reads
   -------------------------------------------------------------------------- */

export function allResources(): Resource[] {
  return [...RESOURCES, ...snapshot.added];
}

/** A seed resource with any session overrides applied. */
export function resourceView(resource: Resource): Resource {
  const connection = snapshot.connections[resource.id] ?? resource.connection;
  const utilization = connection === 'connected' ? resource.utilization : undefined;
  return { ...resource, connection, utilization };
}

export function resourcesView(): Resource[] {
  return allResources().map(resourceView);
}

export function resourceViewOf(id: string | undefined): Resource | undefined {
  const found = allResources().find((r) => r.id === id);
  return found ? resourceView(found) : undefined;
}

export function allWorkloads(): Workload[] {
  return [...WORKLOADS, ...snapshot.addedWorkloads].map((w) => ({
    ...w,
    state: snapshot.workloadStates[w.id] ?? w.state,
  }));
}

export function workloadOf(id: string | undefined): Workload | undefined {
  return allWorkloads().find((w) => w.id === id);
}

export function workloadsOn(resourceId: string): Workload[] {
  return allWorkloads().filter((w) => w.resourceId === resourceId);
}

export function activeCount(resourceId: string): number {
  return workloadsOn(resourceId).filter((w) => w.state === 'running' || w.state === 'queued').length;
}

/** Provider health, derived from the machines behind it — never stored twice. */
export type ProviderHealth = 'connected' | 'error' | 'disconnected' | 'empty' | 'planned';

export function providerHealth(provider: Provider): ProviderHealth {
  if (provider.integration === 'planned') return 'planned';
  const machines = resourcesView().filter((r) => r.providerId === provider.id);
  if (machines.length === 0) return 'empty';
  if (machines.some((r) => r.connection === 'connected')) return 'connected';
  if (machines.some((r) => r.connection === 'error')) return 'error';
  return 'disconnected';
}

export function decisions(): Decision[] {
  return [...snapshot.decisions].sort((a, b) => b.at.localeCompare(a.at));
}

/* --------------------------------------------------------------------------
   Writes
   -------------------------------------------------------------------------- */

function log(kind: Decision['kind'], text: string, resourceId?: string): Decision {
  return {
    id: `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    kind,
    text,
    ...(resourceId ? { resourceId } : {}),
  };
}

export function setConnection(id: string, connection: Resource['connection']): void {
  commit({ ...snapshot, connections: { ...snapshot.connections, [id]: connection } });
}

/**
 * A connection attempt, simulated. `willFail` is decided by the form that asked
 * for it (a host marked unreachable, or a secret left empty), not at random —
 * a prototype that fails at random teaches the reader nothing.
 */
export function connectResource(id: string, opts: { willFail?: boolean } = {}): void {
  setConnection(id, 'connecting');
  window.setTimeout(() => {
    const fail = opts.willFail ?? false;
    setConnection(id, fail ? 'error' : 'connected');
    const resource = allResources().find((r) => r.id === id);
    commit({
      ...snapshot,
      decisions: [
        log(fail ? 'disconnect' : 'connect', fail ? `Connection to ${resource?.name ?? id} failed.` : `Connected to ${resource?.name ?? id}.`, id),
        ...snapshot.decisions,
      ],
    });
  }, 1100);
}

export function disconnectResource(id: string): void {
  setConnection(id, 'disconnected');
  const resource = allResources().find((r) => r.id === id);
  commit({
    ...snapshot,
    decisions: [log('disconnect', `Disconnected ${resource?.name ?? id}.`, id), ...snapshot.decisions],
  });
}

export function addResource(resource: Resource): void {
  commit({
    ...snapshot,
    added: [...snapshot.added, resource],
    decisions: [log('add', `Added ${resource.name} from ${PROVIDERS.find((p) => p.id === resource.providerId)?.name ?? resource.providerId}.`, resource.id), ...snapshot.decisions],
  });
}

export function removeResource(id: string): void {
  const resource = allResources().find((r) => r.id === id);
  commit({
    ...snapshot,
    added: snapshot.added.filter((r) => r.id !== id),
    decisions: [log('disconnect', `Removed ${resource?.name ?? id} from the pool.`, id), ...snapshot.decisions],
  });
}

export function setWorkloadState(id: string, state: WorkloadState): void {
  commit({ ...snapshot, workloadStates: { ...snapshot.workloadStates, [id]: state } });
}

/**
 * Accept a recommendation. This records a target and a queued run; it does not
 * start anything, because nothing in this build can start anything.
 */
export function acceptRecommendation(input: Requirements, resourceId: string): Workload {
  const resource = resourceViewOf(resourceId);
  const workload: Workload = {
    id: `wl-${Date.now().toString(36)}`,
    name: input.name.trim() || 'Untitled workload',
    kind: input.kind.trim() || 'Unspecified',
    resourceId,
    state: 'queued',
    startedAt: 'queued just now',
    duration: 'waiting for a start signal',
    cpuPct: 0,
    memoryGb: 0,
    note: `Chosen in Find Compute for ${resource?.name ?? 'a machine'}. Thylas does not start work in this build — this run has a target and no executor.`,
  };
  commit({
    ...snapshot,
    addedWorkloads: [...snapshot.addedWorkloads, workload],
    decisions: [
      log('reserve', `Assigned ${workload.name} to ${resource?.name ?? resourceId}. Waiting for a start signal.`, resourceId),
      ...snapshot.decisions,
    ],
  });
  return workload;
}

export function resetCompute(): void {
  commit(EMPTY);
}

export function useCompute(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test seam: the module reads storage once, so a test needs a fresh read. */
export function __readForTest(): State {
  return read();
}
