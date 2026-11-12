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
import { readConfig } from '../config.ts';
import type { ConversationDatabase } from '../persistence/client.ts';
import { createApiRouter } from '../router.ts';
import { createConversationRouter } from './conversations.ts';

const MIGRATIONS = './server/persistence/migrations';
const JSON_HEADERS = { 'content-type': 'application/json' };

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
  const router = createConversationRouter(db as unknown as ConversationDatabase);
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
      headers: JSON_HEADERS,
      body: JSON.stringify({ id: 'c-1', workspaceId: 'ws-1', title: 'First' }),
    });
    expect(created.status).toBe(201);
    const createdBody = await json<ConversationBody>(created);
    expect(createdBody.item.title).toBe('First');
    expect(typeof createdBody.item.createdAt).toBe('string');

    const list = await fetch(`${base}${CONVERSATIONS_PATH}?workspaceId=ws-1`);
    expect((await json<ConversationListBody>(list)).items).toHaveLength(1);

    const read = await fetch(`${base}${CONVERSATIONS_PATH}/c-1`);
    expect((await json<ConversationBody>(read)).item.id).toBe('c-1');

    const patched = await fetch(`${base}${CONVERSATIONS_PATH}/c-1`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ title: 'Renamed', archived: true }),
    });
    const patchedBody = await json<ConversationBody>(patched);
    expect(patchedBody.item.title).toBe('Renamed');
    expect(patchedBody.item.archivedAt).not.toBeNull();

    const removed = await fetch(`${base}${CONVERSATIONS_PATH}/c-1`, { method: 'DELETE' });
    expect((await json<ConversationDeleteBody>(removed)).id).toBe('c-1');

    const missing = await fetch(`${base}${CONVERSATIONS_PATH}/c-1`);
    expect(missing.status).toBe(404);
    expect((await json<ConversationErr>(missing)).kind).toBe('not_found');
  });

  it('returns kind / message / retryable for a bad body', async () => {
    const res = await fetch(`${base}${CONVERSATIONS_PATH}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: '{"id":""}',
    });
    expect(res.status).toBe(400);
    const err = await json<ConversationErr>(res);
    expect(err).toMatchObject({ ok: false, kind: 'contract', retryable: false });
    expect(typeof err.message).toBe('string');
  });
});

describe('API router with no DATABASE_URL', () => {
  it('answers 503 not_configured for conversations and still serves AI status', async () => {
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
      const conversations = await fetch(`${url}${CONVERSATIONS_PATH}`);
      expect(conversations.status).toBe(503);
      expect((await json<ConversationErr>(conversations)).kind).toBe('not_configured');

      const status = await fetch(`${url}/api/ai/status`);
      expect(status.status).toBe(200);
      expect(await status.json()).toMatchObject({ configured: false });
    } finally {
      await close(isolated);
    }
  });
});
