import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The two lists this store owns — created and tombstoned — are the only state a
 * workspace has. The cases below are the ways that state can go wrong: a name
 * that duplicates another, a payload someone edited by hand, a delete that
 * leaves the deleted workspace's files reachable.
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
  return {
    store: await import('./workspaces'),
    notes: await import('./notes'),
    selectors: await import('../data/selectors'),
    mock: await import('../data/mock'),
  };
};

beforeEach(() => {
  storage.clear();
});

describe('first run', () => {
  it('shows the two samples with counts derived from the data, not declared', async () => {
    const { store, mock } = await fresh();
    const list = store.listWorkspaces();

    expect(list.map((w) => w.name)).toEqual(['Research', 'Onda Lab']);
    for (const ws of list) {
      expect(ws.counts.files).toBe(mock.FILES.filter((f) => f.wsId === ws.id).length);
      expect(ws.counts.boards).toBe(mock.BOARDS.filter((b) => b.wsId === ws.id).length);
      expect(ws.counts.processes).toBe(mock.PROCESSES.filter((p) => p.wsId === ws.id).length);
    }
  });

  it('has no created or deleted list until something happens', async () => {
    const { store } = await fresh();

    expect(storage.has('thylas:workspaces:v1')).toBe(false);
    expect(store.liveIds().size).toBe(2);
  });
});

describe('createWorkspace', () => {
  it('trims, de-duplicates spaces, and starts empty', async () => {
    const { store } = await fresh();
    const result = store.createWorkspace('  Field   notes ');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.name).toBe('Field notes');
    expect(result.workspace.counts).toEqual({ files: 0, boards: 0, processes: 0, notes: 0 });
    expect(store.workspaceExists(result.workspace.id)).toBe(true);
    expect(store.listWorkspaces()).toHaveLength(3);
  });

  it('refuses a blank name', async () => {
    const { store } = await fresh();
    const result = store.createWorkspace('   ');

    expect(result).toMatchObject({ ok: false, reason: 'empty' });
    expect(store.listWorkspaces()).toHaveLength(2);
  });

  it('refuses a name over the cap and says the length', async () => {
    const { store } = await fresh();
    const result = store.createWorkspace('x'.repeat(store.MAX_WORKSPACE_NAME + 1));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('too-long');
    expect(result.message).toContain(String(store.MAX_WORKSPACE_NAME + 1));
  });

  it('refuses a name that differs only by case', async () => {
    const { store } = await fresh();
    const result = store.createWorkspace('research');

    expect(result).toMatchObject({ ok: false, reason: 'duplicate' });
    expect(store.listWorkspaces()).toHaveLength(2);
  });

  it('gives two workspaces with the same slug different ids', async () => {
    const { store } = await fresh();
    /* Both names slug to "notes"; only the id suffix keeps them apart. */
    const a = store.createWorkspace('Notes 1');
    const b = store.createWorkspace('Notes 1!');
    const c = store.createWorkspace('Notes 2');

    const ids = [a, b, c].flatMap((r) => (r.ok ? [r.workspace.id] : []));
    expect(new Set(ids).size).toBe(3);
  });

  it('survives a reload', async () => {
    const first = await fresh();
    const made = first.store.createWorkspace('Field notes');

    /* `vi.resetModules` drops the module-level snapshot; the payload is the only
       thing that carries over. */
    vi.resetModules();
    const second = await import('./workspaces');

    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(second.workspaceExists(made.workspace.id)).toBe(true);
    expect(second.listWorkspaces().map((w) => w.name)).toContain('Field notes');
  });
});

describe('deleteWorkspace', () => {
  it('removes a sample and keeps it removed across a reload', async () => {
    const { store } = await fresh();
    const summary = store.deleteWorkspace('ws-onda');

    expect(summary).toMatchObject({ name: 'Onda Lab' });
    expect(store.listWorkspaces().map((w) => w.id)).toEqual(['ws-research']);

    vi.resetModules();
    const reloaded = await import('./workspaces');
    expect(reloaded.listWorkspaces().map((w) => w.id)).toEqual(['ws-research']);
  });

  it('takes the workspace’s files, boards, runs and recent entries out of reach', async () => {
    const { store, selectors } = await fresh();
    store.deleteWorkspace('ws-research');

    expect(selectors.getWorkspace('ws-research')).toBeUndefined();
    expect(selectors.filesIn('ws-research')).toEqual([]);
    expect(selectors.boardsIn('ws-research')).toEqual([]);
    expect(selectors.processesIn('ws-research')).toEqual([]);
    expect(selectors.getFile('f-raw-runs')).toBeUndefined();
    expect(selectors.getProcess('run-baseline')).toBeUndefined();
    expect(selectors.foldersIn('ws-research')).toEqual([]);
    expect(selectors.recent().every((item) => item.wsId !== 'ws-research')).toBe(true);
    expect(selectors.needsInput().every((run) => run.wsId !== 'ws-research')).toBe(true);
  });

  it('deletes the notes written in it and leaves the others', async () => {
    const { store, notes } = await fresh();
    const summary = store.deleteWorkspace('ws-research');

    expect(summary?.notes).toBe(2);
    const left = notes.listNotes();
    expect(left.some((n) => n.id === 'n-method')).toBe(false);
    expect(left.some((n) => n.id === 'n-questions')).toBe(false);
    /* n-reading is personal: it has no workspace, so no workspace delete reaches it. */
    expect(left.some((n) => n.id === 'n-reading')).toBe(true);
  });

  it('removes a created workspace without tombstoning anything', async () => {
    const { store } = await fresh();
    const made = store.createWorkspace('Field notes');
    if (!made.ok) throw new Error('create failed');

    store.deleteWorkspace(made.workspace.id);

    expect(store.listWorkspaces()).toHaveLength(2);
    expect(JSON.parse(storage.get('thylas:workspaces:v1') ?? '{}').deleted).toEqual([]);
  });

  it('reports nothing for an id it does not know', async () => {
    const { store } = await fresh();

    expect(store.deleteWorkspace('ws-nope')).toBeNull();
  });
});

describe('a payload someone edited', () => {
  it('drops the entries it cannot trust and keeps the rest', async () => {
    storage.set(
      'thylas:workspaces:v1',
      JSON.stringify({
        version: 1,
        created: [
          { id: 'ws-good-1', name: 'Good', createdAt: 1 },
          { id: 'not-a-workspace', name: 'Bad id', createdAt: 1 },
          { id: 'ws-empty-1', name: '   ', createdAt: 1 },
          { id: 'ws-long-1', name: 'x'.repeat(200), createdAt: 1 },
          'nonsense',
        ],
        deleted: ['ws-onda', 42],
      }),
    );

    const { store } = await fresh();
    const list = store.listWorkspaces();

    expect(list.map((w) => w.name)).toEqual(['Research', 'Good']);
    expect(store.workspaceExists('ws-onda')).toBe(false);
  });

  it('ignores a payload from an unknown version', async () => {
    storage.set('thylas:workspaces:v1', JSON.stringify({ version: 99, created: [], deleted: ['ws-onda'] }));

    const { store } = await fresh();
    expect(store.listWorkspaces()).toHaveLength(2);
  });

  it('recovers from text that is not JSON', async () => {
    storage.set('thylas:workspaces:v1', '{oops');

    const { store } = await fresh();
    expect(store.listWorkspaces()).toHaveLength(2);
  });
});

describe('resetWorkspaces', () => {
  it('brings the samples back and drops the ones made here', async () => {
    const { store } = await fresh();
    store.deleteWorkspace('ws-onda');
    store.createWorkspace('Field notes');
    expect(store.listWorkspaces()).toHaveLength(2);

    store.resetWorkspaces();

    expect(store.listWorkspaces().map((w) => w.id)).toEqual(['ws-research', 'ws-onda']);
  });
});
