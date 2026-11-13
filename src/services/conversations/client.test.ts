import { describe, expect, it, vi } from 'vitest';
import { CONVERSATIONS_PATH, type ConversationDto } from '../../lib/conversations';
import { createConversationsClient } from './client';

const item: ConversationDto = {
  id: 'c-1',
  workspaceId: 'ws-1',
  title: 'First',
  createdAt: '2026-11-12T00:00:00.000Z',
  updatedAt: '2026-11-12T00:00:00.000Z',
  archivedAt: null,
};

function respond(body: unknown) {
  return vi.fn<typeof fetch>(async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function asFetcher(fn: ReturnType<typeof respond>): typeof fetch {
  return fn as unknown as typeof fetch;
}

describe('createConversationsClient', () => {
  it('lists with a URL-encoded workspace filter', async () => {
    const fetcher = respond({ ok: true, items: [item] });
    const client = createConversationsClient(asFetcher(fetcher));
    expect(await client.list('ws 1')).toEqual({ ok: true, items: [item] });
    expect(fetcher.mock.calls[0]?.[0]).toBe(`${CONVERSATIONS_PATH}?workspaceId=ws%201`);
  });

  it('lists without a filter when no workspace is given', async () => {
    const fetcher = respond({ ok: true, items: [] });
    await createConversationsClient(asFetcher(fetcher)).list();
    expect(fetcher.mock.calls[0]?.[0]).toBe(CONVERSATIONS_PATH);
  });

  it('posts the create body as JSON', async () => {
    const fetcher = respond({ ok: true, item });
    const body = { id: 'c-1', workspaceId: 'ws-1', title: 'First' };
    expect(await createConversationsClient(asFetcher(fetcher)).create(body)).toEqual({ ok: true, item });
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify(body));
  });

  it('uses the right method and an encoded id for get / patch / remove', async () => {
    const fetcher = respond({ ok: true, id: 'c 1' });
    const client = createConversationsClient(asFetcher(fetcher));
    await client.get('c 1');
    await client.patch('c 1', { title: 'Renamed' });
    await client.remove('c 1');
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      `${CONVERSATIONS_PATH}/c%201`,
      `${CONVERSATIONS_PATH}/c%201`,
      `${CONVERSATIONS_PATH}/c%201`,
    ]);
    expect(fetcher.mock.calls.map((call) => call[1]?.method)).toEqual([undefined, 'PATCH', 'DELETE']);
  });

  it('passes a typed server failure through unchanged', async () => {
    const err = { ok: false, kind: 'not_found', message: 'missing', retryable: false };
    const fetcher = respond(err);
    expect(await createConversationsClient(asFetcher(fetcher)).get('c-1')).toEqual(err);
  });

  it('turns a network failure into an upstream error', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error('offline');
    });
    const result = await createConversationsClient(fetcher).list();
    expect(result).toMatchObject({ ok: false, kind: 'upstream', retryable: true });
  });
});
