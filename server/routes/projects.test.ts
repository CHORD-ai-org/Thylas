/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PROJECTS_PATH,
  type ConnectionBody,
  type ConnectionListBody,
  type EntriesBody,
  type ProjectBody,
  type ProjectErr,
  type ProjectListBody,
} from '../../src/lib/projects.ts';
import { SESSION_COOKIE } from '../../src/lib/session.ts';
import { readConfig } from '../config.ts';
import type { ConversationDatabase } from '../persistence/client.ts';
import { createSessionSource } from '../session/source.ts';
import { createConnectorProbe } from '../connectors.ts';
import { createProjectsRouter } from './projects.ts';

const MIGRATIONS = './server/persistence/migrations';
const DEV_COOKIE = `${SESSION_COOKIE}=dev:u-1:ws-1`;

let client: PGlite;
let server: Server;
let base: string;
let root: string;

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
  root = await mkdtemp(join(tmpdir(), 'thylas-projects-'));
  client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS });
  const router = createProjectsRouter(
    db as unknown as ConversationDatabase,
    createSessionSource(readConfig({})),
    createConnectorProbe(),
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
  await rm(root, { recursive: true, force: true });
});

describe('P0 projects API over real HTTP', () => {
  let projectId = '';
  let connectionId = '';

  it('creates a project in the member workspace and lists it', async () => {
    const created = await call('POST', PROJECTS_PATH, {
      workspaceId: 'ws-1',
      name: 'Thylas 产品研究',
      summary: 'Project as a Collaborative Entity',
    });
    expect(created.status).toBe(201);
    const body = await json<ProjectBody>(created);
    expect(body.item.name).toBe('Thylas 产品研究');
    expect(body.item.state).toBe('active');
    projectId = body.item.id;

    const list = await call('GET', PROJECTS_PATH);
    expect((await json<ProjectListBody>(list)).items).toHaveLength(1);
  });

  it('P0 gate: connect → resolve → rename → mark broken → repair', async () => {
    const folder = join(root, 'thylas-repo');
    await mkdir(folder);

    const connected = await call('POST', `${PROJECTS_PATH}/${projectId}/connections`, {
      kind: 'local-folder',
      locator: folder,
      label: 'Thylas',
    });
    expect(connected.status).toBe(201);
    const connection = await json<ConnectionBody>(connected);
    expect(connection.item.health).toBe('ok');
    connectionId = connection.item.id;

    await rename(folder, join(root, 'thylas-repo-renamed'));

    const checked = await call(
      'POST',
      `${PROJECTS_PATH}/${projectId}/connections/${connectionId}/check`,
    );
    expect(checked.status).toBe(200);
    expect((await json<ConnectionBody>(checked)).item.health).toBe('broken');

    const card = await call('GET', `${PROJECTS_PATH}/${projectId}`);
    expect(card.status).toBe(200);
    expect((await json<ProjectBody>(card)).item.name).toBe('Thylas 产品研究');

    const listed = await call('GET', `${PROJECTS_PATH}/${projectId}/connections`);
    expect((await json<ConnectionListBody>(listed)).items[0]?.health).toBe('broken');

    const repaired = await call(
      'PATCH',
      `${PROJECTS_PATH}/${projectId}/connections/${connectionId}`,
      { locator: join(root, 'thylas-repo-renamed') },
    );
    expect(repaired.status).toBe(200);
    expect((await json<ConnectionBody>(repaired)).item.health).toBe('ok');
  });

  it('P1-3: three repo spellings become one Lemma card with normalized locators', async () => {
    const created = await call('POST', PROJECTS_PATH, {
      workspaceId: 'ws-1',
      name: 'Lemma',
    });
    const lemmaId = (await json<ProjectBody>(created)).item.id;

    const spellings = [
      'https://github.com/zbbsdsb/lemma-ai',
      'zbbsdsb/LemmaKnowledgeBase',
      'zbbsdsb/Analysis-Engine.git',
    ];
    for (const locator of spellings) {
      const res = await call('POST', `${PROJECTS_PATH}/${lemmaId}/connections`, {
        kind: 'github-repo',
        locator,
      });
      expect(res.status).toBe(201);
      const item = (await json<ConnectionBody>(res)).item;
      expect(item.locator).not.toContain('github.com');
      expect(item.locator.endsWith('.git')).toBe(false);
      expect(item.health).toBe('unknown');
    }
    const list = await call('GET', `${PROJECTS_PATH}/${lemmaId}/connections`);
    const items = (await json<ConnectionListBody>(list)).items;
    expect(items).toHaveLength(3);
    expect(items.map((x) => x.locator)).toContain('zbbsdsb/lemma-ai');

    const malformed = await call('POST', `${PROJECTS_PATH}/${lemmaId}/connections`, {
      kind: 'github-repo',
      locator: 'not a repo',
    });
    expect((await json<ConnectionBody>(malformed)).item.health).toBe('broken');
  });

  it('rejects a duplicate connection with 409', async () => {    const duplicate = await call('POST', `${PROJECTS_PATH}/${projectId}/connections`, {
      kind: 'local-folder',
      locator: join(root, 'thylas-repo-renamed'),
    });
    expect(duplicate.status).toBe(409);
    expect((await json<ProjectErr>(duplicate)).kind).toBe('conflict');
  });

  it('archives, then soft-deletes; the card disappears from the map', async () => {
    const archived = await call('PATCH', `${PROJECTS_PATH}/${projectId}`, {
      state: 'archived',
    });
    expect(archived.status).toBe(200);
    expect((await json<ProjectBody>(archived)).item.state).toBe('archived');

    const removed = await call('DELETE', `${PROJECTS_PATH}/${projectId}`);
    expect(removed.status).toBe(200);

    const list = await call('GET', PROJECTS_PATH);
    const ids = (await json<ProjectListBody>(list)).items.map((x) => x.id);
    expect(ids).not.toContain(projectId);

    const gone = await call('GET', `${PROJECTS_PATH}/${projectId}`);
    expect(gone.status).toBe(404);
  });

  it('refuses workspaces outside the session membership', async () => {
    const foreign = await call('POST', PROJECTS_PATH, {
      workspaceId: 'ws-2',
      name: 'Not yours',
    });
    expect(foreign.status).toBe(403);
  });

  it('rejects contract violations', async () => {
    const noName = await call('POST', PROJECTS_PATH, { workspaceId: 'ws-1' });
    expect(noName.status).toBe(400);

    const created = await call('POST', PROJECTS_PATH, { workspaceId: 'ws-1', name: 'Temp' });
    const projectId2 = (await json<ProjectBody>(created)).item.id;

    const badKind = await call('POST', `${PROJECTS_PATH}/${projectId2}/connections`, {
      kind: 'carrier-pigeon',
      locator: 'D:\\somewhere',
    });
    expect(badKind.status).toBe(400);

    const badState = await call('PATCH', `${PROJECTS_PATH}/${projectId2}`, {
      state: 'deleted',
    });
    expect(badState.status).toBe(400);

    const relative = await call('POST', `${PROJECTS_PATH}/${projectId2}/connections`, {
      kind: 'local-folder',
      locator: 'not/absolute',
    });
    expect(relative.status).toBe(201);
    expect((await json<ConnectionBody>(relative)).item.health).toBe('broken');
  });

  it('P0-3: lists one level of a connected folder and refuses escapes', async () => {
    const wt = join(root, 'worktree');
    await mkdir(join(wt, 'docs'), { recursive: true });
    await writeFile(join(wt, 'README.md'), '# wt');
    await writeFile(join(wt, 'docs', 'a.md'), 'a');

    const created = await call('POST', PROJECTS_PATH, { workspaceId: 'ws-1', name: 'Worktree' });
    const pid = (await json<ProjectBody>(created)).item.id;
    const connected = await call('POST', `${PROJECTS_PATH}/${pid}/connections`, {
      kind: 'local-folder',
      locator: wt,
      label: 'worktree',
    });
    const cid = (await json<ConnectionBody>(connected)).item.id;

    const top = await json<EntriesBody>(
      await call('GET', `${PROJECTS_PATH}/${pid}/connections/${cid}/entries`),
    );
    expect(top.entries.map((e) => `${e.kind}:${e.name}`)).toEqual(['dir:docs', 'file:README.md']);

    const nested = await json<EntriesBody>(
      await call('GET', `${PROJECTS_PATH}/${pid}/connections/${cid}/entries?path=docs`),
    );
    expect(nested.entries).toEqual([{ name: 'a.md', kind: 'file' }]);

    const escape = await call('GET', `${PROJECTS_PATH}/${pid}/connections/${cid}/entries?path=${encodeURIComponent('../')}`);
    expect(escape.status).toBe(400);
  });

  it('P0-3: a kind without a listing connector answers not_configured', async () => {
    const created = await call('POST', PROJECTS_PATH, { workspaceId: 'ws-1', name: 'Remote' });
    const pid = (await json<ProjectBody>(created)).item.id;
    const connected = await call('POST', `${PROJECTS_PATH}/${pid}/connections`, {
      kind: 'github-repo',
      locator: 'owner/repo',
      label: 'repo',
    });
    const cid = (await json<ConnectionBody>(connected)).item.id;
    const res = await call('GET', `${PROJECTS_PATH}/${pid}/connections/${cid}/entries`);
    expect(res.status).toBe(503);
  });
});
