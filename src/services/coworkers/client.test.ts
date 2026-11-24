import { describe, expect, it } from 'vitest';
import { COWORKERS_PATH, type CoworkerBody, type CoworkerErr } from '../../lib/coworkers';
import { createCoworkersClient } from './client';

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

describe('coworkers client', () => {
  it('creates and reads typed bodies', async () => {
    const calls: Call[] = [];
    const client = createCoworkersClient(
      fetcherReturning(
        {
          ok: true,
          item: {
            id: 'cw-1',
            ownerId: 'u-1',
            name: 'Mira',
            description: '',
            status: 'active',
            responsibilities: { forWork: '', notFor: '', output: '' },
            memberships: [],
            pinnedArtifactIds: [],
            mindFramework: null,
            createdAt: 1763000000000,
            updatedAt: '2026-11-24T00:00:00.000Z',
            deletedAt: null,
          },
        },
        calls,
      ),
    );
    const body = await client.create({ name: 'Mira' });
    expect(body.ok).toBe(true);
    if (body.ok && 'item' in body) expect(body.item.name).toBe('Mira');
    expect(calls[0]?.init?.method).toBe('POST');
  });

  it('appends events through the events path', async () => {
    const calls: Call[] = [];
    const client = createCoworkersClient(fetcherReturning({ ok: true, item: {} }, calls));
    await client.createEvent('cw-1', { verb: 'created' });
    expect(calls[0]?.url).toBe(`${COWORKERS_PATH}/cw-1/events`);
    expect(calls[0]?.init?.method).toBe('POST');
    await client.listEvents('cw-1');
    expect(calls[1]?.url).toBe(`${COWORKERS_PATH}/cw-1/events`);
    expect(calls[1]?.init?.method).toBeUndefined();
  });

  it('surfaces typed failures and never throws', async () => {
    const client = createCoworkersClient((async () => {
      throw new Error('offline');
    }) as typeof fetch);
    const body = (await client.list()) as CoworkerErr;
    expect(body.ok).toBe(false);
    expect(body.kind).toBe('upstream');
    expect(body.retryable).toBe(true);
  });

  it('round-trips the result union without widening', async () => {
    const client = createCoworkersClient(
      fetcherReturning({ ok: false, kind: 'not_found', message: 'gone', retryable: false }, []),
    );
    const body = (await client.get('missing')) as CoworkerErr;
    expect(body.ok).toBe(false);
    expect(body.kind).toBe('not_found');
    const okBody = body as unknown as CoworkerBody;
    expect(okBody.item).toBeUndefined();
  });
});
