#!/usr/bin/env node
/**
 * Offline proof of the AI path (SP-07a).
 *
 * The point of this script is that it needs no key and no network: a stub
 * upstream answers 200/401/429/500/garbage/hang on demand, and a real Vite dev
 * server mounts the real middleware in front of it. Every branch of the error
 * taxonomy is therefore exercised end to end over HTTP, not asserted from a unit
 * test that could disagree with the wiring.
 *
 * Two servers are started because `not_configured` is a property of the process
 * environment, not of a request: one with a key, one without.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WITH_KEY = 5199;
const NO_KEY = 5198;
const STUB = 8799;

const results = [];
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, pass, actual });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${pass ? '' : `  → ${JSON.stringify(actual)}`}`);
}

function checkThat(name, value, predicate, note) {
  const pass = predicate(value);
  results.push({ name, pass, actual: value });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${pass ? '' : `  → ${JSON.stringify(value)} ${note ?? ''}`}`);
}

// ---- stub upstream -------------------------------------------------------
let mode = 'ok';
const hits = [];
const stub = createServer((req, res) => {
  req.resume();
  if (!req.url?.endsWith('/chat/completions')) {
    res.statusCode = 404;
    res.end('{}');
    return;
  }
  hits.push(mode);
  if (mode === 'hang') return;
  const send = (code, body) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };
  if (mode === 'ok') {
    return send(200, {
      model: 'deepseek-chat',
      choices: [{ message: { role: 'assistant', content: 'Stub answer.' } }],
    });
  }
  if (mode === 'junk') return send(200, { hello: 'world' });
  return send(Number(mode), { error: { message: `stub ${mode}` } });
});

// ---- dev servers ---------------------------------------------------------
const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const servers = [];

function startDev(port, extraEnv) {
  const child = spawn(
    process.execPath,
    [viteBin, 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: ROOT,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );
  let stderr = '';
  child.stderr.on('data', (b) => {
    stderr += String(b);
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.log(`vite ${port} exited ${code}: ${stderr.slice(-400)}`);
  });
  servers.push(child);
  return child;
}

async function waitFor(port, label) {
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`);
      if (r.ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${label} on ${port} never answered`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(port, body, init = {}) {
  const started = Date.now();
  const res = await fetch(`http://127.0.0.1:${port}/api/ai`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* a non-JSON body is itself a finding */
  }
  return { status: res.status, json, text, ms: Date.now() - started };
}

async function main() {
  await new Promise((r) => stub.listen(STUB, '127.0.0.1', r));
  startDev(
    WITH_KEY,
    {
      DEEPSEEK_API_KEY: 'sk-stub-not-a-real-key',
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${STUB}`,
      /* Short so the `hang` branch costs 1.5 s instead of 30. */
      DEEPSEEK_TIMEOUT_MS: '1500',
    },
  );
  startDev(NO_KEY, {
    DEEPSEEK_API_KEY: '',
    DEEPSEEK_BASE_URL: `http://127.0.0.1:${STUB}`,
  });
  await Promise.all([waitFor(WITH_KEY, 'dev server'), waitFor(NO_KEY, 'keyless dev server')]);

  // ---- no key: configuration, and nothing is sent upstream ----
  const before = hits.length;
  const unset = await call(NO_KEY, { prompt: 'hi' });
  check('no key → 503', unset.status, 503);
  check('no key → kind not_configured', unset.json?.kind, 'not_configured');
  check('no key → not retryable', unset.json?.retryable, false);
  checkThat(
    'no key → the message names the variable',
    unset.json?.message,
    (m) => typeof m === 'string' && m.includes('DEEPSEEK_API_KEY'),
    '(expected the env var name)',
  );
  check('no key → upstream was not called', hits.length - before, 0);

  // ---- happy path ----
  mode = 'ok';
  const ok = await call(WITH_KEY, { prompt: 'What is a boundary?' });
  check('key → 200', ok.status, 200);
  check('key → ok true', ok.json?.ok, true);
  check('key → the completion text', ok.json?.text, 'Stub answer.');
  check('key → the model that answered', ok.json?.model, 'deepseek-chat');
  checkThat('key → a latency in ms', ok.json?.ms, (v) => typeof v === 'number' && v >= 0);

  // ---- failure taxonomy ----
  mode = '401';
  const unauth = await call(WITH_KEY, { prompt: 'hi' });
  check('401 → kind unauthorized', unauth.json?.kind, 'unauthorized');
  check('401 → not retryable', unauth.json?.retryable, false);
  check('401 → 502 (the endpoint failed, not the caller)', unauth.status, 502);

  mode = '429';
  const limited = await call(WITH_KEY, { prompt: 'hi' });
  check('429 → kind rate_limited', limited.json?.kind, 'rate_limited');
  check('429 → retryable', limited.json?.retryable, true);
  check('429 → 429', limited.status, 429);

  mode = '500';
  const broken = await call(WITH_KEY, { prompt: 'hi' });
  check('500 → kind upstream', broken.json?.kind, 'upstream');
  check('500 → retryable', broken.json?.retryable, true);
  check('500 → 502', broken.status, 502);

  mode = 'junk';
  const junk = await call(WITH_KEY, { prompt: 'hi' });
  check('a reply that is not a completion → kind upstream', junk.json?.kind, 'upstream');

  mode = 'hang';
  const hung = await call(WITH_KEY, { prompt: 'hi' });
  check('no answer → kind timeout', hung.json?.kind, 'timeout');
  check('no answer → 504', hung.status, 504);
  check('no answer → retryable', hung.json?.retryable, true);
  checkThat(
    'no answer → gives up near the timeout, not never',
    hung.ms,
    (v) => v >= 1300 && v < 6000,
    '(expected ~1.5 s)',
  );

  // ---- contract ----
  mode = 'ok';
  const long = await call(WITH_KEY, { prompt: 'x'.repeat(8001) });
  check('8001 characters → kind contract', long.json?.kind, 'contract');
  checkThat(
    '8001 characters → the message states the limit',
    long.json?.message,
    (m) => typeof m === 'string' && m.includes('8000'),
    '(expected the limit in the message)',
  );
  const atLimit = await call(WITH_KEY, { prompt: 'x'.repeat(8000) });
  check('8000 characters is allowed', atLimit.status, 200);

  const notJson = await call(WITH_KEY, '{oops');
  check('a body that is not JSON → kind contract', notJson.json?.kind, 'contract');
  const empty = await call(WITH_KEY, { prompt: '   ' });
  check('a blank prompt → kind contract', empty.json?.kind, 'contract');
  const get = await fetch(`http://127.0.0.1:${WITH_KEY}/api/ai`);
  check('GET → 405', get.status, 405);

  // ---- the key never comes back ----
  checkThat(
    'no response carries key material',
    [ok.text, unauth.text, limited.text, broken.text, junk.text],
    (bodies) => bodies.every((b) => !b.includes('sk-')),
    '(found sk- in a response)',
  );

  // ---- the key never reaches the browser ----
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  const srcFiles = walk(join(ROOT, 'src'));
  const keyShapedInSrc = /sk-[A-Za-z0-9]{16,}/;
  const leaks = srcFiles.filter((f) => keyShapedInSrc.test(readFileSync(f, 'utf8')));
  check('no key-shaped string in src/', leaks.length, 0);

  let distFiles = [];
  try {
    distFiles = walk(join(ROOT, 'dist'));
  } catch {
    distFiles = [];
  }
  if (distFiles.length === 0) {
    console.log('…  dist/ is absent; the bundle grep runs after `npm run build`');
  } else {
    /* Key-shaped, not the two characters: "task-" and "risk-" contain "sk-". */
    const keyShaped = /sk-[A-Za-z0-9]{16,}/;
    const bundled = distFiles.filter((f) => keyShaped.test(readFileSync(f, 'utf8')));
    check('no key-shaped string in dist/', bundled.length, 0);
  }
}

main()
  .catch((err) => {
    results.push({ name: 'the run stopped before the last check', pass: false, actual: String(err) });
    console.log(`FAIL the run stopped early: ${err}`);
  })
  .finally(() => {
    for (const s of servers) s.kill();
    stub.close();
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n${passed}/${results.length} passed`);
    process.exit(passed === results.length ? 0 : 1);
  });
