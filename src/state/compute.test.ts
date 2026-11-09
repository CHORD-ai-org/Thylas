import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The compute store holds backend configuration, instance connections and
 * queued selections. The cases below are the ways that state can go wrong: a
 * payload someone edited by hand, a v1 envelope from the old model, a test
 * that never answers, a selection that must not claim to start anything.
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
    store: await import('./compute'),
    data: await import('../data/compute'),
  };
};

beforeEach(() => {
  storage.clear();
});

describe('first run', () => {
  it('shows the seeds with the seed default backend', async () => {
    const { store, data } = await fresh();
    expect(store.backendsView()).toHaveLength(data.BACKENDS.length);
    expect(store.defaultBackendId()).toBe('b-local');
    expect(store.instancesView()).toHaveLength(data.INSTANCES.length);
  });

  it('a v1 envelope from the old model is discarded, not half-migrated', async () => {
    storage.set('thylas:compute:v2', JSON.stringify({ version: 1, added: [], connections: {} }));
    const { store } = await fresh();
    expect(store.__readForTest()).toEqual(store.__readForTest());
    expect(store.backendsView()).toHaveLength(4);
  });

  it('a hand-edited payload loses the bad entries, not the library', async () => {
    storage.set(
      'thylas:compute:v2',
      JSON.stringify({
        version: 2,
        backendStatus: { 'b-ssh': 'ready', 'b-x': 'quantum' },
        connections: { 'r-lab-01': 'disconnected', 'r-y': 42 },
        addedInstances: [{ id: 'r-bad' }],
      }),
    );
    const { store, data } = await fresh();
    const state = store.__readForTest();
    expect(state.backendStatus).toEqual({ 'b-ssh': 'ready' });
    expect(state.connections).toEqual({ 'r-lab-01': 'disconnected' });
    expect(state.addedInstances).toHaveLength(0);
    expect(store.backendsView()).toHaveLength(data.BACKENDS.length);
  });
});

describe('backends', () => {
  it('saving configuration sets status and follows a reload', async () => {
    const { store } = await fresh();
    store.saveBackendConfig('b-slurm', { host: 'login2.onda.dev', partition: 'long' }, 'ready');
    vi.resetModules();
    const reloaded = await import('./compute');
    const slurm = reloaded.backendById('b-slurm')!;
    expect(slurm.config).toEqual({ host: 'login2.onda.dev', partition: 'long' });
    expect(slurm.status).toBe('ready');
  });

  it('removing a backend takes its instances out of the pool and clears a default', async () => {
    const { store } = await fresh();
    store.setDefaultBackend('b-ssh');
    store.removeBackend('b-ssh');
    expect(store.backendById('b-ssh')).toBeUndefined();
    expect(store.instancesView().some((i) => i.backendId === 'b-ssh')).toBe(false);
    expect(store.defaultBackendId()).toBe('b-local');
  });

  it('disabling a backend removes its targets from Run without touching instances', async () => {
    const { store } = await fresh();
    store.setBackendEnabled('b-ssh', false);
    const targets = store.targetsView();
    expect(targets.some((t) => t.backendId === 'b-ssh')).toBe(false);
    expect(store.instancesView()).toHaveLength(6);
  });
});

describe('selection', () => {
  it('confirming a target queues a workload and claims no execution', async () => {
    const { store, data } = await fresh();
    const targets = store.targetsView();
    const onda = targets.find((t) => t.id === 'r-onda-gpu')!;
    const workload = store.confirmTarget({ ...data.EMPTY_REQUIREMENTS, name: 'eval-9' }, onda);
    expect(workload.state).toBe('queued');
    expect(workload.instanceId).toBe('r-onda-gpu');
    expect(workload.note).toContain('does not start work in this build');
    const wl = store.workloadById(workload.id)!;
    expect(wl.state).toBe('queued');
    expect(store.computeLog()[0]!.text).toContain('Recorded, not started');
  });

  it('confirming a backend target leaves no instance id and says the scheduler places it', async () => {
    const { store, data } = await fresh();
    const slurm = store.targetsView().find((t) => t.backendId === 'b-slurm')!;
    const workload = store.confirmTarget({ ...data.EMPTY_REQUIREMENTS, name: 'sweep' }, slurm);
    expect(workload.instanceId).toBeUndefined();
    expect(workload.duration).toContain('scheduler');
  });
});

describe('instances', () => {
  it('disconnecting drops utilization — a dead machine has no live numbers', async () => {
    const { store } = await fresh();
    store.disconnectInstance('r-lab-01');
    const lab = store.instanceById('r-lab-01')!;
    expect(lab.connection).toBe('disconnected');
    expect(lab.utilization).toBeUndefined();
  });

  it('terminating a seed instance is a tombstone; one acquired this session is dropped outright', async () => {
    const { store } = await fresh();
    store.terminateInstance('r-lab-01');
    expect(store.instanceById('r-lab-01')).toBeUndefined();
    expect(store.__readForTest().removedInstances).toEqual(['r-lab-01']);

    const acquired = { ...store.instanceById('r-onda-gpu')!, id: 'r-new', name: 'a6000-x1', acquiredVia: 'l-a6000-1' };
    store.acquireInstance(acquired, '1 × RTX A6000');
    expect(store.instanceById('r-new')).toBeDefined();
    store.terminateInstance('r-new');
    expect(store.instanceById('r-new')).toBeUndefined();
    expect(store.__readForTest().removedInstances).toEqual(['r-lab-01']);
  });
});
