import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The coworkers store: creation, responsibility edits, status transitions,
 * membership add/remove, and the ways a hand-edited payload breaks. Seeds are
 * never touched; attribution survives removal.
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
  return { store: await import('./coworkers') };
};

beforeEach(() => {
  storage.clear();
});

describe('seeds', () => {
  it('shows three coworkers, active first', async () => {
    const { store } = await fresh();
    const view = store.coworkersView();
    expect(view).toHaveLength(3);
    expect(view[0]!.status).toBe('active');
    expect(view.filter((c) => c.status === 'active')).toHaveLength(2);
  });

  it('the scribe has two memberships from seeds', async () => {
    const { store } = await fresh();
    expect(store.coworkerById('cw-scribe')!.memberships).toHaveLength(2);
  });

  it('a hand-edited payload loses bad entries, not the library', async () => {
    storage.set(
      'thylas:coworkers:v1',
      JSON.stringify({
        version: 1,
        added: [{ id: 'cw-nope' }],
        removed: ['cw-not-a-seed', 'cw-reviewer'],
        responsibilityOverrides: { 'cw-scribe': { forWork: 'x', notFor: 'y', output: 'z' }, bad: null },
        statusOverrides: { 'cw-scribe': 'paused', junk: 'nope' },
        membershipsAdded: [{ coworkerId: 'cw-scribe', wsId: 'ws-onda', role: 'r' }, { coworkerId: 'x' }],
      }),
    );
    const { store } = await fresh();
    const state = store.__readForTest();
    expect(state.added).toHaveLength(0);
    expect(state.removed).toEqual(['cw-reviewer']);
    expect(state.responsibilityOverrides['cw-scribe']).toEqual({ forWork: 'x', notFor: 'y', output: 'z' });
    expect(state.statusOverrides['cw-scribe']).toBe('paused');
    expect(state.membershipsAdded).toHaveLength(1);
    const scribe = store.coworkerById('cw-scribe')!;
    expect(scribe.status).toBe('paused');
    expect(scribe.memberships.some((m) => m.wsId === 'ws-onda')).toBe(true);
  });
});

describe('create', () => {
  it('creates an active coworker with the brief and optional membership', async () => {
    const { store } = await fresh();
    const created = store.createCoworker({
      name: '  Draft Checker  ',
      description: 'Checks drafts.',
      forWork: 'Checks drafts',
      notFor: 'Does not write',
      output: 'A checklist',
      membership: { wsId: 'ws-research', role: 'checks drafts' },
    });
    expect(created.status).toBe('active');
    expect(created.name).toBe('Draft Checker');
    expect(created.memberships).toEqual([{ wsId: 'ws-research', role: 'checks drafts' }]);
    const view = store.coworkerById(created.id)!;
    expect(view.responsibilities.forWork).toBe('Checks drafts');
    expect(store.__readForTest().log[0]!.text).toContain('Created');
  });
});

describe('config edits', () => {
  it('responsibility edits override and survive a reload', async () => {
    const { store } = await fresh();
    store.saveResponsibilities('cw-reviewer', { forWork: 'new brief', notFor: 'still not running', output: 'same' });
    expect(store.coworkerById('cw-reviewer')!.responsibilities.forWork).toBe('new brief');
    vi.resetModules();
    const reloaded = await import('./coworkers');
    expect(reloaded.coworkerById('cw-reviewer')!.responsibilities.forWork).toBe('new brief');
    expect(reloaded.__readForTest().log[0]!.text).toContain('responsibilities');
  });

  it('status transitions log but do not touch memberships', async () => {
    const { store } = await fresh();
    const memberships = store.coworkerById('cw-reviewer')!.memberships.length;
    store.setCoworkerStatus('cw-reviewer', 'paused');
    expect(store.coworkerById('cw-reviewer')!.status).toBe('paused');
    expect(store.coworkerById('cw-reviewer')!.memberships.length).toBe(memberships);
    expect(store.__readForTest().log[0]!.text).toContain('paused');
  });
});

describe('memberships', () => {
  it('add then remove round-trips; removing a seed membership is recorded', async () => {
    const { store } = await fresh();
    store.addMembership('cw-reviewer', 'ws-onda', 'cross reviews');
    expect(store.coworkerById('cw-reviewer')!.memberships.some((m) => m.wsId === 'ws-onda')).toBe(true);
    store.removeMembership('cw-reviewer', 'ws-onda');
    expect(store.coworkerById('cw-reviewer')!.memberships.some((m) => m.wsId === 'ws-onda')).toBe(false);
    store.removeMembership('cw-reviewer', 'ws-research');
    expect(store.coworkerById('cw-reviewer')!.memberships).toHaveLength(0);
    expect(store.__readForTest().log[0]!.text).toContain('work record stays');
  });

  it('adding to a workspace already joined is a no-op', async () => {
    const { store } = await fresh();
    store.addMembership('cw-scribe', 'ws-onda', 'again');
    expect(store.coworkerById('cw-scribe')!.memberships.filter((m) => m.wsId === 'ws-onda')).toHaveLength(1);
  });
});

describe('mind framework (D-060)', () => {
  it('a created coworker gets a valid default framework', async () => {
    const { store } = await fresh();
    const created = store.createCoworker({
      name: 'Fresh',
      description: '',
      forWork: '',
      notFor: '',
      output: '',
    });
    expect(store.coworkerById(created.id)!.mindFramework?.version).toBe(1);
    expect(store.coworkerById(created.id)!.mindFramework!.principles.length).toBeGreaterThan(0);
    expect(store.__readForTest().added[0]!.mindFramework?.version).toBe(1);
  });

  it('a hand-edited framework is dropped but the coworker survives', async () => {
    storage.set(
      'thylas:coworkers:v1',
      JSON.stringify({
        version: 1,
        added: [
          {
            id: 'cw-hand',
            name: 'Hand edited',
            description: '',
            status: 'active',
            createdAt: 1,
            responsibilities: { forWork: 'a', notFor: 'b', output: 'c' },
            memberships: [],
            pinnedArtifactIds: [],
            mindFramework: { version: 999, principles: [7] },
          },
        ],
      }),
    );
    const { store } = await fresh();
    expect(store.__readForTest().added).toHaveLength(1);
    expect(store.__readForTest().added[0]!.mindFramework).toBeUndefined();
    expect(store.coworkerById('cw-hand')!.mindFramework?.version).toBe(1);
  });

  it('seeds carry distinct declared frameworks', async () => {
    const { store } = await fresh();
    const reviewer = store.coworkerById('cw-reviewer')!.mindFramework!;
    const scribe = store.coworkerById('cw-scribe')!.mindFramework!;
    expect(reviewer.version).toBe(1);
    expect(reviewer.principles[0]).not.toBe(scribe.principles[0]);
  });
});

describe('tombstones', () => {
  it('removing a seed is a tombstone; removing a created one drops it', async () => {
    const { store } = await fresh();
    const created = store.createCoworker({
      name: 'Temp',
      description: '',
      forWork: '',
      notFor: '',
      output: '',
    });
    store.removeCoworker(created.id);
    expect(store.coworkerById(created.id)).toBeUndefined();
    expect(store.__readForTest().removed).toEqual([]);
    store.removeCoworker('cw-reviewer');
    expect(store.coworkerById('cw-reviewer')).toBeUndefined();
    expect(store.__readForTest().removed).toEqual(['cw-reviewer']);
  });
});
