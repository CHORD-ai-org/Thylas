import { describe, expect, it } from 'vitest';
import { PROJECTS_PATH, type ProjectBody, type ProjectErr } from '../../lib/projects';
import { createProjectsClient } from './client';

type Call = { url: string; init?: RequestInit };

function fetcherReturning(body: unknown, calls: Call[]): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('projects client', () => {
  it('lists with an optional workspace filter and parses typed bodies', async () => {
    const calls: Call[] = [];
    const client = createProjectsClient(
      fetcherReturning(
        {
          ok: true,
          items: [
            {
              id: 'p-1',
              workspaceId: 'ws-1',
              name: 'Lemma',
              summary: '',
              state: 'active',
              createdAt: '2026-11-23T00:00:00.000Z',
              updatedAt: '2026-11-23T00:00:00.000Z',
            },
          ],
        },
        calls,
      ),
    );
    const body = await client.list('ws-1');
    expect(body.ok).toBe(true);
    if (body.ok && 'items' in body) expect(body.items[0]?.name).toBe('Lemma');
    expect(calls[0]?.url).toBe(`${PROJECTS_PATH}?workspaceId=ws-1`);
  });

  it('posts creates as JSON and patches connections through the check path', async () => {
    const calls: Call[] = [];
    const client = createProjectsClient(
      fetcherReturning(
        {
          ok: true,
          item: {
            id: 'p-1',
            workspaceId: 'ws-1',
            name: 'Lemma',
            summary: '',
            state: 'active',
            createdAt: '2026-11-23T00:00:00.000Z',
            updatedAt: '2026-11-23T00:00:00.000Z',
          },
        },
        calls,
      ),
    );
    await client.create({ workspaceId: 'ws-1', name: 'Lemma' });
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ workspaceId: 'ws-1', name: 'Lemma' }));

    await client.checkConnection('p-1', 'c-1');
    expect(calls[1]?.url).toBe(`${PROJECTS_PATH}/p-1/connections/c-1/check`);
    expect(calls[1]?.init?.method).toBe('POST');
  });

  it('surfaces typed failures instead of throwing', async () => {
    const calls: Call[] = [];
    const client = createProjectsClient(
      fetcherReturning(
        { ok: false, kind: 'not_found', message: 'gone', retryable: false },
        calls,
      ),
    );
    const body = (await client.get('missing')) as ProjectErr;
    expect(body.ok).toBe(false);
    expect(body.kind).toBe('not_found');
  });

  it('turns a network failure into a retryable upstream error', async () => {
    const client = createProjectsClient((async () => {
      throw new Error('offline');
    }) as typeof fetch);
    const body = (await client.list()) as ProjectErr;
    expect(body.ok).toBe(false);
    expect(body.kind).toBe('upstream');
    expect(body.retryable).toBe(true);
  });

  it('round-trips the result union without widening', async () => {
    const client = createProjectsClient(
      fetcherReturning(
        {
          ok: true,
          item: {
            id: 'p-1',
            workspaceId: 'ws-1',
            name: 'Lemma',
            summary: '',
            state: 'active',
            createdAt: '2026-11-23T00:00:00.000Z',
            updatedAt: '2026-11-23T00:00:00.000Z',
          },
        },
        [],
      ),
    );
    const body = await client.patch('p-1', { state: 'archived' });
    const ok = body as ProjectBody;
    expect(ok.item.state).toBe('active');
  });
});
