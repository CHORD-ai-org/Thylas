#!/usr/bin/env node
/**
 * Offline regression for the two API hosts (Phase 1, next step 1).
 *
 * Starts the standalone host on a free port, a second one with PORT overridden,
 * and a Vite dev server on a third. Checks that the three /api/ai* endpoints
 * still answer, the SPA is still served, and the conversations surface answers
 * 200 (DATABASE_URL set) or 503 not_configured (no database on this machine).
 *
 * No key, no upstream model call, no Docker. Run with `npm run api:check`.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VITE_BIN = 'node_modules/vite/bin/vite.js';
const STANDALONE = ['--env-file-if-exists=.env.local', 'server/index.ts'];
const STARTUP_ATTEMPTS = 60;
const STARTUP_DELAY_MS = 250;

let failures = 0;

function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ' · ' + detail : ''}\n`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

function spawnHost(args, env) {
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  let log = '';
  child.stdout.on('data', (chunk) => { log += String(chunk); });
  child.stderr.on('data', (chunk) => { log += String(chunk); });
  return { child, log: () => log };
}

async function waitFor(url, child) {
  for (let attempt = 0; attempt < STARTUP_ATTEMPTS; attempt += 1) {
    await sleep(STARTUP_DELAY_MS);
    try {
      return await fetch(url);
    } catch {
      if (child.exitCode !== null) return null;
    }
  }
  return null;
}

async function withHost(args, env, run) {
  const host = spawnHost(args, env);
  try {
    await run(host);
  } finally {
    host.child.kill('SIGTERM');
    await sleep(300);
  }
}

async function main() {
  const standalonePort = await freePort();
  const overridePort = await freePort();
  const vitePort = await freePort();

  await withHost(STANDALONE, { PORT: String(standalonePort) }, async (host) => {
    const base = `http://127.0.0.1:${standalonePort}`;
    const status = await waitFor(`${base}/api/ai/status`, host.child);
    if (!status) {
      check('standalone /api/ai/status', false, host.log().slice(-300));
      return;
    }
    const body = await status.text();
    check(
      'standalone /api/ai/status',
      status.status === 200 && /"configured":(true|false)/.test(body) && /"model":/.test(body),
      body,
    );

    const missing = await fetch(`${base}/api/ai/nope`);
    check('unknown API path', missing.status === 404, `HTTP ${missing.status}`);

    const bad = await fetch(`${base}/api/ai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const badBody = await bad.text();
    check('empty prompt', bad.status === 400 && /"kind":"contract"/.test(badBody), badBody);

    const DEV_COOKIE = 'thylas_session=dev:u-1:ws-1';

    const anon = await fetch(`${base}/api/conversations`);
    const anonBody = await anon.text();
    check(
      'conversations 401',
      anon.status === 401 && /"kind":"unauthorized"/.test(anonBody),
      `HTTP ${anon.status} ${anonBody}`,
    );

    const withSession = await fetch(`${base}/api/conversations`, {
      headers: { cookie: DEV_COOKIE },
    });
    check(
      'conversations with session',
      [200, 503].includes(withSession.status),
      `HTTP ${withSession.status} ${await withSession.text()}`,
    );

    const sessionAnon = await fetch(`${base}/api/session`);
    check('session 401', sessionAnon.status === 401, `HTTP ${sessionAnon.status}`);
    await sessionAnon.text();

    const session = await fetch(`${base}/api/session`, {
      headers: { cookie: DEV_COOKIE },
    });
    const sessionBody = await session.text();
    check(
      'session flags',
      session.status === 200 && /"workspaceIds"/.test(sessionBody),
      `HTTP ${session.status} ${sessionBody}`,
    );

    const filesAnon = await fetch(`${base}/api/files`);
    check('files 401', filesAnon.status === 401, `HTTP ${filesAnon.status}`);
    await filesAnon.text();

    const filesWithSession = await fetch(`${base}/api/files`, {
      headers: { cookie: DEV_COOKIE },
    });
    check(
      'files with session',
      [200, 503].includes(filesWithSession.status),
      `HTTP ${filesWithSession.status} ${await filesWithSession.text()}`,
    );

    const chatAnon = await fetch(`${base}/api/chat/state`);
    check('chat state 401', chatAnon.status === 401, `HTTP ${chatAnon.status}`);
    await chatAnon.text();

    const chatWithSession = await fetch(`${base}/api/chat/state`, {
      headers: { cookie: DEV_COOKIE },
    });
    check(
      'chat state with session',
      [200, 503].includes(chatWithSession.status),
      `HTTP ${chatWithSession.status} ${await chatWithSession.text()}`,
    );
  });

  await withHost(STANDALONE, { PORT: String(overridePort) }, async (host) => {
    const status = await waitFor(`http://127.0.0.1:${overridePort}/api/ai/status`, host.child);
    check('PORT override', Boolean(status && status.status === 200), status ? `HTTP ${status.status}` : host.log().slice(-300));
    if (status) await status.text();
  });

  await withHost(
    [VITE_BIN, '--port', String(vitePort), '--strictPort', '--host', '127.0.0.1'],
    {},
    async (host) => {
      const base = `http://127.0.0.1:${vitePort}`;
      const status = await waitFor(`${base}/api/ai/status`, host.child);
      check('vite dev /api/ai/status', Boolean(status && status.status === 200), status ? `HTTP ${status.status}` : host.log().slice(-300));
      if (status) await status.text();

      const page = await fetch(`${base}/`);
      const html = await page.text();
      check('vite dev SPA', page.status === 200 && html.includes('<div id="root"'), `HTTP ${page.status}`);
    },
  );

  process.stdout.write(`\n${failures === 0 ? 'api-checks: all green' : `api-checks: ${failures} failed`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  process.stdout.write(`api-checks: crashed — ${String(error)}\n`);
  process.exitCode = 1;
});
