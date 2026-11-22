/**
 * Artifact-candidate review session (roadmap P0-7/P0-8).
 *
 * Mirrors the profile pipeline's governance shape (`server/profile/store.ts`):
 * candidates carry evidence + a review status, only accepted/edited ones are
 * committed, commit is idempotent by content key and never silently overwrites,
 * and every action lands in an append-only history. Committing turns a
 * candidate into a **canonical Artifact** via the artifacts store.
 *
 * Local prototype: this envelope is client-side and the extractor is offline
 * (see `lib/artifact-extract.ts`). Nothing here implies a server pipeline.
 */
import { useSyncExternalStore } from 'react';
import { createArtifact } from './artifacts';
import type { ExtractedCandidate, Evidence } from '../lib/artifact-extract';

const KEY = 'thylas:artifact-candidates:v1';

export type CandidateStatus = 'pending' | 'accepted' | 'rejected' | 'edited';

export type ReviewCandidate = ExtractedCandidate & {
  status: CandidateStatus;
  editedContent?: string;
  editedName?: string;
};

export type CandidateHistoryEntry = {
  id: string;
  at: number;
  by: string;
  action: 'extracted' | 'reviewed' | 'committed' | 'rejected';
  candidateId: string;
  artifactId?: string;
};

export type CandidatesState = {
  version: 1;
  sourceNames: string[];
  candidates: ReviewCandidate[];
  committed: { candidateId: string; artifactId: string; name: string; key: string }[];
  history: CandidateHistoryEntry[];
};

const EMPTY: CandidatesState = {
  version: 1,
  sourceNames: [],
  candidates: [],
  committed: [],
  history: [],
};

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq += 1).toString(36)}`;

function read(): CandidatesState {
  if (typeof localStorage === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CandidatesState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.candidates)) return EMPTY;
    return { ...EMPTY, ...parsed } as CandidatesState;
  } catch {
    return EMPTY;
  }
}

let snapshot: CandidatesState = read();
const listeners = new Set<() => void>();

function commit(next: CandidatesState): void {
  snapshot = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
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

export function useArtifactCandidates(): CandidatesState {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function candidatesView(): CandidatesState {
  return snapshot;
}

/** Replace the working set with a fresh extraction. History is kept. */
export function loadCandidates(sourceNames: string[], candidates: ExtractedCandidate[], by = 'you'): void {
  const at = Date.now();
  const reviewed: ReviewCandidate[] = candidates.map((c) => ({ ...c, status: 'pending' }));
  commit({
    ...snapshot,
    sourceNames,
    candidates: reviewed,
    history: [
      ...snapshot.history,
      ...reviewed.map((c) => ({ id: uid('h'), at, by, action: 'extracted' as const, candidateId: c.id })),
    ],
  });
}

export function reviewCandidate(
  id: string,
  patch: { status?: CandidateStatus; editedContent?: string; editedName?: string },
  by = 'you',
): void {
  const candidates = snapshot.candidates.map((c) => (c.id === id ? { ...c, ...patch } : c));
  const target = candidates.find((c) => c.id === id);
  if (!target) return;
  commit({
    ...snapshot,
    candidates,
    history: [
      ...snapshot.history,
      { id: uid('h'), at: Date.now(), by, action: patch.status === 'rejected' ? 'rejected' : 'reviewed', candidateId: id },
    ],
  });
}

/** Content key — commit is idempotent by this, like profile's recordKey. */
export function candidateKey(c: ReviewCandidate): string {
  return `${c.kind}:${(c.editedName ?? c.name).trim().toLowerCase()}`;
}

/**
 * Commit accepted (and edited) candidates as canonical Artifacts. Already
 * committed keys are skipped — a second commit never creates a duplicate and
 * never overwrites an existing artifact.
 */
export function commitCandidates(by = 'you'): { committed: number; skipped: number } {
  const done = new Set(snapshot.committed.map((c) => c.candidateId));
  const keys = new Set(snapshot.committed.map((c) => c.key));
  const at = Date.now();
  const committed: CandidatesState['committed'] = [...snapshot.committed];
  const history = [...snapshot.history];
  let committedCount = 0;
  let skipped = 0;

  for (const c of snapshot.candidates) {
    if (c.status !== 'accepted' && c.status !== 'edited') continue;
    const key = candidateKey(c);
    if (done.has(c.id) || keys.has(key)) {
      skipped += 1;
      continue;
    }
    const name = (c.editedName ?? c.name).trim();
    const body = c.editedContent ?? c.content;
    const artifact = createArtifact({
      kind: c.kind,
      name,
      summary: body.slice(0, 160),
      firstTitle: name,
      firstBody: body,
      author: by,
      /* Provenance travels with the artifact: which sources produced it. */
      source: 'native',
    });
    committed.push({ candidateId: c.id, artifactId: artifact.id, name, key });
    keys.add(key);
    history.push({ id: uid('h'), at, by, action: 'committed', candidateId: c.id, artifactId: artifact.id });
    committedCount += 1;
  }

  commit({ ...snapshot, committed, history });
  return { committed: committedCount, skipped };
}

export function resetCandidates(): void {
  commit({ ...EMPTY, history: snapshot.history });
}

export type { Evidence };
