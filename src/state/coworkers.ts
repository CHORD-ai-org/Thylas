/**
 * The Coworkers store: what changed since the page loaded.
 *
 * Three seeds ship with the page; this store holds the session's facts —
 * Coworkers created, removed, responsibility edits, status transitions,
 * membership changes — under the house envelope: versioned key, validated
 * read, caps, seeds untouched.
 */
import { useSyncExternalStore } from 'react';
import { COWORKERS, type Coworker, type CoworkerStatus, type Membership, type Responsibilities } from '../data/coworkers';

const KEY = 'thylas:coworkers:v1';
const MAX_COWORKERS = 60;

type State = {
  responsibilityOverrides: Record<string, Responsibilities>;
  statusOverrides: Record<string, CoworkerStatus>;
  membershipsAdded: (Membership & { coworkerId: string })[];
  membershipsRemoved: (Membership & { coworkerId: string })[];
  added: Coworker[];
  removed: string[];
  log: { id: string; at: number; text: string }[];
};

const EMPTY: State = {
  responsibilityOverrides: {},
  statusOverrides: {},
  membershipsAdded: [],
  membershipsRemoved: [],
  added: [],
  removed: [],
  log: [],
};

const STATUSES: CoworkerStatus[] = ['active', 'paused', 'archived'];

function isResponsibilities(value: unknown): value is Responsibilities {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Partial<Responsibilities>;
  return (
    typeof r.forWork === 'string' && typeof r.notFor === 'string' && typeof r.output === 'string'
  );
}

function isCoworker(value: unknown): value is Coworker {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Partial<Coworker>;
  return (
    typeof c.id === 'string' &&
    c.id.startsWith('cw-') &&
    typeof c.name === 'string' &&
    typeof c.description === 'string' &&
    typeof c.status === 'string' &&
    STATUSES.includes(c.status as CoworkerStatus) &&
    typeof c.createdAt === 'number' &&
    isResponsibilities(c.responsibilities) &&
    Array.isArray(c.memberships)
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
    const responsibilities: State['responsibilityOverrides'] = {};
    if (p.responsibilityOverrides && typeof p.responsibilityOverrides === 'object') {
      for (const [id, r] of Object.entries(p.responsibilityOverrides)) {
        if (isResponsibilities(r)) responsibilities[id] = r;
      }
    }
    const statusOverrides: State['statusOverrides'] = {};
    if (p.statusOverrides && typeof p.statusOverrides === 'object') {
      for (const [id, st] of Object.entries(p.statusOverrides)) {
        if (typeof st === 'string' && STATUSES.includes(st as CoworkerStatus)) statusOverrides[id] = st as CoworkerStatus;
      }
    }
    const isMembership = (v: unknown): v is Membership & { coworkerId: string } =>
      typeof v === 'object' && v !== null &&
      typeof (v as { coworkerId?: unknown }).coworkerId === 'string' &&
      typeof (v as { wsId?: unknown }).wsId === 'string' &&
      typeof (v as { role?: unknown }).role === 'string';
    return {
      responsibilityOverrides: responsibilities,
      statusOverrides,
      membershipsAdded: Array.isArray(p.membershipsAdded) ? p.membershipsAdded.filter(isMembership) : [],
      membershipsRemoved: Array.isArray(p.membershipsRemoved) ? p.membershipsRemoved.filter(isMembership) : [],
      added: Array.isArray(p.added) ? p.added.filter(isCoworker) : [],
      removed: Array.isArray(p.removed)
        ? p.removed.filter((x): x is string => typeof x === 'string' && COWORKERS.some((c) => c.id === x))
        : [],
      log: Array.isArray(p.log)
        ? p.log.filter((d) => typeof d === 'object' && d !== null && typeof (d as { text?: unknown }).text === 'string')
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
      /* quota: the session keeps working in memory */
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

/* ---- reads ------------------------------------------------------------------ */

export function useCoworkers(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function coworkersView(): Coworker[] {
  const list = [...COWORKERS, ...snapshot.added]
    .filter((c) => !snapshot.removed.includes(c.id))
    .map((c) => {
      const memberships = [
        ...c.memberships,
        ...snapshot.membershipsAdded.filter((m) => m.coworkerId === c.id).map(({ wsId, role }) => ({ wsId, role })),
      ].filter(
        (m) => !snapshot.membershipsRemoved.some((r) => r.coworkerId === c.id && r.wsId === m.wsId),
      );
      return {
        ...c,
        responsibilities: snapshot.responsibilityOverrides[c.id] ?? c.responsibilities,
        status: snapshot.statusOverrides[c.id] ?? c.status,
        memberships,
      };
    });
  return [...list].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active')).slice(0, MAX_COWORKERS);
}

export function coworkerById(id: string | undefined): Coworker | undefined {
  if (!id) return undefined;
  return coworkersView().find((c) => c.id === id);
}

export function coworkersLog(): State['log'] {
  return [...snapshot.log].sort((a, b) => b.at - a.at);
}


/* ---- writes ------------------------------------------------------------------ */

function entry(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function log(text: string): State['log'] {
  return [{ id: entry('d'), at: Date.now(), text }, ...snapshot.log];
}

export function createCoworker(input: {
  name: string;
  description: string;
  forWork: string;
  notFor: string;
  output: string;
  membership?: { wsId: string; role: string };
}): Coworker {
  const now = Date.now();
  const coworker: Coworker = {
    id: entry('cw'),
    name: input.name.trim().slice(0, 60) || 'Unnamed coworker',
    description: input.description.trim().slice(0, 200),
    status: 'active',
    createdAt: now,
    responsibilities: {
      forWork: input.forWork.trim(),
      notFor: input.notFor.trim(),
      output: input.output.trim(),
    },
    memberships: input.membership ? [input.membership] : [],
    pinnedArtifactIds: [],
  };
  commit({
    ...snapshot,
    added: [...snapshot.added, coworker],
    log: log(`Created ${coworker.name} — active, ${coworker.memberships.length} membership(s).`),
  });
  return coworker;
}

export function saveResponsibilities(coworkerId: string, next: Responsibilities): void {
  const current = coworkerById(coworkerId);
  if (!current) return;
  commit({
    ...snapshot,
    responsibilityOverrides: { ...snapshot.responsibilityOverrides, [coworkerId]: next },
    log: log(`Updated ${current.name}'s responsibilities.`),
  });
}

export function setCoworkerStatus(coworkerId: string, status: CoworkerStatus): void {
  const current = coworkerById(coworkerId);
  if (!current || current.status === status) return;
  commit({
    ...snapshot,
    statusOverrides: { ...snapshot.statusOverrides, [coworkerId]: status },
    log: log(`${current.name} is now ${status}.`),
  });
}

export function addMembership(coworkerId: string, wsId: string, role: string): void {
  const current = coworkerById(coworkerId);
  if (!current || current.memberships.some((m) => m.wsId === wsId)) return;
  commit({
    ...snapshot,
    membershipsAdded: [...snapshot.membershipsAdded, { coworkerId, wsId, role: role.trim() || 'collaborates' }],
    membershipsRemoved: snapshot.membershipsRemoved.filter((m) => !(m.coworkerId === coworkerId && m.wsId === wsId)),
    log: log(`${current.name} joined a workspace.`),
  });
}

export function removeMembership(coworkerId: string, wsId: string): void {
  const current = coworkerById(coworkerId);
  if (!current || !current.memberships.some((m) => m.wsId === wsId)) return;
  commit({
    ...snapshot,
    membershipsAdded: snapshot.membershipsAdded.filter((m) => !(m.coworkerId === coworkerId && m.wsId === wsId)),
    membershipsRemoved: [...snapshot.membershipsRemoved, { coworkerId, wsId, role: '' }],
    log: log(`${current.name} left a workspace — its work record stays.`),
  });
}

export function removeCoworker(coworkerId: string): void {
  const current = coworkerById(coworkerId);
  if (!current) return;
  const isAdded = snapshot.added.some((c) => c.id === coworkerId);
  commit({
    ...snapshot,
    added: isAdded ? snapshot.added.filter((c) => c.id !== coworkerId) : snapshot.added,
    removed: isAdded ? snapshot.removed : [...snapshot.removed, coworkerId],
    log: log(`Deleted ${current.name}.`),
  });
}

export function resetCoworkers(): void {
  commit(EMPTY);
}

/** Test seam. */
export function __readForTest(): State {
  return read();
}
