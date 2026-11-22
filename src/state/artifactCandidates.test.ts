import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractCandidates } from '../lib/artifact-extract';

/**
 * Extract → review → commit governance, mirroring the profile pipeline. The
 * stores cache state at module load, so each case re-imports them fresh after a
 * `vi.resetModules()` — the same pattern the notes and chat tests use.
 */
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  },
});

const sources = [
  {
    id: 'n-diary',
    name: 'Diary 2026-10',
    body: 'Working Context is the bound subset a task may read. We agreed the retrieval step stays explicit. The roadmap plan needs a new spec section.',
  },
  {
    id: 'n-elarie',
    name: 'Elarie conversations',
    body: 'Context Entry is a governed record of one claim. The benchmark result showed the method protocol holds.',
  },
];

const fresh = async () => {
  vi.resetModules();
  const store = await import('./artifactCandidates');
  const arts = await import('./artifacts');
  return { ...store, artifactsView: arts.artifactsView };
};

beforeEach(() => {
  storage.clear();
});

describe('extraction', () => {
  it('produces candidates with citable evidence spans', () => {
    const candidates = extractCandidates(sources);
    expect(candidates.length).toBeGreaterThan(2);
    for (const c of candidates) {
      expect(c.evidence.length).toBeGreaterThan(0);
      const span = c.evidence[0]!.span;
      const source = sources.find((s) => s.id === c.evidence[0]!.sourceId)!;
      expect(source.body).toContain(span); // evidence is findable in the source
      expect(c.name.length).toBeGreaterThan(0);
    }
  });

  it('classifies kinds and information type', () => {
    const candidates = extractCandidates(sources);
    expect(candidates.some((c) => c.kind === 'methodology')).toBe(true);
    expect(candidates.some((c) => c.kind === 'concept')).toBe(true);
    expect(candidates.some((c) => c.informationType === 'explicit')).toBe(true);
  });
});

describe('review → commit (governance)', () => {
  it('commits only accepted/edited candidates as artifacts, with history', async () => {
    const s = await fresh();
    const candidates = extractCandidates(sources);
    s.loadCandidates(sources.map((x) => x.name), candidates);
    expect(s.candidatesView().candidates.every((c) => c.status === 'pending')).toBe(true);

    const [a, b, c] = s.candidatesView().candidates;
    s.reviewCandidate(a!.id, { status: 'accepted' });
    s.reviewCandidate(b!.id, { status: 'rejected' });
    s.reviewCandidate(c!.id, { status: 'edited', editedContent: 'edited body' });

    const before = s.artifactsView().length;
    const { committed } = s.commitCandidates();
    expect(committed).toBe(2); // accepted + edited, not the rejected one
    expect(s.artifactsView().length).toBe(before + 2);

    const history = s.candidatesView().history;
    expect(history.some((h) => h.action === 'committed')).toBe(true);
    expect(history.some((h) => h.action === 'rejected')).toBe(true);
  });

  it('is idempotent — a second commit adds nothing and overwrites nothing', async () => {
    const s = await fresh();
    const candidates = extractCandidates(sources);
    s.loadCandidates(sources.map((x) => x.name), candidates);
    for (const c of s.candidatesView().candidates) s.reviewCandidate(c.id, { status: 'accepted' });

    const first = s.commitCandidates();
    const afterFirst = s.artifactsView().length;
    const second = s.commitCandidates();
    expect(first.committed).toBeGreaterThan(0);
    expect(second.committed).toBe(0);
    expect(second.skipped).toBe(first.committed);
    expect(s.artifactsView().length).toBe(afterFirst);
  });

  it('keys candidates by kind + edited name so a rename is a distinct commit', async () => {
    const s = await fresh();
    const candidates = extractCandidates(sources);
    s.loadCandidates(sources.map((x) => x.name), candidates);
    const c = s.candidatesView().candidates[0]!;
    expect(s.candidateKey(c)).toContain(c.kind);
    s.reviewCandidate(c.id, { status: 'edited', editedName: 'Renamed Thing' });
    expect(s.candidateKey(s.candidatesView().candidates[0]!)).toContain('renamed thing');
  });
});

describe('reset', () => {
  it('clears the working set but keeps the audit history', async () => {
    const s = await fresh();
    const candidates = extractCandidates(sources);
    s.loadCandidates(sources.map((x) => x.name), candidates);
    const historyBefore = s.candidatesView().history.length;
    s.resetCandidates();
    expect(s.candidatesView().candidates).toHaveLength(0);
    expect(s.candidatesView().history.length).toBe(historyBefore);
  });
});
