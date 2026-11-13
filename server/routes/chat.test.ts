/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite';
import { createServer, type Server } from 'node:http';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHAT_STATE_PATH, type ChatErr, type ChatStateDto } from '../../src/lib/chat.ts';
import { SESSION_COOKIE, type SessionErr } from '../../src/lib/session.ts';
import { readConfig } from '../config.ts';
import type { ConversationDatabase } from '../persistence/client.ts';
import { createApiRouter } from '../router.ts';
import { createSessionSource } from '../session/source.ts';
import { createChatRouter } from './chat.ts';

const MIGRATIONS = './server/persistence/migrations';
const DEV_COOKIE = `${SESSION_COOKIE}=dev:u-1:ws-1`;
const OTHER_COOKIE = `${SESSION_COOKIE}=dev:u-2:ws-9`;

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
async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

const conversation = {
  id: 'c-1',
  title: 'First',
  createdAt: 1_700_000_000_000,
  messages: [
    {
      id: 'm-1',
      role: 'user',
      at: 1_700_000_000_001,
      blocks: [
        { kind: 'text', text: 'hello' },
        { kind: 'evidence', name: 'report.pdf', sourceType: 'file' },
      ],
    },
    {
      id: 'm-2',
      role: 'assistant',
      at: 1_700_000_000_002,
      blocks: [{ kind: 'text', text: 'hi' }, { kind: 'status', label: 'Done', state: 'done' }],
      meta: { model: 'deepseek-chat', ms: 12 },
    },
  ],
  context: [{ id: 's-1', kind: 'file', name: 'report.pdf' }],
};

let client: PGlite;
let server: Server;
let base: string;

beforeAll(async () => {
  client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS });
  const router = createChatRouter(
    db as unknown as ConversationDatabase,
    createSessionSource(readConfig({})),
  );
  server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    router(req, res, path);
  });
  await listen(server);
  base = `http://127.0.0.1:${portOf(server)}`;
}, 60_000);

afterAll(async () => {
  await close(server);
  await client.close();
});

function put(body: unknown, cookie = DEV_COOKIE): Promise<Response> {
  return fetch(`${base}${CHAT_STATE_PATH}`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('P1-7 chat state over real HTTP', () => {
  it('starts empty', async () => {
    const res = await fetch(`${base}${CHAT_STATE_PATH}`, { headers: { cookie: DEV_COOKIE } });
    expect(res.status).toBe(200);
    const state = await json<ChatStateDto>(res);
    expect(state.version).toBe(0);
    expect(state.conversations).toHaveLength(0);
  });

  it('PUTs a full envelope and GETs the same blocks, context and meta back', async () => {
    const saved = await put({ expectedVersion: 0, conversations: [conversation] });
    expect(saved.status).toBe(200);
    expect(await json<{ ok: true; version: number }>(saved)).toEqual({ ok: true, version: 1 });

    const res = await fetch(`${base}${CHAT_STATE_PATH}`, { headers: { cookie: DEV_COOKIE } });
    const state = await json<ChatStateDto>(res);
    expect(state.version).toBe(1);
    expect(state.conversations).toEqual([conversation]);
  });

  it('rejects a stale version with 409', async () => {
    const res = await put({ expectedVersion: 0, conversations: [conversation] });
    expect(res.status).toBe(409);
    expect((await json<ChatErr>(res)).kind).toBe('conflict');
  });

  it('rejects a malformed envelope with 400', async () => {
    const res = await put({ expectedVersion: 1, conversations: [{ id: 'bad' }] });
    expect(res.status).toBe(400);
    expect((await json<ChatErr>(res)).kind).toBe('contract');
  });

  it('answers 401 without a session', async () => {
    const res = await fetch(`${base}${CHAT_STATE_PATH}`);
    expect(res.status).toBe(401);
    expect((await json<SessionErr>(res)).kind).toBe('unauthorized');
  });

  it('isolates state by workspace membership', async () => {
    const res = await fetch(`${base}${CHAT_STATE_PATH}`, { headers: { cookie: OTHER_COOKIE } });
    const state = await json<ChatStateDto>(res);
    expect(state.conversations).toHaveLength(0);
  });
});

describe('API router without DATABASE_URL', () => {
  it('answers 401 first, then 503 not_configured', async () => {
    const router = createApiRouter(readConfig({}));
    const isolated = createServer((req, res) =>
      router(req, res, () => {
        res.statusCode = 404;
        res.end();
      }),
    );
    await listen(isolated);
    try {
      const url = `http://127.0.0.1:${portOf(isolated)}`;
      expect((await fetch(`${url}${CHAT_STATE_PATH}`)).status).toBe(401);
      const signedIn = await fetch(`${url}${CHAT_STATE_PATH}`, { headers: { cookie: DEV_COOKIE } });
      expect(signedIn.status).toBe(503);
      expect((await json<ChatErr>(signedIn)).kind).toBe('not_configured');
    } finally {
      await close(isolated);
    }
  });
});
