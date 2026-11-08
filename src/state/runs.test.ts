import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The store reads `localStorage` at module load, so every case here re-imports
 * it after seeding the key. A stored payload can be edited by hand or left over
 * from an older build; the surface must not render a state it does not know.
 */

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
});

const KEY = 'thylas:runs:v1';

async function load() {
  vi.resetModules();
  return import('./runs');
}

beforeEach(() => {
  storage.clear();
});

describe('run overrides', () => {
  it('starts empty', async () => {
    const mod = await load();
    expect(mod.runStates()).toEqual({});
  });

  it('keeps a known state and drops an unknown one', async () => {
    storage.set(
      KEY,
      JSON.stringify({ version: 1, states: { 'run-a': 'exploded', 'run-b': 'running' } }),
    );
    const mod = await load();
    expect(mod.runStates()).toEqual({ 'run-b': 'running' });
  });

  it('survives a payload that is not JSON at all', async () => {
    storage.set(KEY, '{not json');
    const mod = await load();
    expect(mod.runStates()).toEqual({});
  });

  it('survives a payload with no states key', async () => {
    storage.set(KEY, JSON.stringify({ version: 1 }));
    const mod = await load();
    expect(mod.runStates()).toEqual({});
  });

  it('persists what it sets, and clears back to the sample', async () => {
    const mod = await load();
    mod.setRunState('run-lit', 'succeeded');
    expect(mod.runStates()).toEqual({ 'run-lit': 'succeeded' });
    expect(JSON.parse(storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      states: { 'run-lit': 'succeeded' },
    });

    mod.clearRunStates();
    expect(mod.runStates()).toEqual({});
    expect(JSON.parse(storage.get(KEY) ?? '{}')).toEqual({ version: 1, states: {} });
  });

  it('replaces a value rather than duplicating the id', async () => {
    const mod = await load();
    mod.setRunState('run-lit', 'running');
    mod.setRunState('run-lit', 'succeeded');
    expect(mod.runStates()).toEqual({ 'run-lit': 'succeeded' });
  });
});
