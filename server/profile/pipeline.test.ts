/// <reference types="node" />
/**
 * Profile pipeline tests: SSRF, extraction validation, per-user isolation,
 * the full six-stage flow over real HTTP, partial failures and idempotency.
 * No external network and no real model are contacted.
 */
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PROFILE_PATH, recordKey, type ProfileState } from '../../src/lib/profile.ts';
import { SESSION_COOKIE } from '../../src/lib/session.ts';
import { readConfig } from '../config.ts';
import { assertPublicTarget, fetchPublicPage, isPrivateAddress } from '../profile/fetch.ts';
import { extractPageItems, parseItemsPayload, type LlmCaller } from '../profile/extract.ts';
import {
  addCandidates,
  addSource,
  buildOverview,
  commitCandidates,
  createProfileStore,
  reviewCandidate,
  resetSession,
  startSession,
} from '../profile/store.ts';
import { createProfileRouter } from '../routes/profile.ts';
import { createSessionSource } from '../session/source.ts';

const DEV_COOKIE = `${SESSION_COOKIE}=dev:u-profile:ws-1`;
const OTHER_COOKIE = `${SESSION_COOKIE}=dev:u-other:ws-1`;
const PAGE = '<html><head><title>Cece — engineer</title></head><body><nav>Skip me</nav><h1>Cece</h1><p>Cece is a senior engineer building developer tools.</p><p>She works on runtime systems.</p><script>alert(1)</script></body></html>';

function pageResponse(body = PAGE, status = 200, type = 'text/html'): Response {
  return new Response(body, { status, headers: { 'content-type': type } });
}

const publicLookup = async () => ['93.184.216.34'];

const llm: LlmCaller = async () => ({
  ok: true,
  text: JSON.stringify({
    items: [
      { category: 'basic', content: 'Senior engineer', evidence: 'Cece is a senior engineer building developer tools.', informationType: 'explicit', confidence: 0.9 },
      { category: 'expertise', content: 'Runtime systems', evidence: 'She works on runtime systems.', informationType: 'explicit', confidence: 0.8 },
      { category: 'interests', content: 'Contact me at cece@example.com', evidence: 'Cece is a senior engineer', informationType: 'inferred', confidence: 0.4 },
      { category: 'goals', content: 'Invented goal', evidence: 'never appears in the page', informationType: 'explicit', confidence: 0.9 },
    ],
  }),
});

describe('SSRF and page retrieval', () => {
  it('rejects private, loopback, link-local and metadata addresses', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
  });

  it('rejects non-http schemes, credentials and blocked hosts', async () => {
    for (const url of ['file:///etc/passwd', 'ftp://example.com', 'http://user:pw@example.com', 'http://localhost/', 'http://metadata.google.internal/']) {
      const check = await assertPublicTarget(url, { fetcher: async () => pageResponse(), lookupAddresses: publicLookup });
      expect(check.ok).toBe(false);
    }
    const ok = await assertPublicTarget('https://example.com/about', { fetcher: async () => pageResponse(), lookupAddresses: publicLookup });
    expect(ok.ok).toBe(true);
  });

  it('revalidates redirects so a public page cannot bounce into a private host', async () => {
    let calls = 0;
    const result = await fetchPublicPage('https://example.com', {
      lookupAddresses: async (host) => (host === 'localhost' ? ['127.0.0.1'] : ['93.184.216.34']),
      fetcher: async () => {
        calls++;
        return calls === 1 ? new Response(null, { status: 302, headers: { location: 'http://localhost/admin' } }) : pageResponse();
      },
    });
    expect(result.ok).toBe(false);
  });

  it('strips scripts/navigation and returns bounded text with title', async () => {
    const result = await fetchPublicPage('https://example.com', {
      lookupAddresses: publicLookup,
      fetcher: async () => pageResponse(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.title).toBe('Cece — engineer');
    expect(result.page.text).toContain('senior engineer');
    expect(result.page.text).not.toContain('alert(1)');
    expect(result.page.text).not.toContain('Skip me');
  });

  it('never bypasses a login wall and refuses non-HTML content', async () => {
    const forbidden = await fetchPublicPage('https://example.com', { lookupAddresses: publicLookup, fetcher: async () => pageResponse('', 403) });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.failure.error.message).toContain('never bypassed');
    const pdf = await fetchPublicPage('https://example.com', { lookupAddresses: publicLookup, fetcher: async () => pageResponse('x', 200, 'application/pdf') });
    expect(pdf.ok).toBe(false);
  });
});

describe('extraction', () => {
  it('parses fenced JSON and keeps only validated, evidenced, non-sensitive items', async () => {
    expect(parseItemsPayload('```json\n{"items":[]}\n```')).toEqual([]);
    const result = await extractPageItems(PAGE.replace(/<[^>]+>/g, ' '), 'https://example.com', llm);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(2);
    expect(result.items.some((i) => i.content.includes('@'))).toBe(false);
    expect(result.items.some((i) => i.content === 'Invented goal')).toBe(false);
  });

  it('propagates model failures without inventing items', async () => {
    const failing: LlmCaller = async () => ({ ok: false, failure: { ok: false, error: { kind: 'upstream', message: 'model down', retryable: true } } });
    const result = await extractPageItems('some text', 'https://example.com', failing);
    expect(result.ok).toBe(false);
  });
});

describe('store transitions', () => {
  it('is per-user, dedupes, preserves edits, and commit is idempotent', () => {
    const root = mkdtempSync(join(tmpdir(), 'profile-store-'));
    const store = createProfileStore(root);
    const at = new Date().toISOString();
    let state = startSession(store.load('u-1'), at);
    const added = addSource(state, { type: 'website', url: 'https://example.com', at });
    state = added.state;
    const source = added.source!;
    state = addCandidates(state, source, [
      { category: 'basic', content: 'Senior engineer', evidence: 'excerpt', informationType: 'explicit', confidence: 0.9 },
      { category: 'basic', content: 'Senior engineer', evidence: 'excerpt', informationType: 'explicit', confidence: 0.9 },
    ], at);
    expect(state.candidates).toHaveLength(1); /* duplicate in one extraction */
    const id = state.candidates[0]!.id;
    state = reviewCandidate(state, id, 'edit', 'Principal engineer', 'u-1', at);
    state = commitCandidates(state, 'u-1', at);
    expect(state.records).toHaveLength(1);
    expect(state.records[0]!.content).toBe('Principal engineer'); /* user edit wins */
    expect(state.records[0]!.confirmedBy).toBe('u-1');
    expect(state.history).toHaveLength(1);
    expect(state.overview).toContain('Principal engineer');
    const again = commitCandidates(state, 'u-1', new Date().toISOString());
    expect(again.records).toHaveLength(1); /* idempotent */
    store.save('u-1', again);
    expect(store.load('u-other').records).toHaveLength(0); /* isolation */
    const reset = resetSession(again);
    expect(reset.records).toHaveLength(1); /* cancellation keeps confirmed data */
    expect(buildOverview([])).toBe('');
    expect(recordKey('basic', '  Senior   ENGINEER ')).toBe('basic:senior engineer');
    rmSync(root, { recursive: true, force: true });
  });
});

describe('full pipeline over HTTP', () => {
  let root: string;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'profile-route-'));
    const config = readConfig({ DEEPSEEK_API_KEY: 'test-key', DEEPSEEK_BASE_URL: 'http://stub.invalid', DATABASE_URL: '' });
    const router = createProfileRouter({
      config,
      sessionSource: createSessionSource(config),
      store: createProfileStore(root),
      llm,
      lookupAddresses: publicLookup,
      fetcher: async (url) => {
        if (url.includes('broken')) return pageResponse('', 503);
        return pageResponse();
      },
    });
    server = createServer((req, res) => router(req, res, req.url ?? '/'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  });

  const call = async (path: string, method = 'GET', payload?: unknown, cookie = DEV_COOKIE) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    return { status: res.status, body: (await res.json()) as { ok?: boolean; state?: ProfileState; error?: { message: string } } };
  };

  it('401 without a session; other users never see this state', async () => {
    const noSession = await fetch(`${base}${PROFILE_PATH}/state`);
    expect(noSession.status).toBe(401);
    const other = await call(`${PROFILE_PATH}/state`, 'GET', undefined, OTHER_COOKIE);
    expect(other.body.state?.sources).toHaveLength(0);
  });

  it('six stages: sources → discover (partial failure) → review → commit → rediscover', async () => {
    const added = await call(`${PROFILE_PATH}/sources`, 'POST', { type: 'website', url: 'https://example.com/about' });
    expect(added.status).toBe(200);
    expect(added.body.state?.session?.stage).toBe('sources');
    const broken = await call(`${PROFILE_PATH}/sources`, 'POST', { type: 'custom', url: 'https://broken.example.com/x' });
    expect(broken.body.state?.sources).toHaveLength(2);
    const invalid = await call(`${PROFILE_PATH}/sources`, 'POST', { type: 'website', url: 'http://127.0.0.1/private' });
    expect(invalid.status).toBe(200); /* URL shape valid; SSRF check happens at fetch time */
    const linkedin = await call(`${PROFILE_PATH}/sources`, 'POST', { type: 'linkedin', url: 'https://linkedin.com/in/x' });
    expect(linkedin.status).toBe(422); /* no fake integration */

    const discovered = await call(`${PROFILE_PATH}/discover`, 'POST', {});
    const state = discovered.body.state!;
    expect(state.sources.find((s) => s.url.includes('example.com/about'))?.status).toBe('ok');
    expect(state.sources.find((s) => s.url.includes('broken'))?.status).toBe('failed');
    expect(state.candidates.length).toBeGreaterThan(0); /* one failed source did not kill results */
    expect(state.session?.stage).toBe('review');

    const target = state.candidates.find((c) => c.status === 'pending')!;
    const edited = await call(`${PROFILE_PATH}/candidates/${target.id}`, 'PATCH', { action: 'edit', content: 'Principal engineer (confirmed)' });
    expect(edited.body.state?.candidates.find((c) => c.id === target.id)?.editedContent).toBe('Principal engineer (confirmed)');
    const rejected = state.candidates.filter((c) => c.id !== target.id)[0];
    if (rejected) await call(`${PROFILE_PATH}/candidates/${rejected.id}`, 'PATCH', { action: 'reject' });

    const committed = await call(`${PROFILE_PATH}/commit`, 'POST', {});
    expect(committed.body.state?.records.some((r) => r.content === 'Principal engineer (confirmed)')).toBe(true);
    expect(committed.body.state?.records[0]?.sourceUrl).toContain('example.com');
    expect(committed.body.state?.records[0]?.discoveredAt).toBeTruthy();
    expect(committed.body.state?.records[0]?.confirmedAt).toBeTruthy();
    expect(committed.body.state?.overview).toContain('Principal engineer');
    expect(committed.body.state?.history.length).toBeGreaterThan(0);

    const rerun = await call(`${PROFILE_PATH}/commit`, 'POST', {});
    expect(rerun.body.state?.records.length).toBe(committed.body.state?.records.length); /* no duplicates */
    const other = await call(`${PROFILE_PATH}/state`, 'GET', undefined, OTHER_COOKIE);
    expect(other.body.state?.records).toHaveLength(0); /* user isolation at the backend */
  });
});
