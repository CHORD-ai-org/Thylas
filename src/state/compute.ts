/**
 * The Compute v2 store: what changed since the page loaded.
 *
 * Nothing here talks to a provider. The store owns exactly the facts a
 * prototype can own — backend configuration and test results, a default
 * backend, an instance someone connected, a target someone confirmed in Run —
 * and keeps the seed data in `data/compute.ts` untouched, so the samples are
 * still the samples after a session of clicking.
 *
 * The key is v2: the shape changed with the model (D-050), and a v1 envelope
 * is discarded on read rather than half-migrated.
 */
import { useSyncExternalStore } from 'react';
import {
  BACKENDS,
  BACKEND_TYPE_LABEL,
  INSTANCES,
  WORKLOADS,
  eligibleTargets,
  type Backend,
  type BackendStatus,
  type ConnectionState,
  type Instance,
  type Requirements,
  type Target,
  type Workload,
  type WorkloadState,
} from '../data/compute';

const KEY = 'thylas:compute:v2';

export type Decision = {
  id: string;
  at: string;
  kind: 'configure' | 'connect' | 'disconnect' | 'add' | 'remove' | 'target';
  text: string;
  subjectId?: string;
};

type State = {
  /** Saved configuration per backend id, applied over the seeds. */
  backendConfig: Record<string, Record<string, string>>;
  /** Test results and manual status overrides per backend id. */
  backendStatus: Record<string, BackendStatus>;
  /** Enabled/disabled overrides. */
  backendEnabled: Record<string, boolean>;
  /** Default backend chosen in this session (seed default until then). */
  defaultBackend: string | null;
  /** Seed backends removed in this session. */
  removedBackends: string[];
  /** Backends configured from the catalog in this session. */
  addedBackends: Backend[];
  /** Instances added through the Marketplace in this session. */
  addedInstances: Instance[];
  /** Removed seed instances (terminated acquired ones are dropped outright). */
  removedInstances: string[];
  /** Connection overrides, keyed by instance id. */
  connections: Record<string, ConnectionState>;
  /** Workload state overrides. */
  workloadStates: Record<string, WorkloadState>;
  /** Workloads created by confirming a target in Run. */
  addedWorkloads: Workload[];
  log: Decision[];
};

const EMPTY: State = {
  backendConfig: {},
  backendStatus: {},
  backendEnabled: {},
  defaultBackend: null,
  removedBackends: [],
  addedBackends: [],
  addedInstances: [],
  removedInstances: [],
  connections: {},
  workloadStates: {},
  addedWorkloads: [],
  log: [],
};

const STATUSES: BackendStatus[] = ['ready', 'unverified', 'unreachable', 'error'];
const CONNECTIONS: ConnectionState[] = ['connected', 'connecting', 'disconnected', 'error'];
const WORKLOAD_STATES: WorkloadState[] = ['running', 'queued', 'completed', 'failed', 'cancelled'];

function isInstance(value: unknown): value is Instance {
  if (typeof value !== 'object' || value === null) return false;
  const i = value as Partial<Instance>;
  return (
    typeof i.id === 'string' &&
    typeof i.name === 'string' &&
    typeof i.backendId === 'string' &&
    typeof i.connection === 'string' &&
    CONNECTIONS.includes(i.connection as ConnectionState) &&
    typeof i.hardware === 'object' &&
    i.hardware !== null
  );
}

function isWorkload(value: unknown): value is Workload {
  if (typeof value !== 'object' || value === null) return false;
  const w = value as Partial<Workload>;
  return (
    typeof w.id === 'string' &&
    typeof w.name === 'string' &&
    typeof w.backendId === 'string' &&
    typeof w.state === 'string' &&
    WORKLOAD_STATES.includes(w.state as WorkloadState)
  );
}

function isBackend(value: unknown): value is Backend {
  if (typeof value !== 'object' || value === null) return false;
  const b = value as Partial<Backend>;
  return (
    typeof b.id === 'string' &&
    b.id.startsWith('b-') &&
    typeof b.name === 'string' &&
    typeof b.type === 'string' &&
    b.type in BACKEND_TYPE_LABEL &&
    typeof b.instances === 'string' &&
    ['exposed', 'none'].includes(b.instances)
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
    if (p.version !== 2) return EMPTY;
    const strList = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    const backendConfig: State['backendConfig'] = {};
    if (p.backendConfig && typeof p.backendConfig === 'object') {
      for (const [id, cfg] of Object.entries(p.backendConfig)) {
        if (cfg && typeof cfg === 'object') {
          const clean: Record<string, string> = {};
          for (const [k, v] of Object.entries(cfg)) if (typeof v === 'string') clean[k] = v;
          backendConfig[id] = clean;
        }
      }
    }
    const backendStatus: State['backendStatus'] = {};
    if (p.backendStatus && typeof p.backendStatus === 'object') {
      for (const [id, s] of Object.entries(p.backendStatus)) {
        if (typeof s === 'string' && STATUSES.includes(s as BackendStatus)) backendStatus[id] = s as BackendStatus;
      }
    }
    const backendEnabled: State['backendEnabled'] = {};
    if (p.backendEnabled && typeof p.backendEnabled === 'object') {
      for (const [id, v] of Object.entries(p.backendEnabled)) if (typeof v === 'boolean') backendEnabled[id] = v;
    }
    const connections: State['connections'] = {};
    if (p.connections && typeof p.connections === 'object') {
      for (const [id, v] of Object.entries(p.connections)) {
        if (typeof v === 'string' && CONNECTIONS.includes(v as ConnectionState)) connections[id] = v as ConnectionState;
      }
    }
    const workloadStates: State['workloadStates'] = {};
    if (p.workloadStates && typeof p.workloadStates === 'object') {
      for (const [id, v] of Object.entries(p.workloadStates)) {
        if (typeof v === 'string' && WORKLOAD_STATES.includes(v as WorkloadState)) workloadStates[id] = v as WorkloadState;
      }
    }
    return {
      backendConfig,
      backendStatus,
      backendEnabled,
      defaultBackend: typeof p.defaultBackend === 'string' ? p.defaultBackend : null,
      removedBackends: strList(p.removedBackends),
      addedBackends: Array.isArray(p.addedBackends) ? p.addedBackends.filter(isBackend) : [],
      addedInstances: Array.isArray(p.addedInstances) ? p.addedInstances.filter(isInstance) : [],
      removedInstances: strList(p.removedInstances),
      connections,
      workloadStates,
      addedWorkloads: Array.isArray(p.addedWorkloads) ? p.addedWorkloads.filter(isWorkload) : [],
      log: Array.isArray(p.log)
        ? p.log.filter((d): d is Decision => typeof d === 'object' && d !== null && typeof (d as Decision).text === 'string')
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
      localStorage.setItem(KEY, JSON.stringify({ version: 2, ...snapshot }));
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

/** A backend with session config, status and enabled overrides applied. */
export function backendView(backend: Backend): Backend {
  const configured = backend.configured ?? (Boolean(backend.config) || Boolean(snapshot.backendConfig[backend.id]));
  return {
    ...backend,
    config: snapshot.backendConfig[backend.id] ?? backend.config,
    status: snapshot.backendStatus[backend.id] ?? backend.status,
    enabled: snapshot.backendEnabled[backend.id] ?? backend.enabled,
    isDefault: defaultBackendId() === backend.id,
    configured,
  };
}

export function backendsView(): Backend[] {
  const views = [
    ...BACKENDS.filter((b) => !snapshot.removedBackends.includes(b.id)).map(backendView),
    ...snapshot.addedBackends.map(backendView),
  ];
  return [...views].sort((a, b) => Number(b.isDefault ?? false) - Number(a.isDefault ?? false));
}

export function backendById(id: string | undefined): Backend | undefined {
  if (!id) return undefined;
  return backendsView().find((b) => b.id === id);
}

export function defaultBackendId(): string | null {
  return snapshot.defaultBackend ?? BACKENDS.find((b) => b.isDefault)?.id ?? null;
}

/** An instance with connection override applied; utilization follows the rule. */
function instanceView(instance: Instance): Instance {
  const connection = snapshot.connections[instance.id] ?? instance.connection;
  const utilization = connection === 'connected' ? instance.utilization : undefined;
  return { ...instance, connection, utilization };
}

export function instancesView(): Instance[] {
  const seeds = INSTANCES.filter(
    (i) => !snapshot.removedInstances.includes(i.id) && !snapshot.removedBackends.includes(i.backendId),
  ).map(instanceView);
  return [...seeds, ...snapshot.addedInstances];
}

export function instanceById(id: string | undefined): Instance | undefined {
  if (!id) return undefined;
  return instancesView().find((i) => i.id === id);
}

export function instancesOf(backendId: string): Instance[] {
  return instancesView().filter((i) => i.backendId === backendId);
}

export function workloadsView(): Workload[] {
  return [...WORKLOADS, ...snapshot.addedWorkloads].map((w) => ({
    ...w,
    state: snapshot.workloadStates[w.id] ?? w.state,
  }));
}

export function workloadById(id: string | undefined): Workload | undefined {
  if (!id) return undefined;
  return workloadsView().find((w) => w.id === id);
}

export function workloadsOn(instanceId: string): Workload[] {
  return workloadsView().filter((w) => w.instanceId === instanceId);
}

/** The targets Run can choose from, through the current store state. */
export function targetsView(): Target[] {
  return eligibleTargets(
    backendsView().filter((b) => b.configured),
    instancesView(),
  );
}

export function computeLog(): Decision[] {
  return [...snapshot.log].sort((a, b) => b.at.localeCompare(a.at));
}

/* --------------------------------------------------------------------------
   Writes
   -------------------------------------------------------------------------- */

function log(kind: Decision['kind'], text: string, subjectId?: string): Decision {
  return {
    id: `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    kind,
    text,
    ...(subjectId ? { subjectId } : {}),
  };
}

function findInstance(id: string): Instance | undefined {
  return instancesView().find((i) => i.id === id);
}

function findBackend(id: string): Backend | undefined {
  return backendById(id);
}

/* ---- backends ---- */

export function saveBackendConfig(id: string, config: Record<string, string>, status: BackendStatus): void {
  const backend = findBackend(id);
  commit({
    ...snapshot,
    backendConfig: { ...snapshot.backendConfig, [id]: config },
    backendStatus: { ...snapshot.backendStatus, [id]: status },
    log: [
      log('configure', `${status === 'ready' ? 'Configured' : 'Saved'} ${backend?.name ?? id} — ${status}.`, id),
      ...snapshot.log,
    ],
  });
}

/** A connection test, simulated. Deterministic: the caller decides the outcome. */
export function testBackend(id: string, willFail: boolean): void {
  window.setTimeout(() => {
    commit({
      ...snapshot,
      backendStatus: { ...snapshot.backendStatus, [id]: willFail ? 'unreachable' : 'ready' },
      log: [
        log('configure', `Connection test for ${findBackend(id)?.name ?? id}: ${willFail ? 'no answer.' : 'ready.'}`, id),
        ...snapshot.log,
      ],
    });
  }, 1100);
}

export function setBackendEnabled(id: string, enabled: boolean): void {
  commit({
    ...snapshot,
    backendEnabled: { ...snapshot.backendEnabled, [id]: enabled },
    log: [log('configure', `${findBackend(id)?.name ?? id} ${enabled ? 'enabled' : 'disabled'}.`, id), ...snapshot.log],
  });
}

export function setDefaultBackend(id: string): void {
  commit({
    ...snapshot,
    defaultBackend: id,
    log: [log('configure', `${findBackend(id)?.name ?? id} is now the default environment.`, id), ...snapshot.log],
  });
}

export function removeBackend(id: string): void {
  const isAdded = snapshot.addedBackends.some((b) => b.id === id);
  commit({
    ...snapshot,
    addedBackends: isAdded ? snapshot.addedBackends.filter((b) => b.id !== id) : snapshot.addedBackends,
    removedBackends: isAdded ? snapshot.removedBackends : [...snapshot.removedBackends, id],
    defaultBackend: snapshot.defaultBackend === id ? null : snapshot.defaultBackend,
    log: [log('remove', `Removed ${findBackend(id)?.name ?? id}. Its instances leave the pool with it.`, id), ...snapshot.log],
  });
}

/** A backend configured from the catalog in this session. */
export function addBackend(backend: Backend): void {
  commit({
    ...snapshot,
    addedBackends: [...snapshot.addedBackends, backend],
    log: [log('add', `Configured ${backend.name} (${backend.type}). Test it before trusting it.`, backend.id), ...snapshot.log],
  });
}

/* ---- instances ---- */

export function setInstanceConnection(id: string, connection: ConnectionState): void {
  commit({ ...snapshot, connections: { ...snapshot.connections, [id]: connection } });
}

export function connectInstance(id: string, willFail = false): void {
  setInstanceConnection(id, 'connecting');
  window.setTimeout(() => {
    setInstanceConnection(id, willFail ? 'error' : 'connected');
    const instance = findInstance(id);
    commit({
      ...snapshot,
      log: [
        log(willFail ? 'disconnect' : 'connect', willFail ? `Connection to ${instance?.name ?? id} failed.` : `Connected to ${instance?.name ?? id}.`, id),
        ...snapshot.log,
      ],
    });
  }, 1100);
}

export function disconnectInstance(id: string): void {
  setInstanceConnection(id, 'disconnected');
  commit({
    ...snapshot,
    log: [log('disconnect', `Disconnected ${findInstance(id)?.name ?? id}.`, id), ...snapshot.log],
  });
}

/** A marketplace acquisition, simulated. The rate is the listing's sample. */
export function acquireInstance(instance: Instance, listingName: string): void {
  commit({
    ...snapshot,
    addedInstances: [...snapshot.addedInstances, instance],
    log: [
      log('add', `Acquired ${instance.name} (${listingName}). Representative rate — nothing was provisioned.`, instance.id),
      ...snapshot.log,
    ],
  });
}

export function terminateInstance(id: string): void {
  const instance = findInstance(id);
  if (!instance) return;
  const isAdded = snapshot.addedInstances.some((i) => i.id === id);
  commit({
    ...snapshot,
    addedInstances: isAdded ? snapshot.addedInstances.filter((i) => i.id !== id) : snapshot.addedInstances,
    removedInstances: isAdded ? snapshot.removedInstances : [...snapshot.removedInstances, id],
    log: [log('remove', `Terminated ${instance.name}. A managed machine stops billing; nothing was billed here.`), ...snapshot.log],
  });
}

/* ---- workloads / selection ---- */

export function setWorkloadState(id: string, state: WorkloadState): void {
  commit({ ...snapshot, workloadStates: { ...snapshot.workloadStates, [id]: state } });
}

/**
 * Confirm a target in Run. This records a queued workload with a target; it
 * does not start anything, because nothing in this build can start anything.
 */
export function confirmTarget(req: Requirements, target: Target): Workload {
  const name = req.name.trim() || 'Untitled workload';
  const kind = req.kind.trim() || 'Unspecified';
  const isBackendTarget = target.kind === 'backend';
  const workload: Workload = {
    id: `wl-${Date.now().toString(36)}`,
    name,
    kind,
    backendId: target.backendId,
    ...(isBackendTarget ? {} : { instanceId: target.id }),
    state: 'queued',
    startedAt: 'queued just now',
    duration: isBackendTarget ? 'waiting for the scheduler' : 'waiting for a start signal',
    cpuPct: 0,
    memoryGb: 0,
    note: isBackendTarget
      ? `Chosen in Run for ${target.backendName}. The environment provisions for the work; nothing starts in this build.`
      : `Chosen in Run for ${target.name}. Thylas does not start work in this build — this run has a target and no executor.`,
  };
  commit({
    ...snapshot,
    addedWorkloads: [...snapshot.addedWorkloads, workload],
    log: [
      log('target', `Queued ${name} on ${target.name}. Recorded, not started.`, target.id),
      ...snapshot.log,
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
