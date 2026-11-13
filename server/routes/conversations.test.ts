/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite';
import { createServer, type Server } from 'node:http';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CONVERSATIONS_PATH,
  type ConversationBody,
  type ConversationDeleteBody,
  type ConversationErr,
  type ConversationListBody,
} from '../../src/lib/conversations.ts';
import {
  SESSION_COOKIE,
  SESSION_PATH,
  type SessionErr,
} from '../../src/lib/session.ts';
import { readConfig } from '../config.ts';
import type { ConversationDatabase } from '../persistence/client.ts';
import { createApiRouter } from '../router.ts';
import { createSessionSource } from '../session/source.ts';
import { createConversationRouter } from './conversations.ts';

const MIGRATIONS = './server/persistence/migrations';
const DEV_COOKIE = `${SESSION_COOKIE}=dev:u-1:ws-1`;
const JSON_HEADERS = { 'content-type': 'application/json' };
const AUTH_HEADERS = { ...JSON_HEADERS, cookie: DEV_COOKIE };

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function portOf(server: Server): number {
  const address = server.address();
  return typeof address === 'object' && address ? address.port : 0;
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

let client: PGlite;
let server: Server;
let base: string;

beforeAll(async () => {
  client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS });
  const router = createConversationRouter(
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

describe('P1-4 conversations CRUD over real HTTP', () => {
  it('creates, lists, reads, patches and deletes a conversation', async () => {
    const created = await fetch(`${base}${CONVERSATIONS_PATH}`, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ id: 'c-1', workspaceId: 'ws-1', title: 'First' }),
    });
    expect(created.status).toBe(201);
    const createdBody = await json<ConversationBody>(created);
    expect(createdBody.item.title).toBe('First');
    expect(typeof createdBody.item.createdAt).toBe('string');

    const list = await fetch(`${base}${CONVERSATIONS_PATH}?workspaceId=ws-1`, {
      headers: { cookie: DEV_COOKIE },
    });
    expect((await json<ConversationListBody>(list)).items).toHaveLength(1);

    const read = await fetch(`${base}${CONVERSATIONS_PATH}/c-1`, {
      headers: { cookie: DEV_COOKIE },
    });
    expect((await json<ConversationBody>(read)).item.id).toBe('c-1');

    const patched = await fetch(`${base}${CONVERSATIONS_PATH}/c-1`, {
      method: 'PATCH',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ title: 'Renamed', archived: true }),
    });
    const patchedBody = await json<ConversationBody>(patched);
    expect(patchedBody.item.title).toBe('Renamed');
    expect(patchedBody.item.archivedAt).not.toBeNull();

    const removed = await fetch(`${base}${CONVERSATIONS_PATH}/c-1`, {
      method: 'DELETE',
      headers: { cookie: DEV_COOKIE },
    });
    expect((await json<ConversationDeleteBody>(removed)).id).toBe('c-1');

    const missing = await fetch(`${base}${CONVERSATIONS_PATH}/c-1`, {
      headers: { cookie: DEV_COOKIE },
    });
    expect(missing.status).toBe(404);
    expect((await json<ConversationErr>(missing)).kind).toBe('not_found');
  });

  it('returns kind / message / retryable for a bad body', async () => {
    const res = await fetch(`${base}${CONVERSATIONS_PATH}`, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: '{"id":""}',
    });
    expect(res.status).toBe(400);
    const err = await json<ConversationErr>(res);
    expect(err).toMatchObject({ ok: false, kind: 'contract', retryable: false });
    expect(typeof err.message).toBe('string');
  });
});

describe('P1-5 session and membership over real HTTP', () => {
  it('answers 401 without a session', async () => {
    const res = await fetch(`${base}${CONVERSATIONS_PATH}`);
    expect(res.status).toBe(401);
    const err = await json<SessionErr>(res);
    expect(err).toMatchObject({ ok: false, kind: 'unauthorized', retryable: false });
    expect(typeof err.message).toBe('string');
  });

  it('answers 403 for a workspace outside the memberships', async () => {
    const create = await fetch(`${base}${CONVERSATIONS_PATH}`, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ id: 'c-2', workspaceId: 'ws-2' }),
    });
    expect(create.status).toBe(403);
    expect((await json<SessionErr>(create)).kind).toBe('forbidden');

    const list = await fetch(`${base}${CONVERSATIONS_PATH}?workspaceId=ws-2`, {
      headers: { cookie: DEV_COOKIE },
    });
    expect(list.status).toBe(403);
    expect((await json<SessionErr>(list)).kind).toBe('forbidden');
  });

  it('answers 403 when another member reads a conversation outside their workspace', async () => {
    const created = await fetch(`${base}${CONVERSATIONS_PATH}`, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ id: 'c-3', workspaceId: 'ws-1' }),
    });
    expect(created.status).toBe(201);

    const other = await fetch(`${base}${CONVERSATIONS_PATH}/c-3`, {
      headers: { cookie: `${SESSION_COOKIE}=dev:u-2:ws-9` },
    });
    expect(other.status).toBe(403);
    expect((await json<SessionErr>(other)).kind).toBe('forbidden');
  });

  it('only lists conversations from the caller memberships', async () => {
    const list = await fetch(`${base}${CONVERSATIONS_PATH}`, {
      headers: { cookie: `${SESSION_COOKIE}=dev:u-2:ws-9` },
    });
    expect(list.status).toBe(200);
    expect((await json<ConversationListBody>(list)).items).toHaveLength(0);
  });
});

describe('API router with no DATABASE_URL', () => {
  it('checks the session before reporting a missing database, and still serves AI status', async () => {
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

      const anon = await fetch(`${url}${CONVERSATIONS_PATH}`);
      expect(anon.status).toBe(401);

      const signedIn = await fetch(`${url}${CONVERSATIONS_PATH}`, {
        headers: { cookie: DEV_COOKIE },
      });
      expect(signedIn.status).toBe(503);
      expect((await json<ConversationErr>(signedIn)).kind).toBe('not_configured');

      const sessionAnon = await fetch(`${url}${SESSION_PATH}`);
      expect(sessionAnon.status).toBe(401);

      const session = await fetch(`${url}${SESSION_PATH}`, {
        headers: { cookie: DEV_COOKIE },
      });
      expect(session.status).toBe(200);
      expect(await session.json()).toMatchObject({
        ok: true,
        user: { id: 'u-1', workspaceIds: ['ws-1'] },
      });

      const status = await fetch(`${url}/api/ai/status`);
      expect(status.status).toBe(200);
      expect(await status.json()).toMatchObject({ configured: false });
    } finally {
      await close(isolated);
    }
  });
});
