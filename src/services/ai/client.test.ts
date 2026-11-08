import { afterEach, describe, expect, it, vi } from 'vitest';
import { ask, probe } from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ask', () => {
  it('posts the prompt to the endpoint and returns an answer', async () => {
    const fetchMock = vi.fn(async () =>
      json(200, { ok: true, text: 'a line', model: 'deepseek-chat', ms: 812 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await ask('What is a boundary?');

    expect(result).toEqual({ ok: true, answer: { text: 'a line', model: 'deepseek-chat', ms: 812 } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ prompt: 'What is a boundary?' });
  });

  it('refuses an oversized question without a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await ask('x'.repeat(8001));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('contract');
      expect(result.error.message).toContain('8000');
    }
  });

  it('reports an unreachable endpoint as network, not as a crash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('failed to fetch'))));

    const result = await ask('hi');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('network');
      expect(result.error.retryable).toBe(true);
    }
  });

  it('treats a 200 that is not JSON as a contract failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>ok</html>', { status: 200 })));

    const result = await ask('hi');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('contract');
  });

  it('treats an untyped error status as upstream', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })));

    const result = await ask('hi');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('upstream');
      expect(result.error.retryable).toBe(true);
    }
  });
});

describe('probe', () => {
  it('reads the configuration state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { configured: true, model: 'deepseek-chat' })));

    expect(await probe()).toEqual({ configured: true, model: 'deepseek-chat' });
  });

  it('returns null for a body that is not a status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { ok: true })));

    expect(await probe()).toBeNull();
  });

  it('returns null when the endpoint refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));

    expect(await probe()).toBeNull();
  });

  /* `null` means "cannot tell", and the caller keeps the control enabled: a
     button that can never be pressed for an invisible reason is worse than a
     request that fails with a message. */
  it('returns null rather than throwing when nothing is listening', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('failed to fetch'))));

    expect(await probe()).toBeNull();
  });
});
