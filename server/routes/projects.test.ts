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
import { effectiveGrants } from '../../src/lib/coworkers.ts';
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

describe('C2 参工与署名落回', () => {
  let c2Project = '';

  it('C2-1: member upsert carries the grant subset; foreign workspace 403', async () => {
    const created = await call('POST', PROJECTS_PATH, { workspaceId: 'ws-1', name: 'Lemma C2' });
    c2Project = (await json<ProjectBody>(created)).item.id;

    const put = await call('PUT', `${PROJECTS_PATH}/${c2Project}/members/cw-1`, {
      role: 'researcher',
      grants: ['f-1', 'n-2'],
    });
    expect(put.status).toBe(200);

    const list = await call('GET', `${PROJECTS_PATH}/${c2Project}/members`);
    const items = (await json<{ items: { actorId: string; grants: string[] }[] }>(list)).items;
    expect(items).toHaveLength(1);
    expect(items[0]?.actorId).toBe('cw-1');

    /* three-layer red line: the project subset narrows, never widens */
    expect(effectiveGrants(['f-1', 'f-9'], ['f-1', 'n-2', 'x'], items[0]?.grants ?? [])).toEqual(['f-1']);

    await client.query(
      "insert into projects (id, workspace_id, name, state) values ('p-foreign', 'ws-2', 'Foreign', 'active')",
    );
    const foreign = await call('PUT', `${PROJECTS_PATH}/p-foreign/members/cw-1`, { role: 'x' });
    expect(foreign.status).toBe(403);

    const removed = await call('DELETE', `${PROJECTS_PATH}/${c2Project}/members/cw-1`);
    expect(removed.status).toBe(200);
    const empty = await call('GET', `${PROJECTS_PATH}/${c2Project}/members`);
    expect((await json<{ items: unknown[] }>(empty)).items).toHaveLength(0);
  });

  it('C2-2: signed candidate lands and confirm carries both signatures', async () => {
    const proposed = await call('POST', `${PROJECTS_PATH}/${c2Project}/candidates`, {
      title: '竞品对比表',
      body: '三列对比',
      proposedBy: 'cw-1',
      proposedByName: 'Mira',
    });
    expect(proposed.status).toBe(201);
    const candidateId = (await json<{ item: { id: string } }>(proposed)).item.id;

    const confirmed = await call('POST', `${PROJECTS_PATH}/${c2Project}/candidates/${candidateId}/confirm`);
    expect(confirmed.status).toBe(200);
    const accepted = (await json<{ item: { status: string; proposedByName: string; confirmedBy: string | null } }>(confirmed)).item;
    expect(accepted.status).toBe('accepted');
    expect(accepted.proposedByName).toBe('Mira');
    expect(accepted.confirmedBy).toBe('u-1');

    const second = await call('POST', `${PROJECTS_PATH}/${c2Project}/candidates`, {
      title: '草稿 B',
      proposedBy: 'cw-1',
      proposedByName: 'Mira',
    });
    const secondId = (await json<{ item: { id: string } }>(second)).item.id;
    const rejected = await call('POST', `${PROJECTS_PATH}/${c2Project}/candidates/${secondId}/reject`);
    const rejectedItem = (await json<{ item: { status: string; confirmedBy: string | null } }>(rejected)).item;
    expect(rejectedItem.status).toBe('rejected');
    expect(rejectedItem.confirmedBy).toBeNull();
  });
});

describe('C3 交接包与 INPUT_REQUIRED', () => {
  let c3Project = '';

  it('C3-1: the package is one atomic transfer — both signatures, failure means nothing happened', async () => {
    const created = await call('POST', PROJECTS_PATH, { workspaceId: 'ws-1', name: 'Lemma C3' });
    c3Project = (await json<ProjectBody>(created)).item.id;
    await client.query(
      "insert into coworkers (id, owner_id, name, created_at_ms) values ('cw-from', 'u-1', 'Mira', $1)",
      [Date.now()],
    );
    await client.query(
      "insert into coworkers (id, owner_id, name, created_at_ms) values ('cw-to', 'u-1', 'Archer', $1)",
      [Date.now()],
    );

    const beforeCount = (
      await client.query("select id from coworker_events where coworker_id = 'cw-from'")
    ).rows.length;

    const bad = await call('POST', `${PROJECTS_PATH}/${c3Project}/handoffs`, {
      fromCoworkerId: 'cw-from',
      fromName: 'Mira',
      toCoworkerId: 'cw-to',
      toName: 'Archer',
    });
    expect(bad.status).toBe(400);
    const emptyList = await call('GET', `${PROJECTS_PATH}/${c3Project}/handoffs`);
    expect((await json<{ items: unknown[] }>(emptyList)).items).toHaveLength(0);
    const afterBad = (
      await client.query("select id from coworker_events where coworker_id = 'cw-from'")
    ).rows.length;
    expect(afterBad).toBe(beforeCount);

    const ok = await call('POST', `${PROJECTS_PATH}/${c3Project}/handoffs`, {
      fromCoworkerId: 'cw-from',
      fromName: 'Mira',
      toCoworkerId: 'cw-to',
      toName: 'Archer',
      task: '接手竞品对比表',
      inputs: ['cand-1'],
      outputSchema: 'DecisionCards.v1',
      maxSteps: 4,
      done: '已做两列',
      openNotes: '第三列未决',
      nextStep: '补第三列再校验',
    });
    expect(ok.status).toBe(201);
    const item = (await json<{ item: { fromName: string; toName: string; inputs: string[]; maxSteps: number } }>(ok)).item;
    expect(item.fromName).toBe('Mira');
    expect(item.toName).toBe('Archer');
    expect(item.inputs).toEqual(['cand-1']);
    expect(item.maxSteps).toBe(4);

    const fromRows = (
      await client.query<{ verb: string }>("select verb from coworker_events where coworker_id = 'cw-from'")
    ).rows;
    expect(fromRows.map((x) => x.verb)).toContain('handoff');
    const toRows = (
      await client.query<{ verb: string }>("select verb from coworker_events where coworker_id = 'cw-to'")
    ).rows;
    expect(toRows.map((x) => x.verb)).toContain('handoff_received');
  });

  it('C3-2: stuck hands surface as needs_human and can resume', async () => {
    const list = await call('GET', `${PROJECTS_PATH}/${c3Project}/handoffs`);
    const handoffId = (await json<{ items: { id: string }[] }>(list)).items[0]?.id ?? '';

    const stuck = await call('POST', `${PROJECTS_PATH}/${c3Project}/handoffs/${handoffId}/stuck`, {});
    expect(stuck.status).toBe(200);
    const stuckItem = (await json<{ item: { status: string; stuckNote: string } }>(stuck)).item;
    expect(stuckItem.status).toBe('needs_human');
    expect(stuckItem.stuckNote.length).toBeGreaterThan(0);

    const resumed = await call('POST', `${PROJECTS_PATH}/${c3Project}/handoffs/${handoffId}/resume`, {});
    const resumedItem = (await json<{ item: { status: string } }>(resumed)).item;
    expect(resumedItem.status).toBe('open');
  });
});
