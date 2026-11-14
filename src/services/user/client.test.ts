import { describe, expect, it, vi } from 'vitest';
import { USER_PATH } from '../../lib/user';
import { createUserClient } from './client';

function reply(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
}

describe('user client', () => {
  it('reads the server name', async () => {
    const fetcher = reply({ ok: true, user: { displayName: 'C. Zhao' } });
    const result = await createUserClient(fetcher).get();
    expect(result).toEqual({ ok: true, user: { displayName: 'C. Zhao' } });
    expect(fetcher.mock.calls[0]?.[0]).toBe(USER_PATH);
    expect(fetcher.mock.calls[0]?.[1]?.credentials).toBe('include');
  });

  it('sends a bounded PATCH with the patch body', async () => {
    const fetcher = reply({ ok: true, user: { displayName: 'New' } });
    const result = await createUserClient(fetcher).patch({ displayName: 'New' });
    expect(result.ok).toBe(true);
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ displayName: 'New' });
  });

  it('returns a typed 401 instead of throwing', async () => {
    const fetcher = reply({ ok: false, kind: 'unauthorized', message: 'Sign in', retryable: false }, 401);
    const result = await createUserClient(fetcher).get();
    expect(result).toMatchObject({ ok: false, kind: 'unauthorized' });
  });

  it('returns an upstream failure when the network throws', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error('offline');
    });
    const result = await createUserClient(fetcher).patch({ displayName: null });
    expect(result).toMatchObject({ ok: false, kind: 'upstream', retryable: true });
  });
});
