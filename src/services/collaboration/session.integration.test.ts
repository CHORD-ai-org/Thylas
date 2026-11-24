/// <reference types="node" />
/**
 * C4 gate: 双 Coworker 可追溯协作一场 — over real HTTP and real PGlite,
 * with the AI scripted. The event chain is asserted through the transition
 * payloads' step numbers (not wall-clock ordering).
 */
import { PGlite } from '@electric-sql/pglite';
import { createServer, type Server } from 'node:http';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COWORKERS_PATH } from '../../lib/coworkers.ts';
import { type CollaborationSessionDto } from '../../lib/projects.ts';
import { SESSION_COOKIE } from '../../lib/session.ts';
import { readConfig } from '../../../server/config.ts';
import type { ConversationDatabase } from '../../../server/persistence/client.ts';
import { createSessionSource } from '../../../server/session/source.ts';
import { createCoworkersRouter } from '../../../server/routes/coworkers.ts';
import { createProjectsRouter } from '../../../server/routes/projects.ts';
import { createProjectsClient, type ProjectsClient } from '../projects/client';
import { createCoworkersClient, type CoworkersClient } from '../coworkers/client';
import { runCollaborationSession } from './session.ts';
import type { AskFn } from '../generation/loop.ts';

const MIGRATIONS = './server/persistence/migrations';
const DEV_COOKIE = `${SESSION_COOKIE}=dev:u-1:ws-1`;

let client: PGlite;
let server: Server;
let base: string;
let projects: ProjectsClient;
let coworkers: CoworkersClient;

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

const fetchAtBase: typeof fetch = (async (url: string, init?: RequestInit) =>
  fetch(`${base}${url}`, {
    ...init,
    headers: { cookie: DEV_COOKIE, ...(init?.headers as Record<string, string> | undefined) },
  })) as typeof fetch;

beforeAll(async () => {
  client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS });
  const source = createSessionSource(readConfig({}));
  const projectsRouter = createProjectsRouter(db as unknown as ConversationDatabase, source);
  const coworkersRouter = createCoworkersRouter(db as unknown as ConversationDatabase, source);
  server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path === COWORKERS_PATH || path.startsWith(`${COWORKERS_PATH}/`)) {
      coworkersRouter(req, res, path);
      return;
    }
    projectsRouter(req, res, path);
  });
  await listen(server);
  base = `http://127.0.0.1:${portOf(server)}`;
  projects = createProjectsClient(fetchAtBase);
  coworkers = createCoworkersClient(fetchAtBase);
}, 60_000);

afterAll(async () => {
  await close(server);
  await client.close();
});

async function seed(projectName: string): Promise<{ projectId: string; sessionId: string }> {
  const created = await projects.create({ workspaceId: 'ws-1', name: projectName });
  const projectId = (created as { item: { id: string } }).item.id;
  await client.query(
    "insert into coworkers (id, owner_id, name, created_at_ms) values ('cw-run-a', 'u-1', 'Mira', $1) on conflict do nothing",
    [Date.now()],
  );
  await client.query(
    "insert into coworkers (id, owner_id, name, created_at_ms) values ('cw-run-b', 'u-1', 'Archer', $1) on conflict do nothing",
    [Date.now()],
  );
  const session = await projects.createSession(projectId, {
    participants: {
      a: { coworkerId: 'cw-run-a', name: 'Mira' },
      b: { coworkerId: 'cw-run-b', name: 'Archer' },
    },
    budget: { maxSteps: 8, maxSeconds: 600 },
    summary: '协作一场',
  });
  const sessionId = (session as { item: { id: string } }).item.id;
  return { projectId, sessionId };
}

const RUBRIC = ['每个数字有来源', '结论一句话'];

/** fail once, then pass — two rounds per phase. */
let flakyCalls = 0;
const flakyAsk: AskFn = async (prompt) => {
  if (prompt.startsWith('逐条核对')) {
    flakyCalls += 1;
    return flakyCalls % 2 === 1
      ? { ok: true, text: '{"verdict":"fail","misses":["结论一句话"]}' }
      : { ok: true, text: '{"verdict":"pass","misses":[]}' };
  }
  return { ok: true, text: 'draft output' };
};

const alwaysFail: AskFn = async (prompt) =>
  prompt.startsWith('逐条核对')
    ? { ok: true, text: '{"verdict":"fail","misses":["每个数字有来源"]}' }
    : { ok: true, text: 'draft output' };

describe('C4-2 本地协调器', () => {
  it('C4 gate: 双 Coworker 可追溯协作一场', async () => {
    flakyCalls = 0;
    const { projectId, sessionId } = await seed('Lemma C4-2');

    const result = await runCollaborationSession({
      projectId,
      sessionId,
      task: '做竞品对比表',
      rubric: RUBRIC,
      askFn: flakyAsk,
      projects,
      coworkers,
    });

    expect(result.state).toBe('completed');
    expect(result.roundsA).toBe(2);
    expect(result.roundsB).toBe(2);
    expect(result.usedSteps).toBe(4);
    expect(result.candidateA).toBeDefined();
    expect(result.candidateB).toBeDefined();

    /* the state walk through transition steps — deterministic, not clock-based */
    const rows = (
      await client.query<{ verb: string; payload: unknown }>(
        "select verb, payload from coworker_events where coworker_id in ('cw-run-a','cw-run-b') and verb in ('delegate','respond','handoff','complete','request_human')",
      )
    ).rows;
    const walk = rows
      .map((r) => {
        const p = (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload) as {
          step?: number;
          sessionId?: string;
        };
        return { verb: r.verb, step: p.step ?? 0, sessionId: p.sessionId };
      })
      .filter((x) => x.sessionId === sessionId)
      .sort((x, y) => x.step - y.step)
      .map((x) => x.verb);
    expect(walk).toEqual(['delegate', 'respond', 'handoff', 'respond', 'complete']);

    /* both signatures landed */
    const candidates = await projects.listCandidates(projectId);
    const items = (candidates as { items: { proposedByName: string }[] }).items;
    expect(items.map((c) => c.proposedByName).sort()).toEqual(['Archer', 'Mira']);

    /* the handoff package is there (who/what/expected — the five questions) */
    const handoffs = await projects.listHandoffs(projectId);
    const handoff = (handoffs as { items: { fromName: string; toName: string; task: string; inputs: string[] }[] }).items[0];
    expect(handoff?.fromName).toBe('Mira');
    expect(handoff?.toName).toBe('Archer');
    expect(handoff?.task).toBe('做竞品对比表');
    expect(handoff?.inputs.length).toBeGreaterThan(0);
  });

  it('budget is the coordinator job: maxSteps stops exactly at the cap → needs_human', async () => {
    const { projectId, sessionId } = await seed('Lemma C4-2 budget');
    await projects.transitionSession(projectId, sessionId, { verb: 'request_human' }); // no-op to prove state stays usable
    const body = await projects.getSession(projectId, sessionId);
    expect((body as { item: CollaborationSessionDto }).item.state).toBe('needs_human');
    await projects.transitionSession(projectId, sessionId, { verb: 'reject' });
    /* rebuild a fresh session for the real budget run */
    const fresh = await projects.createSession(projectId, {
      participants: {
        a: { coworkerId: 'cw-run-a', name: 'Mira' },
        b: { coworkerId: 'cw-run-b', name: 'Archer' },
      },
      budget: { maxSteps: 2, maxSeconds: 600 },
    });
    const freshId = (fresh as { item: { id: string } }).item.id;

    const result = await runCollaborationSession({
      projectId,
      sessionId: freshId,
      task: '做对比表',
      rubric: RUBRIC,
      askFn: alwaysFail,
      projects,
      coworkers,
    });

    expect(result.state).toBe('needs_human');
    expect(result.usedSteps).toBe(2);
    expect(result.roundsA).toBe(2);
    expect(result.roundsB).toBe(0);
    expect(result.stoppedReason).toContain('预算触顶');

    const bRounds = (
      await client.query(
        "select id from coworker_events where coworker_id = 'cw-run-b' and verb = 'generation_round' and project_id = $1",
        [projectId],
      )
    ).rows;
    expect(bRounds).toHaveLength(0);
  });

  it('a session is not re-runnable; seconds budget flips to needs_human too', async () => {
    const { projectId, sessionId } = await seed('Lemma C4-2 seconds');
    let tick = 1_000_000;
    const result = await runCollaborationSession({
      projectId,
      sessionId,
      task: '做对比表',
      rubric: RUBRIC,
      askFn: alwaysFail,
      projects,
      coworkers,
      now: () => (tick += 400_000), // each call jumps 400s past a 60s budget
    });
    expect(result.state).toBe('needs_human');

    const again = await runCollaborationSession({
      projectId,
      sessionId,
      task: '做对比表',
      rubric: RUBRIC,
      askFn: alwaysFail,
      projects,
      coworkers,
    });
    expect(again.stoppedReason).toContain('不重新开局');
  });
});
