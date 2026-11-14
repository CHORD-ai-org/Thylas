/// <reference types="node" />
/**
 * A1 acceptance over real HTTP (D-059): 401 for an anonymous caller, a name
 * that survives a second request, per-user isolation, and honest 400s.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../../src/lib/session.ts';
import { USER_PATH, type UserResultBody } from '../../src/lib/user.ts';
import { readConfig } from '../config.ts';
import { createSessionSource } from '../session/source.ts';
import { createUserStore } from '../user/store.ts';
import { createUserRouter } from './user.ts';

const DEV_COOKIE = `${SESSION_COOKIE}=dev:u-1:ws-1`;
const OTHER_COOKIE = `${SESSION_COOKIE}=dev:u-2:ws-1`;

let dir: string;
let server: Server;
let base: string;

function listen(httpServer: Server): Promise<void> {
  return new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
}
function close(httpServer: Server): Promise<void> {
  return new Promise((resolve) => httpServer.close(() => resolve()));
}
function portOf(httpServer: Server): number {
  const address = httpServer.address();
  return typeof address === 'object' && address ? address.port : 0;
}

function patch(body: unknown, cookie = DEV_COOKIE): Promise<Response> {
  return fetch(`${base}${USER_PATH}`, {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function get(cookie = DEV_COOKIE): Promise<Response> {
  return fetch(`${base}${USER_PATH}`, { headers: { cookie } });
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'thylas-user-'));
  const router = createUserRouter({
    store: createUserStore(dir),
    sessionSource: createSessionSource(readConfig({})),
  });
  server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    router(req, res, path);
  });
  await listen(server);
  base = `http://127.0.0.1:${portOf(server)}`;
});

afterAll(async () => {
  await close(server);
  await rm(dir, { recursive: true, force: true });
});

describe('A1 user API over real HTTP', () => {
  it('refuses an anonymous request', async () => {
    const res = await fetch(`${base}${USER_PATH}`);
    expect(res.status).toBe(401);
    expect((await res.json()) as UserResultBody).toMatchObject({
      ok: false,
      kind: 'unauthorized',
      retryable: false,
    });
  });

  it('starts with no override', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, user: { displayName: null } });
  });

  it('writes a name and reads it back on a later request', async () => {
    const written = await patch({ displayName: '  C. Zhao  ' });
    expect(written.status).toBe(200);
    expect(await written.json()).toEqual({ ok: true, user: { displayName: 'C. Zhao' } });
    const later = await get();
    expect(await later.json()).toEqual({ ok: true, user: { displayName: 'C. Zhao' } });
  });

  it('keeps users apart: another id cannot see or overwrite this name', async () => {
    const other = await get(OTHER_COOKIE);
    expect(await other.json()).toEqual({ ok: true, user: { displayName: null } });
    await patch({ displayName: 'Other' }, OTHER_COOKIE);
    expect(await (await get()).json()).toEqual({ ok: true, user: { displayName: 'C. Zhao' } });
  });

  it('clears the override with null or a blank string', async () => {
    const cleared = await patch({ displayName: null });
    expect(await cleared.json()).toEqual({ ok: true, user: { displayName: null } });
    await patch({ displayName: 'Again' });
    const blank = await patch({ displayName: '   ' });
    expect(await blank.json()).toEqual({ ok: true, user: { displayName: null } });
  });

  it('rejects a malformed or overlong body with 400 contract', async () => {
    for (const body of [{ displayName: 7 }, { userId: 'u-2' }, { displayName: 'x'.repeat(41) }]) {
      const res = await patch(body);
      expect(res.status).toBe(400);
      expect((await res.json()) as UserResultBody).toMatchObject({ ok: false, kind: 'contract' });
    }
  });

  it('rejects a non-JSON body', async () => {
    const res = await fetch(`${base}${USER_PATH}`, {
      method: 'PATCH',
      headers: { cookie: DEV_COOKIE, 'content-type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('answers an unsupported method with 404', async () => {
    const res = await fetch(`${base}${USER_PATH}`, { method: 'DELETE', headers: { cookie: DEV_COOKIE } });
    expect(res.status).toBe(404);
  });
});
