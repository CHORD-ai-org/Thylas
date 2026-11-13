/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FILES_PATH,
  FILE_HEADERS,
  type FileBody,
  type FileErr,
  type FileListBody,
} from '../../src/lib/files.ts';
import { SESSION_COOKIE, type SessionErr } from '../../src/lib/session.ts';
import { readConfig } from '../config.ts';
import type { ConversationDatabase } from '../persistence/client.ts';
import { createApiRouter } from '../router.ts';
import { createSessionSource } from '../session/source.ts';
import { createLocalStorage } from '../storage/local.ts';
import { createFilesRouter } from './files.ts';

const MIGRATIONS = './server/persistence/migrations';
const DEV_COOKIE = `${SESSION_COOKIE}=dev:u-1:ws-1`;

let dir: string;
let client: PGlite;
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

function uploadHeaders(name = 'report.txt', workspaceId = 'ws-1'): Record<string, string> {
  return {
    cookie: DEV_COOKIE,
    [FILE_HEADERS.name]: encodeURIComponent(name),
    [FILE_HEADERS.kind]: 'txt',
    [FILE_HEADERS.workspaceId]: workspaceId,
  };
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'thylas-files-'));
  client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS });
  const router = createFilesRouter(
    db as unknown as ConversationDatabase,
    createLocalStorage(readConfig({ STORAGE_DIR: dir })),
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
  await rm(dir, { recursive: true, force: true });
});

describe('P1-6 files API over real HTTP', () => {
  let fileId = '';

  it('uploads bytes, then lists and reads back the same bytes', async () => {
    const uploaded = await fetch(`${base}${FILES_PATH}`, {
      method: 'POST',
      headers: uploadHeaders('报告.txt'),
      body: 'hello world',
    });
    expect(uploaded.status).toBe(201);
    const created = await json<FileBody>(uploaded);
    expect(created.item.name).toBe('报告.txt');
    expect(created.item.sizeBytes).toBe(11);
    fileId = created.item.id;

    const list = await fetch(`${base}${FILES_PATH}`, { headers: { cookie: DEV_COOKIE } });
    expect((await json<FileListBody>(list)).items).toHaveLength(1);

    const one = await fetch(`${base}${FILES_PATH}/${fileId}`, {
      headers: { cookie: DEV_COOKIE },
    });
    expect((await json<FileBody>(one)).item.id).toBe(fileId);

    const content = await fetch(`${base}${FILES_PATH}/${fileId}/content`, {
      headers: { cookie: DEV_COOKIE },
    });
    expect(content.status).toBe(200);
    expect(await content.text()).toBe('hello world');
    expect(content.headers.get('content-disposition')).toContain('filename*=');
  });

  it('soft-deletes and no longer lists the file', async () => {
    const removed = await fetch(`${base}${FILES_PATH}/${fileId}`, {
      method: 'DELETE',
      headers: { cookie: DEV_COOKIE },
    });
    expect(removed.status).toBe(200);

    const list = await fetch(`${base}${FILES_PATH}`, { headers: { cookie: DEV_COOKIE } });
    expect((await json<FileListBody>(list)).items).toHaveLength(0);

    const one = await fetch(`${base}${FILES_PATH}/${fileId}`, {
      headers: { cookie: DEV_COOKIE },
    });
    expect(one.status).toBe(404);
    expect((await json<FileErr>(one)).kind).toBe('not_found');
  });

  it('answers 401 without a session', async () => {
    const res = await fetch(`${base}${FILES_PATH}`);
    expect(res.status).toBe(401);
    expect((await json<SessionErr>(res)).kind).toBe('unauthorized');
  });

  it('answers 403 for a workspace outside the memberships', async () => {
    const res = await fetch(`${base}${FILES_PATH}`, {
      method: 'POST',
      headers: uploadHeaders('x.txt', 'ws-2'),
      body: 'x',
    });
    expect(res.status).toBe(403);
    expect((await json<SessionErr>(res)).kind).toBe('forbidden');
  });

  it('answers 400 for missing or invalid metadata headers', async () => {
    const res = await fetch(`${base}${FILES_PATH}`, {
      method: 'POST',
      headers: { cookie: DEV_COOKIE, [FILE_HEADERS.kind]: 'txt', [FILE_HEADERS.workspaceId]: 'ws-1' },
      body: 'x',
    });
    expect(res.status).toBe(400);
    expect((await json<FileErr>(res)).kind).toBe('contract');
  });
});

describe('API router without STORAGE_DIR', () => {
  it('checks the session before reporting a missing store', async () => {
    const router = createApiRouter(readConfig({}));
    const isolated = createServer((req, res) => router(req, res, () => {
      res.statusCode = 404;
      res.end();
    }));
    await listen(isolated);
    try {
      const url = `http://127.0.0.1:${portOf(isolated)}`;
      expect((await fetch(`${url}${FILES_PATH}`)).status).toBe(401);
      const signedIn = await fetch(`${url}${FILES_PATH}`, { headers: { cookie: DEV_COOKIE } });
      expect(signedIn.status).toBe(503);
      expect((await json<FileErr>(signedIn)).kind).toBe('not_configured');
    } finally {
      await close(isolated);
    }
  });
});
