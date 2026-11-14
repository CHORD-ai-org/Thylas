import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A1 acceptance (D-059): `local` never touches the network and keeps the
 * original behaviour; `api` hydrates once, imports a local name without
 * deleting it, and syncs later changes in the background.
 * The store reads its mode at module load, so every case re-imports it.
 */
const storage = new Map<string, string>();
const KEY = 'thylas:user:v1';

function localEnvelope(name: string) {
  return { version: 1, displayName: name, prefs: { landing: 'notes' } };
}

function remoteFetch(initial: string | null = null) {
  let name = initial;
  return vi.fn<typeof fetch>(async (_url, init) => {
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body)) as { displayName: string | null };
      name = body.displayName;
    }
    return new Response(JSON.stringify({ ok: true, user: { displayName: name } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('user store dual mode', () => {
  it('local mode never touches the network', async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('VITE_USER_SOURCE', 'local');
    const store = await import('./user');
    store.setDisplayName('C. Zhao');
    expect(store.__readForTest().displayName).toBe('C. Zhao');
    expect(JSON.parse(storage.get(KEY) ?? '{}').displayName).toBe('C. Zhao');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('api mode imports a local name once and keeps the local copy', async () => {
    storage.set(KEY, JSON.stringify(localEnvelope('Local name')));
    const fetcher = remoteFetch();
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('VITE_USER_SOURCE', 'api');
    const store = await import('./user');

    await vi.waitFor(() => {
      expect(fetcher.mock.calls.some((call) => call[1]?.method === 'PATCH')).toBe(true);
    });
    const put = fetcher.mock.calls.find((call) => call[1]?.method === 'PATCH');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ displayName: 'Local name' });
    expect(JSON.parse(storage.get(KEY) ?? '{}').displayName).toBe('Local name');
    expect(store.__readForTest().displayName).toBe('Local name');
  });

  it('api mode lets a remote name win over a stale local one', async () => {
    storage.set(KEY, JSON.stringify(localEnvelope('Stale')));
    const fetcher = remoteFetch('From server');
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('VITE_USER_SOURCE', 'api');
    const store = await import('./user');

    await vi.waitFor(() => {
      expect(store.__readForTest().displayName).toBe('From server');
    });
    expect(fetcher.mock.calls.some((call) => call[1]?.method === 'PATCH')).toBe(false);
  });

  it('api mode pushes a later name change in the background', async () => {
    const fetcher = remoteFetch();
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('VITE_USER_SOURCE', 'api');
    const store = await import('./user');
    await vi.waitFor(() => {
      expect(fetcher.mock.calls.length).toBeGreaterThan(0);
    });
    store.setDisplayName('New name');

    await vi.waitFor(() => {
      expect(
        fetcher.mock.calls.some(
          (call) =>
            call[1]?.method === 'PATCH' &&
            JSON.parse(String(call[1]?.body)).displayName === 'New name',
        ),
      ).toBe(true);
    });
    expect(store.__readForTest().displayName).toBe('New name');
  });

  it('api mode keeps the local envelope when the server fails', async () => {
    storage.set(KEY, JSON.stringify(localEnvelope('Kept')));
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error('offline');
    });
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('VITE_USER_SOURCE', 'api');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = await import('./user');

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalled();
    });
    expect(store.__readForTest().displayName).toBe('Kept');
    expect(JSON.parse(storage.get(KEY) ?? '{}').displayName).toBe('Kept');
    warn.mockRestore();
  });
});
