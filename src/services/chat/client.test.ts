import { describe, expect, it, vi } from 'vitest';
import { CHAT_STATE_PATH } from '../../lib/chat';
import { createChatClient } from './client';

function respond(body: unknown) {
  return vi.fn<typeof fetch>(async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const state = {
  ok: true,
  workspaceId: 'ws-1',
  version: 3,
  conversations: [],
};

describe('createChatClient', () => {
  it('GETs the state with credentials so the session cookie is sent', async () => {
    const fetcher = respond(state);
    expect(await createChatClient(fetcher).getState()).toEqual(state);
    expect(fetcher.mock.calls[0]?.[0]).toBe(CHAT_STATE_PATH);
    expect(fetcher.mock.calls[0]?.[1]?.credentials).toBe('include');
  });

  it('PUTs the envelope with a version and JSON body', async () => {
    const fetcher = respond({ ok: true, version: 4 });
    const result = await createChatClient(fetcher).putState({
      expectedVersion: 3,
      conversations: [],
    });
    expect(result).toEqual({ ok: true, version: 4 });
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.method).toBe('PUT');
    expect(init?.credentials).toBe('include');
    expect(init?.body).toBe(JSON.stringify({ expectedVersion: 3, conversations: [] }));
  });

  it('passes a typed server failure through unchanged', async () => {
    const err = { ok: false, kind: 'conflict', message: 'stale', retryable: false };
    expect(await createChatClient(respond(err)).getState()).toEqual(err);
  });

  it('turns a network failure into an upstream error', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error('offline');
    });
    expect(await createChatClient(fetcher).getState()).toMatchObject({
      ok: false,
      kind: 'upstream',
      retryable: true,
    });
  });
});
