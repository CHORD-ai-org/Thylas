import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The connect store owns tombstones, custom registrations and a log. The cases
 * below are the ways that state can go wrong: a payload someone edited, a
 * double disconnect, a registration that survives its own reload.
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
    store: await import('./connect'),
    data: await import('../data/connect'),
  };
};

beforeEach(() => {
  storage.clear();
});

describe('disconnect', () => {
  it('removes a seed connection from every view and logs it once', async () => {
    const { store, data } = await fresh();
    store.disconnectIntegration('int-github');
    store.disconnectIntegration('int-github');
    expect(store.integrationsView().map((i) => i.id)).not.toContain('int-github');
    expect(store.integrationViewById('int-github')).toBeUndefined();
    expect(store.integrationsView()).toHaveLength(data.INTEGRATIONS.length - 1);
    const logs = store.connectLog().filter((d) => d.text.includes('Disconnected'));
    expect(logs).toHaveLength(1);
  });

  it('an unknown id is a no-op', async () => {
    const { store } = await fresh();
    store.disconnectIntegration('int-nope');
    expect(store.__readForTest()).toEqual({ removed: [], custom: [], log: [] });
  });

  it('a hand-edited tombstone list still yields the same views', async () => {
    storage.set('thylas:connect:v1', JSON.stringify({ version: 1, removed: ['int-slack', 42, null] }));
    const { store } = await fresh();
    expect(store.integrationsView().map((i) => i.id)).not.toContain('int-slack');
  });
});

describe('custom registrations', () => {
  it('registers with the kind and auth kept apart, newest first', async () => {
    const { store } = await fresh();
    store.registerCustom({
      label: 'Lab corpus API',
      kind: 'custom-api',
      endpoint: 'https://lab.internal/api',
      auth: 'api-key',
    });
    store.registerCustom({
      label: 'Field tools MCP',
      kind: 'mcp-server',
      endpoint: 'stdio://field-tools',
      auth: 'none',
    });
    const list = store.customIntegrations();
    expect(list).toHaveLength(2);
    expect(list[0]!.label).toBe('Field tools MCP');
    expect(list[0]!.kind).not.toBe(list[0]!.auth);
  });

  it('a payload someone edited loses the bad entries, not the list', async () => {
    storage.set(
      'thylas:connect:v1',
      JSON.stringify({
        version: 1,
        removed: [],
        custom: [
          { id: 'cx-a', label: 'Ok', kind: 'webhook', endpoint: 'https://x', auth: 'none', createdAt: 1 },
          { id: 'cx-b', label: 'Bad', kind: 'blockchain', endpoint: 'x', auth: 'none', createdAt: 2 },
        ],
      }),
    );
    const { store } = await fresh();
    expect(store.customIntegrations().map((c) => c.id)).toEqual(['cx-a']);
  });
});
