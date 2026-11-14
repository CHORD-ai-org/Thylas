import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The user store holds one profile override and a preferences envelope. The
 * cases below are the ways that state can go wrong: a payload someone edited
 * by hand, an empty name, a landing value the router would not understand.
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
  return { store: await import('./user') };
};

beforeEach(() => {
  storage.clear();
});

describe('first run', () => {
  it('falls back to the identity-provider name and default prefs', async () => {
    const { store } = await fresh();
    expect(store.displayNameOf(store.__readForTest(), 'Ceaser Zhao')).toBe('Ceaser Zhao');
    expect(store.prefsOf(store.__readForTest())).toEqual({
      landing: 'overview',
      density: 'comfortable',
      theme: 'warm',
      defaultWorkspace: null,
    });
  });
});

describe('display name', () => {
  it('overrides the fallback and survives a reload', async () => {
    const { store } = await fresh();
    store.setDisplayName('C. Zhao');
    vi.resetModules();
    const reloaded = await import('./user');
    expect(reloaded.displayNameOf(reloaded.__readForTest(), 'Ceaser Zhao')).toBe('C. Zhao');
  });

  it('an empty or whitespace name clears the override instead of blanking the UI', async () => {
    const { store } = await fresh();
    store.setDisplayName('   ');
    expect(store.__readForTest().displayName).toBeUndefined();
    expect(store.displayNameOf(store.__readForTest(), 'Ceaser Zhao')).toBe('Ceaser Zhao');
  });
});

describe('preferences', () => {
  it('a hand-edited payload loses the bad entry, not the good one', async () => {
    const { store } = await fresh();
    store.setPref('landing', 'notes');
    store.setPref('density', 'compact');
    storage.set(
      'thylas:user:v1',
      JSON.stringify({
        version: 1,
        prefs: { landing: 'https://evil.example', density: 'compact' },
      }),
    );
    vi.resetModules();
    const reloaded = await import('./user');
    const prefs = reloaded.prefsOf(reloaded.__readForTest());
    expect(prefs.landing).toBe('overview');
    expect(prefs.density).toBe('compact');
  });

  it('an unknown version envelope is ignored entirely', async () => {
    storage.set('thylas:user:v1', JSON.stringify({ version: 9, displayName: 'X' }));
    const { store } = await fresh();
    expect(store.__readForTest()).toEqual({ prefs: {} });
  });

  it('the landing path maps each value to a real route', async () => {
    const { store } = await fresh();
    store.setPref('landing', 'recently');
    expect(store.landingPath(store.__readForTest())).toBe('/recently');
    store.setPref('landing', 'notes');
    expect(store.landingPath(store.__readForTest())).toBe('/notes');
    store.setPref('landing', 'overview');
    expect(store.landingPath(store.__readForTest())).toBe('/overview');
  });

  it('theme defaults to warm, persists, and rejects unknown values', async () => {
    const { store } = await fresh();
    expect(store.prefsOf(store.__readForTest()).theme).toBe('warm');
    store.setPref('theme', 'dark');
    expect(store.__readForTest().prefs.theme).toBe('dark');
    vi.resetModules();
    const reloaded = await import('./user');
    expect(reloaded.prefsOf(reloaded.__readForTest()).theme).toBe('dark');
    storage.set('thylas:user:v1', JSON.stringify({ version: 1, prefs: { theme: 'neon' } }));
    const bad = await fresh();
    expect(bad.store.prefsOf(bad.store.__readForTest()).theme).toBe('warm');
  });
});
