/**
 * Workspaces, and the two things this build can honestly do to them: create one
 * (it starts empty) and delete one (with everything inside).
 *
 * The two samples come from `data/mock.ts`, so deleting one in place would put
 * it back on the next load. Deletion is a tombstone list and creation is a
 * separate list; the live set is `seeds − tombstones + created`. Every selector
 * that returns a workspace-scoped object asks this module whether its workspace
 * still exists, which is what stops a deleted workspace's files from showing up
 * in Recently or resolving behind an open tab.
 *
 * Counts are derived, never stored: a stored count is a second truth that goes
 * stale the moment anything is added to a workspace.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { BOARDS, FILES, PROCESSES, WORKSPACES } from '../data/mock';
import type { Workspace } from '../data/types';
import { listNotes, removeNote } from './notes';

export const MAX_WORKSPACE_NAME = 40;

const KEY = 'thylas:workspaces:v1';

type Created = { id: string; name: string; createdAt: number };
type State = { created: Created[]; deleted: string[] };

const EMPTY: State = { created: [], deleted: [] };

function isCreated(value: unknown): value is Created {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<Created>;
  return (
    typeof v.id === 'string' &&
    v.id.startsWith('ws-') &&
    typeof v.name === 'string' &&
    v.name.trim().length > 0 &&
    v.name.length <= MAX_WORKSPACE_NAME &&
    typeof v.createdAt === 'number'
  );
}

function read(): State {
  if (typeof localStorage === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const candidate = parsed as { version?: unknown; created?: unknown; deleted?: unknown };
    if (candidate.version !== 1) return EMPTY;
    /* A hand-edited payload loses the entries it got wrong; it does not lose
       the library around them. */
    return {
      created: Array.isArray(candidate.created) ? candidate.created.filter(isCreated) : [],
      deleted: Array.isArray(candidate.deleted)
        ? candidate.deleted.filter((id): id is string => typeof id === 'string')
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
      /* quota or a locked profile: the lists still work for this session */
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

/** Recomputed only when the state object changes, so a render loop cannot
    allocate a new set on every read. */
let idCache: { state: State; ids: Set<string> } | null = null;

/** The workspaces that still exist. Selectors ask this, not the sample data. */
export function liveIds(): Set<string> {
  if (idCache?.state === snapshot) return idCache.ids;
  const ids = new Set(WORKSPACES.map((w) => w.id));
  for (const id of snapshot.deleted) ids.delete(id);
  for (const made of snapshot.created) ids.add(made.id);
  idCache = { state: snapshot, ids };
  return ids;
}

export function workspaceExists(id: string | undefined): boolean {
  return id !== undefined && liveIds().has(id);
}

function countsFor(wsId: string): Workspace['counts'] {
  return {
    files: FILES.filter((f) => f.wsId === wsId).length,
    boards: BOARDS.filter((b) => b.wsId === wsId).length,
    processes: PROCESSES.filter((p) => p.wsId === wsId).length,
    notes: listNotes().filter((n) => n.scope === 'workspace' && n.wsId === wsId).length,
  };
}

/** Seeds first, then the ones made here, newest first. */
export function listWorkspaces(): Workspace[] {
  const live = liveIds();
  const seeds: Workspace[] = WORKSPACES.filter((w) => live.has(w.id)).map((w) => ({
    ...w,
    counts: countsFor(w.id),
  }));
  const made: Workspace[] = [...snapshot.created]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((c) => ({
      id: c.id,
      name: c.name,
      scope: 'personal',
      counts: countsFor(c.id),
    }));
  return [...seeds, ...made];
}

export type CreateResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; reason: 'empty' | 'too-long' | 'duplicate'; message: string };

/** Trimmed and de-duplicated by name: two workspaces with the same name cannot
    be told apart in the rail, in the palette, or in a tab. */
export function createWorkspace(rawName: string): CreateResult {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (!name) {
    return { ok: false, reason: 'empty', message: 'A workspace needs a name.' };
  }
  if (name.length > MAX_WORKSPACE_NAME) {
    return {
      ok: false,
      reason: 'too-long',
      message: `A name is capped at ${MAX_WORKSPACE_NAME} characters; this one is ${name.length}.`,
    };
  }
  const taken = listWorkspaces().some((w) => w.name.toLowerCase() === name.toLowerCase());
  if (taken) {
    return {
      ok: false,
      reason: 'duplicate',
      message: `“${name}” already exists. Two workspaces with the same name cannot be told apart.`,
    };
  }

  /* The slug is for the URL, so a name in any script still produces one; the
     timestamp keeps two workspaces with the same slug apart. */
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'workspace';
  const live = liveIds();
  let id = `ws-${slug}-${Date.now().toString(36)}`;
  for (let n = 2; live.has(id); n++) id = `ws-${slug}-${Date.now().toString(36)}-${n}`;

  commit({
    ...snapshot,
    created: [...snapshot.created, { id, name, createdAt: Date.now() }],
  });

  const workspace = listWorkspaces().find((w) => w.id === id);
  /* Unreachable unless `commit` failed to persist; the type still has to say so. */
  if (!workspace) {
    return { ok: false, reason: 'duplicate', message: `“${name}” could not be created.` };
  }
  return { ok: true, workspace };
}

export type DeleteSummary = { name: string; files: number; boards: number; processes: number; notes: number };

/**
 * Deletes a workspace and what belongs to it. Notes written in it are removed
 * for real: they are the only content in the app that a person typed, so the
 * count is returned and the confirm surface has to state it before the press.
 */
export function deleteWorkspace(id: string): DeleteSummary | null {
  const target = listWorkspaces().find((w) => w.id === id);
  if (!target) return null;

  const doomed = listNotes().filter((n) => n.scope === 'workspace' && n.wsId === id);
  for (const note of doomed) removeNote(note.id);

  const isSeed = WORKSPACES.some((w) => w.id === id);
  commit({
    created: snapshot.created.filter((c) => c.id !== id),
    deleted: isSeed ? [...snapshot.deleted, id] : snapshot.deleted,
  });

  return { name: target.name, ...target.counts };
}

/** Drops both lists: the samples come back, the ones made here do not. */
export function resetWorkspaces(): void {
  commit({ created: [], deleted: [] });
}

/** The list every surface renders from: one store, so the rail, the grid and
    the palette cannot disagree about what exists. */
export function useWorkspaces(): Workspace[] {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => listWorkspaces(), [state]);
}
