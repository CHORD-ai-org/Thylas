/**
 * The Connect store: what changed since the page loaded.
 *
 * Nothing here talks to an external application. The store owns exactly the
 * facts a prototype can own — a connection someone disconnected, a custom
 * integration someone registered — and keeps the seed data in `data/connect.ts`
 * untouched, so the samples are still the samples after a session of clicking.
 *
 * A disconnection is a tombstone (the workspace pattern). A registration is a
 * record of intent: its status is "Registered", never "Connected", because
 * nothing in this build calls anything.
 */
import { useSyncExternalStore } from 'react';
import { INTEGRATIONS, integrationOf, type Integration } from '../data/connect';

const KEY = 'thylas:connect:v1';

/** The kinds of custom integration, kept apart from authorization methods. */
export type CustomKind = 'custom-api' | 'mcp-server' | 'webhook';
export type CustomAuth = 'oauth' | 'api-key' | 'none';

export type RegisteredCustom = {
  id: string;
  label: string;
  kind: CustomKind;
  endpoint: string;
  auth: CustomAuth;
  note?: string;
  createdAt: number;
};

export type Decision = {
  id: string;
  at: string;
  kind: 'disconnect' | 'register';
  text: string;
};

type State = {
  /** Seed connections disconnected in this session. */
  removed: string[];
  custom: RegisteredCustom[];
  log: Decision[];
};

const EMPTY: State = { removed: [], custom: [], log: [] };

const KINDS: CustomKind[] = ['custom-api', 'mcp-server', 'webhook'];
const AUTHS: CustomAuth[] = ['oauth', 'api-key', 'none'];

function isCustom(value: unknown): value is RegisteredCustom {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Partial<RegisteredCustom>;
  return (
    typeof c.id === 'string' &&
    typeof c.label === 'string' &&
    typeof c.kind === 'string' &&
    KINDS.includes(c.kind as CustomKind) &&
    typeof c.endpoint === 'string' &&
    typeof c.auth === 'string' &&
    AUTHS.includes(c.auth as CustomAuth) &&
    typeof c.createdAt === 'number'
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
    return {
      removed: Array.isArray(p.removed) ? p.removed.filter((id): id is string => typeof id === 'string') : [],
      custom: Array.isArray(p.custom) ? p.custom.filter(isCustom) : [],
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

export function integrationsView(): Integration[] {
  return INTEGRATIONS.map((i) => integrationOf(i.id, snapshot.removed)).filter(
    (i): i is Integration => i !== undefined,
  );
}

export function integrationViewById(id: string | undefined): Integration | undefined {
  return integrationOf(id, snapshot.removed);
}

export function connectedAppIds(): string[] {
  return integrationsView().map((i) => i.appId);
}

export function customIntegrations(): RegisteredCustom[] {
  return [...snapshot.custom].sort((a, b) => b.createdAt - a.createdAt);
}

export function connectLog(): Decision[] {
  return [...snapshot.log].sort((a, b) => b.at.localeCompare(a.at));
}

/* --------------------------------------------------------------------------
   Writes
   -------------------------------------------------------------------------- */

function log(kind: Decision['kind'], text: string): Decision {
  return {
    id: `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    kind,
    text,
  };
}

export function disconnectIntegration(id: string): void {
  const integration = integrationOf(id, snapshot.removed);
  if (!integration || snapshot.removed.includes(id)) return;
  commit({
    ...snapshot,
    removed: [...snapshot.removed, id],
    log: [log('disconnect', `Disconnected ${integration.account} from ${integration.owner}.`), ...snapshot.log],
  });
}

export function registerCustom(input: Omit<RegisteredCustom, 'id' | 'createdAt'>): RegisteredCustom {
  const entry: RegisteredCustom = {
    ...input,
    id: `cx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  commit({
    ...snapshot,
    custom: [entry, ...snapshot.custom],
    log: [log('register', `Registered ${entry.label} (${entry.kind}). Nothing calls it in this build.`), ...snapshot.log],
  });
  return entry;
}

export function resetConnect(): void {
  commit(EMPTY);
}

export function useConnect(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test seam: the module reads storage once, so a test needs a fresh read. */
export function __readForTest(): State {
  return read();
}
