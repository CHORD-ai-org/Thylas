/// <reference types="node" />
/**
 * Server-side durable state for the Profile pipeline (one JSON file per
 * authenticated user). Real server persistence — not a browser mock. The DB
 * tables are deliberately deferred: DATABASE_URL is empty in this deployment
 * and createDb() answers 503 (see AUDIT-PLAN.md §Phase 2). Migration is a
 * read of these documents, not a rewrite of the product.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  recordKey,
  type CandidateStatus,
  type ExtractedItem,
  type ProfileCandidate,
  type ProfileCategory,
  type ProfileHistoryEntry,
  type ProfileRecord,
  type ProfileSource,
  type ProfileState,
} from '../../src/lib/profile.ts';

const VERSION = 1;

export const EMPTY_STATE: ProfileState = {
  sources: [],
  candidates: [],
  records: [],
  history: [],
  session: null,
  overview: null,
};

export type ProfileStore = {
  load: (userId: string) => ProfileState;
  save: (userId: string, state: ProfileState) => void;
  root: string;
};

function safeUserId(userId: string): string | null {
  return /^[A-Za-z0-9_-]{1,80}$/.test(userId) ? userId : null;
}

export function createProfileStore(rootDir: string): ProfileStore {
  const root = isAbsolute(rootDir) ? rootDir : resolve(rootDir);
  return {
    root,
    load(userId) {
      const id = safeUserId(userId);
      if (!id) return structuredClone(EMPTY_STATE);
      const file = join(root, `${id}.json`);
      if (!existsSync(file)) return structuredClone(EMPTY_STATE);
      try {
        const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
        if (typeof parsed !== 'object' || parsed === null) return structuredClone(EMPTY_STATE);
        const p = parsed as Partial<ProfileState> & { version?: unknown };
        if (p.version !== VERSION) return structuredClone(EMPTY_STATE);
        const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
        return {
          sources: arr<ProfileSource>(p.sources),
          candidates: arr<ProfileCandidate>(p.candidates),
          records: arr<ProfileRecord>(p.records),
          history: arr<ProfileHistoryEntry>(p.history),
          session: p.session && typeof p.session === 'object' ? p.session : null,
          overview: typeof p.overview === 'string' ? p.overview : null,
        };
      } catch {
        return structuredClone(EMPTY_STATE);
      }
    },
    save(userId, state) {
      const id = safeUserId(userId);
      if (!id) return;
      mkdirSync(root, { recursive: true });
      const file = join(root, `${id}.json`);
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify({ version: VERSION, ...state }), 'utf8');
      renameSync(tmp, file);
    },
  };
}

/* ---- pure transitions (unit-tested without touching a disk) --------------- */

export function addSource(
  state: ProfileState,
  input: { type: ProfileSource['type']; url: string; at: string },
): { state: ProfileState; source: ProfileSource | null } {
  if (state.sources.some((s) => s.url === input.url)) return { state, source: null };
  const source: ProfileSource = {
    id: randomUUID(),
    type: input.type,
    url: input.url,
    status: 'pending',
    createdAt: input.at,
    retrievedAt: null,
    error: null,
  };
  return { state: { ...state, sources: [...state.sources, source] }, source };
}

export function removeSource(state: ProfileState, id: string): ProfileState {
  const source = state.sources.find((s) => s.id === id);
  if (!source || source.status === 'ok') return state;
  return {
    ...state,
    sources: state.sources.filter((s) => s.id !== id),
    candidates: state.candidates.filter((c) => c.sourceId !== id),
  };
}

export function startSession(state: ProfileState, at: string): ProfileState {
  return {
    ...state,
    session: { id: randomUUID(), stage: 'sources', createdAt: at, updatedAt: at },
  };
}

export function markSource(
  state: ProfileState,
  id: string,
  result: { status: ProfileSource['status']; at: string; error?: string },
): ProfileState {
  return {
    ...state,
    sources: state.sources.map((s) =>
      s.id === id
        ? { ...s, status: result.status, retrievedAt: result.status === 'ok' ? result.at : s.retrievedAt, error: result.error ?? null }
        : s,
    ),
  };
}

export function addCandidates(
  state: ProfileState,
  source: ProfileSource,
  items: ExtractedItem[],
  at: string,
): ProfileState {
  const existingKeys = new Set(state.records.map((r) => r.key));
  const seen = new Set(state.candidates.map((c) => recordKey(c.category, c.editedContent ?? c.content)));
  const added: ProfileCandidate[] = [];
  for (const item of items) {
    const key = recordKey(item.category, item.content);
    if (existingKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    added.push({
      id: randomUUID(),
      sourceId: source.id,
      sourceUrl: source.url,
      category: item.category,
      content: item.content,
      evidence: item.evidence,
      informationType: item.informationType,
      confidence: item.confidence,
      status: 'pending',
      editedContent: null,
      discoveredAt: at,
      confirmedAt: null,
      confirmedBy: null,
      possibleMatch: state.records.find((r) => r.category === item.category)?.id ?? null,
    });
  }
  return { ...state, candidates: [...state.candidates, ...added] };
}

export function reviewCandidate(
  state: ProfileState,
  id: string,
  action: 'accept' | 'reject' | 'edit',
  content: string | undefined,
  by: string,
  at: string,
): ProfileState {
  return {
    ...state,
    candidates: state.candidates.map((c) => {
      if (c.id !== id) return c;
      if (action === 'reject') {
        return { ...c, status: 'rejected' as CandidateStatus, confirmedAt: at, confirmedBy: by };
      }
      if (action === 'edit') {
        return {
          ...c,
          status: 'edited' as CandidateStatus,
          editedContent: content ?? c.content,
          confirmedAt: at,
          confirmedBy: by,
        };
      }
      return { ...c, status: 'accepted' as CandidateStatus, confirmedAt: at, confirmedBy: by };
    }),
  };
}

/** Commit accepted/edited candidates. Idempotent: re-running creates nothing. */
export function commitCandidates(state: ProfileState, by: string, at: string): ProfileState {
  const accepted = state.candidates.filter((c) => c.status === 'accepted' || c.status === 'edited');
  const records = [...state.records];
  const history = [...state.history];
  let overview = state.overview;
  for (const c of accepted) {
    const content = c.editedContent ?? c.content;
    const key = recordKey(c.category, content);
    const existing = records.find((r) => r.key === key);
    if (existing) {
      /* A rediscovered, already-confirmed item is a no-op — never a silent
         overwrite of the user's earlier decision. */
      continue;
    }
    const record: ProfileRecord = {
      id: randomUUID(),
      key,
      category: c.category,
      content,
      sourceUrl: c.sourceUrl,
      evidence: c.evidence,
      informationType: c.informationType,
      state: 'active',
      createdAt: at,
      discoveredAt: c.discoveredAt,
      updatedAt: at,
      confirmedAt: at,
      confirmedBy: by,
    };
    records.push(record);
    history.push({ id: randomUUID(), recordId: record.id, from: null, to: content, at, by });
  }
  if (accepted.length > 0) {
    overview = buildOverview(records);
  }
  return {
    ...state,
    records,
    history,
    overview,
    /* Accepted candidates keep their status for the audit trail, but commit
       is idempotent because their record keys now exist. */
    session: state.session ? { ...state.session, stage: 'complete', updatedAt: at } : null,
  };
}

/** Confirmed information only — a readable summary, not generated prose. */
export function buildOverview(records: ProfileRecord[]): string {
  const labels: Record<ProfileCategory, string> = {
    basic: 'Basic information',
    interests: 'Interests',
    goals: 'Goals',
    expertise: 'Knowledge & expertise',
    preferences: 'Working preferences',
    activities: 'Ongoing activities',
  };
  const active = records.filter((r) => r.state === 'active');
  if (active.length === 0) return '';
  const lines: string[] = [];
  for (const category of Object.keys(labels) as ProfileCategory[]) {
    const items = active.filter((r) => r.category === category);
    if (items.length === 0) continue;
    lines.push(`${labels[category]}: ${items.map((r) => r.content).join('; ')}.`);
  }
  return lines.join('\n');
}

export function resetSession(state: ProfileState): ProfileState {
  return {
    ...state,
    sources: [],
    candidates: [],
    session: null,
  };
}
