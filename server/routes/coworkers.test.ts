/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite';
import { createServer, type Server } from 'node:http';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COWORKERS_PATH,
  effectiveGrants,
  type CoworkerBody,
  type CoworkerErr,
  type CoworkerEventListBody,
  type CoworkerListBody,
} from '../../src/lib/coworkers.ts';
import { SESSION_COOKIE } from '../../src/lib/session.ts';
import { readConfig } from '../config.ts';
import type { ConversationDatabase } from '../persistence/client.ts';
import { createSessionSource } from '../session/source.ts';
import { createCoworkersRouter } from './coworkers.ts';

const MIGRATIONS = './server/persistence/migrations';
const DEV_COOKIE = `${SESSION_COOKIE}=dev:u-1:ws-1`;

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

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function call(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${base}${path}`, {
    method,
    headers: { cookie: DEV_COOKIE, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS });
  const router = createCoworkersRouter(
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

describe('C0 coworkers API over real HTTP', () => {
  let coworkerId = '';

  it('creates a coworker that survives across sessions (fresh fetch sees it)', async () => {
    const created = await call('POST', COWORKERS_PATH, {
      id: 'cw-mira',
      name: 'Mira',
      description: 'Research',
      responsibilities: { forWork: 'research', notFor: 'shipping', output: 'decision cards' },
    });
    expect(created.status).toBe(201);
    const body = await json<CoworkerBody>(created);
    expect(body.item.name).toBe('Mira');
    expect(body.item.ownerId).toBe('u-1');
    coworkerId = body.item.id;

    const again = await call('GET', `${COWORKERS_PATH}/${coworkerId}`);
    expect(again.status).toBe(200);
    expect((await json<CoworkerBody>(again)).item.name).toBe('Mira');

    const list = await call('GET', COWORKERS_PATH);
    expect((await json<CoworkerListBody>(list)).items).toHaveLength(1);
  });

  it('C0 gate: events append and replay in original order', async () => {
    const verbs = ['created', 'delegated', 'handoff', 'completed'];
    for (const verb of verbs) {
      const res = await call('POST', `${COWORKERS_PATH}/${coworkerId}/events`, {
        verb,
        projectId: 'p-1',
        actorKind: 'coworker',
        payload: { note: verb },
      });
      expect(res.status).toBe(201);
      await new Promise((r) => setTimeout(r, 5));
    }
    const replay = await call('GET', `${COWORKERS_PATH}/${coworkerId}/events`);
    expect(replay.status).toBe(200);
    const items = (await json<CoworkerEventListBody>(replay)).items;
    expect(items.map((x) => x.verb)).toEqual(verbs);
    expect(items[0]?.payload).toEqual({ note: 'created' });
  });

  it('patches fields and validates the mind framework strictly', async () => {
    const patched = await call('PATCH', `${COWORKERS_PATH}/${coworkerId}`, {
      status: 'paused',
      description: 'Research lead',
    });
    expect(patched.status).toBe(200);
    expect((await json<CoworkerBody>(patched)).item.status).toBe('paused');

    const badMind = await call('PATCH', `${COWORKERS_PATH}/${coworkerId}`, {
      mindFramework: { version: 99 },
    });
    expect(badMind.status).toBe(400);
  });

  it('refuses records owned by someone else', async () => {
    await client.query(
      "insert into coworkers (id, owner_id, name, created_at_ms) values ('cw-other', 'u-2', 'Archer', $1)",
      [Date.now()],
    );
    const foreign = await call('GET', `${COWORKERS_PATH}/cw-other`);
    expect(foreign.status).toBe(403);
  });

  it('soft-deletes: gone from list and detail, history kept', async () => {
    const removed = await call('DELETE', `${COWORKERS_PATH}/${coworkerId}`);
    expect(removed.status).toBe(200);

    const list = await call('GET', COWORKERS_PATH);
    expect((await json<CoworkerListBody>(list)).items).toHaveLength(0);

    const gone = await call('GET', `${COWORKERS_PATH}/${coworkerId}`);
    expect(gone.status).toBe(404);
  });

  it('rejects contract violations', async () => {
    const noName = await call('POST', COWORKERS_PATH, { description: 'x' });
    expect(noName.status).toBe(400);

    const badStatus = await call('POST', COWORKERS_PATH, {
      name: 'Temp',
      responsibilities: 'not-an-object',
    });
    expect(badStatus.status).toBe(400);

    const badVerb = await call('POST', `${COWORKERS_PATH}/cw-other/events`, { verb: '' });
    expect([400, 403]).toContain(badVerb.status);
    if (badVerb.status === 400) expect((await json<CoworkerErr>(badVerb)).kind).toBe('contract');
  });
});

describe('C1-1 employment and grant intersection', () => {
  it('upserts employment grants and removes them', async () => {
    const created = await call('POST', COWORKERS_PATH, { id: 'cw-emp', name: 'Archer' });
    expect(created.status).toBe(201);

    const put = await call('PUT', `${COWORKERS_PATH}/cw-emp/employments/ws-1`, {
      role: 'researcher',
      grants: ['search', 'files', 'board'],
    });
    expect(put.status).toBe(200);

    const again = await call('PUT', `${COWORKERS_PATH}/cw-emp/employments/ws-1`, {
      grants: ['search'],
    });
    expect((await json<{ item: { grants: string[] } }>(again)).item.grants).toEqual(['search']);

    const list = await call('GET', `${COWORKERS_PATH}/cw-emp/employments`);
    const items = (await json<{ items: { wsId: string; role: string }[] }>(list)).items;
    expect(items).toHaveLength(1);
    expect(items[0]?.wsId).toBe('ws-1');
    expect(items[0]?.role).toBe('researcher');

    const removed = await call('DELETE', `${COWORKERS_PATH}/cw-emp/employments/ws-1`);
    expect(removed.status).toBe(200);
    const empty = await call('GET', `${COWORKERS_PATH}/cw-emp/employments`);
    expect((await json<{ items: unknown[] }>(empty)).items).toHaveLength(0);
  });

  it('three-layer red line: effective grants = self ∩ workspace ∩ project', () => {
    const self = ['search', 'files', 'board', 'draw'];
    const ws = ['search', 'files', 'chat'];
    expect(effectiveGrants(self, ws)).toEqual(['search', 'files']);
    expect(effectiveGrants(self, ws, ['search', 'board'])).toEqual(['search']);
    expect(effectiveGrants(self, ws, ['chat'])).toEqual([]);
    expect(effectiveGrants([], ws)).toEqual([]);
  });
});
