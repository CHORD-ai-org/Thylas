import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * P1-7 acceptance: `local` is unchanged, `api` imports an existing envelope
 * once without losing it, and a finished turn is flushed to the server.
 * The store reads its mode at module load, so every case re-imports it.
 */
const storage = new Map<string, string>();

const envelope = {
  id: 'c-1',
  title: 'Saved locally',
  createdAt: 1_700_000_000_000,
  messages: [
    {
      id: 'm-1',
      role: 'user',
      at: 1_700_000_000_001,
      blocks: [{ kind: 'text', text: 'hello' }],
    },
  ],
  context: [{ id: 's-1', kind: 'file', name: 'report.pdf' }],
};

function localState() {
  return {
    version: 1,
    conversations: [envelope],
    activeId: envelope.id,
    dock: { open: true, width: 400 },
  };
}

function remoteFetch(initial: unknown[] = []) {
  const state = { version: 0, conversations: [...initial] as unknown[] };
  return vi.fn<typeof fetch>(async (_url, init) => {
    const method = init?.method ?? 'GET';
    if (method === 'PUT') {
      const body = JSON.parse(String(init?.body)) as { conversations: unknown[] };
      state.conversations = body.conversations;
      state.version += 1;
      return new Response(JSON.stringify({ ok: true, version: state.version }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        ok: true,
        workspaceId: 'ws-1',
        version: state.version,
        conversations: state.conversations,
      }),
      { status: 200 },
    );
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

describe('chat store dual mode', () => {
  it('local mode never touches the network and keeps the original behaviour', async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('VITE_CHAT_SOURCE', 'local');
    const store = await import('./chat');
    const created = store.newConversation();
    store.addUserMessage(created.id, 'hello');
    expect(store.__readForTest().conversations[0]?.messages).toHaveLength(1);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('api mode imports the old envelope once and keeps the local copy', async () => {
    storage.set('thylas:chat:v1', JSON.stringify(localState()));
    const fetcher = remoteFetch();
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('VITE_CHAT_SOURCE', 'api');
    const store = await import('./chat');

    await vi.waitFor(() => {
      expect(fetcher.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(true);
    });
    const put = fetcher.mock.calls.find((call) => call[1]?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body)).conversations).toEqual([envelope]);
    expect(storage.get('thylas:chat:migrated:v1')).toBe('1');
    expect(JSON.parse(storage.get('thylas:chat:v1') ?? '{}').conversations).toEqual([envelope]);
    expect(store.__readForTest().conversations).toEqual([envelope]);
  });

  it('api mode hydrates from the server when it already has conversations', async () => {
    const serverConversation = { ...envelope, title: 'From server' };
    const fetcher = remoteFetch([serverConversation]);
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('VITE_CHAT_SOURCE', 'api');
    const store = await import('./chat');

    await vi.waitFor(() => {
      expect(store.__readForTest().conversations[0]?.title).toBe('From server');
    });
    expect(fetcher.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(false);
  });

  it('api mode flushes a finished turn to the server', async () => {
    const fetcher = remoteFetch();
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('VITE_CHAT_SOURCE', 'api');
    const store = await import('./chat');
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());

    const created = store.newConversation();
    store.addUserMessage(created.id, 'question');
    const assistant = store.beginAssistantMessage(created.id);
    store.appendDelta(created.id, assistant.id, 'hi');
    store.finishAssistantMessage(created.id, assistant.id, { model: 'deepseek-chat', ms: 5 });

    await vi.waitFor(() => {
      const puts = fetcher.mock.calls.filter((call) => call[1]?.method === 'PUT');
      const last = puts[puts.length - 1];
      const saved = last
        ? (JSON.parse(String(last[1]?.body)).conversations as { messages: unknown[] }[])
        : [];
      expect(saved[0]?.messages).toHaveLength(2);
    });
  });
});
