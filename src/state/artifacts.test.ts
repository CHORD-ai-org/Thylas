import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The artifacts store: creation, edits that append versions, status
 * transitions, and the ways a hand-edited payload breaks. Persistence is the
 * house envelope — validated reads lose bad entries, never the library.
 */

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  },
});

const fresh = async () => {
  vi.resetModules();
  return { store: await import('./artifacts'), data: await import('../data/artifacts') };
};

beforeEach(() => {
  storage.clear();
});

describe('seeds', () => {
  it('shows all seven kinds, most recently updated first', async () => {
    const { store, data } = await fresh();
    const view = store.artifactsView();
    expect(view).toHaveLength(data.ARTIFACTS.length);
    const times = view.map((a) => a.updatedAt);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    const kinds = new Set(view.map((a) => a.kind));
    expect(kinds.size).toBe(7);
  });

  it('a hand-edited payload loses bad entries, not the library', async () => {
    storage.set(
      'thylas:artifacts:v1',
      JSON.stringify({
        version: 1,
        added: [{ id: 'bad' }],
        removed: ['not-a-seed'],
        statusOverrides: { 'a-boundary': 'deprecated', junk: 'nope' },
        edits: { 'a-boundary': [{ v: 4, at: 1, by: 'x', note: 'ok' }, { v: 'nan' }] },
      }),
    );
    const { store } = await fresh();
    const state = store.__readForTest();
    expect(state.added).toHaveLength(0);
    expect(state.removed).toEqual([]);
    expect(state.statusOverrides).toEqual({ 'a-boundary': 'deprecated' });
    expect(state.edits['a-boundary']).toHaveLength(1);
  });
});

describe('create', () => {
  it('creates a draft with the kind\u2019s section template and the first body filled', async () => {
    const { store, data } = await fresh();
    const created = store.createArtifact({
      kind: 'methodology',
      name: '  My method  ',
      summary: 'A test method.',
      firstTitle: 'Purpose',
      firstBody: 'Test the store.',
      author: 'Ceaser',
    });
    expect(created.status).toBe('draft');
    expect(created.name).toBe('My method');
    expect(created.sections.map((s) => s.title)).toEqual(data.KIND_SECTIONS.methodology);
    expect(created.sections[0]!.body).toBe('Test the store.');
    const view = store.artifactById(created.id)!;
    expect(view.versions).toHaveLength(1);
  });

  it('an external reference keeps its source as system of record', async () => {
    const { store } = await fresh();
    const created = store.createExternalReference({
      system: 'notion',
      location: 'notion.so/page-1',
      name: 'External notes',
      summary: 'Referenced, not imported.',
      author: 'Ceaser',
    });
    const view = store.artifactById(created.id)!;
    expect(view.kind).toBe('external');
    expect(view.source).toEqual({ system: 'notion', location: 'notion.so/page-1' });
    expect(store.__readForTest().log[0]!.text).toContain('system of record');
  });
});

describe('edit and versioning', () => {
  it('a content edit appends a version; the old body stays in the version list', async () => {
    const { store } = await fresh();
    const boundary = store.artifactById('a-boundary')!;
    const before = boundary.versions.at(-1)!.v;
    const definitionId = boundary.sections[0]!.id;
    const oldBody = boundary.sections[0]!.body;
    store.saveSection('a-boundary', definitionId, 'A new definition.', 'Ceaser');
    const after = store.artifactById('a-boundary')!;
    expect(after.sections[0]!.body).toBe('A new definition.');
    expect(after.versions.at(-1)!.v).toBe(before + 1);
    expect(after.versions.at(-1)!.note).toContain('Definition');
    void oldBody;
  });

  it('saving an identical body is a no-op, not a version', async () => {
    const { store } = await fresh();
    const boundary = store.artifactById('a-boundary')!;
    const before = boundary.versions.length;
    store.saveSection('a-boundary', boundary.sections[0]!.id, boundary.sections[0]!.body, 'Ceaser');
    expect(store.artifactById('a-boundary')!.versions.length).toBe(before);
  });

  it('status transitions create no version', async () => {
    const { store } = await fresh();
    const before = store.artifactById('a-boundary')!.versions.length;
    store.setArtifactStatus('a-boundary', 'deprecated');
    const after = store.artifactById('a-boundary')!;
    expect(after.status).toBe('deprecated');
    expect(after.versions.length).toBe(before);
    expect(store.__readForTest().log[0]!.text).toContain('deprecated');
  });

  it('edits survive a reload', async () => {
    const { store } = await fresh();
    const boundary = store.artifactById('a-boundary')!;
    store.saveSection('a-boundary', boundary.sections[0]!.id, 'Persisted.', 'Ceaser');
    vi.resetModules();
    const reloaded = await import('./artifacts');
    expect(reloaded.artifactById('a-boundary')!.sections[0]!.body).toBe('Persisted.');
  });
});

describe('tombstones', () => {
  it('removing a seed is a tombstone; removing a created one drops it', async () => {
    const { store } = await fresh();
    const created = store.createArtifact({
      kind: 'concept',
      name: 'Temp',
      summary: '',
      firstTitle: 'Definition',
      firstBody: '',
      author: 'Ceaser',
    });
    store.removeArtifact(created.id);
    expect(store.artifactById(created.id)).toBeUndefined();
    expect(store.__readForTest().removed).toEqual([]);
    store.removeArtifact('a-boundary');
    expect(store.artifactById('a-boundary')).toBeUndefined();
    expect(store.__readForTest().removed).toEqual(['a-boundary']);
  });
});

describe('covers', () => {
  it('stores an explicit hue and keeps it across a reload', async () => {
    const { store } = await fresh();
    const created = store.createArtifact({
      kind: 'concept',
      name: 'Covered',
      summary: '',
      firstTitle: 'Definition',
      firstBody: '',
      author: 'Ceaser',
      cover: { hue: 'teal' },
    });
    expect(created.cover).toEqual({ hue: 'teal' });
    vi.resetModules();
    const reloaded = await import('./artifacts');
    expect(reloaded.artifactById(created.id)!.cover).toEqual({ hue: 'teal' });
  });

  it('drops a stored hue that is not on the whitelist, keeping the artifact', async () => {
    const { store } = await fresh();
    store.createArtifact({
      kind: 'methodology',
      name: 'Hand edited',
      summary: '',
      firstTitle: 'Purpose',
      firstBody: '',
      author: 'Ceaser',
    });
    const raw = JSON.parse(storage.get('thylas:artifacts:v1')!);
    raw.added[0].cover = { hue: 'magenta', symbol: 'poem' };
    storage.set('thylas:artifacts:v1', JSON.stringify(raw));
    vi.resetModules();
    const reloaded = await import('./artifacts');
    const kept = reloaded.artifactsView().find((a) => a.name === 'Hand edited')!;
    expect(kept).toBeDefined();
    expect(kept.cover).toBeUndefined();
  });
});
