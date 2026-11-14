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
const PREVIEW = 5200;
const MULTI = 5201;
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

/** The stub answers in the shape of the provider the path belongs to. */
const stub = createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
  });
  req.on('end', () => {
    const path = req.url ?? '';
    let body = {};
    try {
      body = JSON.parse(raw) || {};
    } catch {
      /* a body that is not JSON is itself a finding */
    }
    hits.push({
      mode,
      path,
      model: body.model ?? null,
      stream: body.stream === true,
      authorization: req.headers.authorization ?? null,
      apiKey: req.headers['x-api-key'] ?? null,
      anthropicVersion: req.headers['anthropic-version'] ?? null,
      body: raw,
    });
    if (mode === 'hang') return;

    const send = (code, payload) => {
      res.statusCode = code;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(payload));
    };
    const stream = (frames) => {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/event-stream');
      for (const frame of frames) res.write(frame);
      res.end();
    };

    /* Anthropic has its own endpoint and its own reply shape. */
    if (path.endsWith('/v1/messages')) {
      if (mode === 'ok') {
        if (body.stream === true) {
          return stream([
            `event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { model: body.model ?? 'claude-stub' } })}\n\n`,
            `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Stub ' } })}\n\n`,
            `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'answer.' } })}\n\n`,
            `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`,
          ]);
        }
        return send(200, {
          id: 'msg_stub',
          type: 'message',
          role: 'assistant',
          model: body.model ?? 'claude-stub',
          content: [{ type: 'text', text: 'Stub answer.' }],
          stop_reason: 'end_turn',
        });
      }
      if (mode === 'junk') return send(200, { hello: 'world' });
      return send(Number(mode), { error: { message: `stub ${mode}` } });
    }

    if (!path.endsWith('/chat/completions')) {
      res.statusCode = 404;
      res.end('{}');
      return;
    }
    if (mode === 'ok') {
      if (body.stream === true) {
        return stream([
          `data: ${JSON.stringify({ model: body.model ?? 'stub-model', choices: [{ delta: { content: 'Stub ' } }] })}\n\n`,
          `data: ${JSON.stringify({ model: body.model ?? 'stub-model', choices: [{ delta: { content: 'answer.' } }] })}\n\n`,
          'data: [DONE]\n\n',
        ]);
      }
      return send(200, {
        model: body.model ?? 'deepseek-chat',
        choices: [{ message: { role: 'assistant', content: 'Stub answer.' } }],
      });
    }
    if (mode === 'junk') return send(200, { hello: 'world' });
    return send(Number(mode), { error: { message: `stub ${mode}` } });
  });
});

// ---- dev servers ---------------------------------------------------------
const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const servers = [];

function startVite(command, port, extraEnv) {
  const child = spawn(
    process.execPath,
    [viteBin, command, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
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

/** The streaming sibling, read as the browser reads it: raw SSE text. */
async function callStream(port, body, init = {}) {
  const res = await fetch(`http://127.0.0.1:${port}/api/ai/stream`, {
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
    /* a pre-stream failure is JSON; a stream is not */
  }
  return {
    status: res.status,
    json,
    text,
    provider: res.headers.get('x-thylas-provider'),
    model: res.headers.get('x-thylas-model'),
  };
}

async function main() {
  await new Promise((r) => stub.listen(STUB, '127.0.0.1', r));
  /* Every provider key is set explicitly, including the empty ones: the
     project's own .env.local may hold a real key, and a server that was meant
     to have none must not inherit one. */
  const noKeys = {
    DEEPSEEK_API_KEY: '',
    OPENAI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    OPENROUTER_API_KEY: '',
    KIMI_API_KEY: '',
  };
  startVite('dev', WITH_KEY, {
    ...noKeys,
    DEEPSEEK_API_KEY: 'sk-stub-not-a-real-key',
    DEEPSEEK_BASE_URL: `http://127.0.0.1:${STUB}`,
    /* Short so the `hang` branch costs 1.5 s instead of 30. */
    DEEPSEEK_TIMEOUT_MS: '1500',
  });
  startVite('dev', NO_KEY, {
    ...noKeys,
    DEEPSEEK_BASE_URL: `http://127.0.0.1:${STUB}`,
  });
  /* A server with several providers configured at once — the shape D-061
     makes possible. Every provider points at the same stub; the path tells
     them apart. */
  startVite('dev', MULTI, {
    ...noKeys,
    DEEPSEEK_API_KEY: 'sk-stub-deepseek',
    DEEPSEEK_BASE_URL: `http://127.0.0.1:${STUB}`,
    OPENAI_API_KEY: 'sk-stub-openai',
    OPENAI_BASE_URL: `http://127.0.0.1:${STUB}/v1`,
    ANTHROPIC_API_KEY: 'sk-stub-anthropic',
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${STUB}`,
    KIMI_API_KEY: 'sk-stub-kimi',
    KIMI_BASE_URL: `http://127.0.0.1:${STUB}/v1`,
    DEEPSEEK_TIMEOUT_MS: '1500',
    OPENAI_TIMEOUT_MS: '1500',
    ANTHROPIC_TIMEOUT_MS: '1500',
    KIMI_TIMEOUT_MS: '1500',
  });
  await Promise.all([
    waitFor(WITH_KEY, 'dev server'),
    waitFor(NO_KEY, 'keyless dev server'),
    waitFor(MULTI, 'multi-provider dev server'),
  ]);

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
  check('key → the provider that answered', ok.json?.provider, 'deepseek');
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
  checkThat(
    '429 → the upstream JSON is reduced to its sentence',
    limited.json?.message,
    (m) => typeof m === 'string' && m.includes('stub 429') && !m.includes('{"error"'),
    '(expected the message, not the envelope)',
  );

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

  // ---- several providers on one server (D-061) ----
  mode = 'ok';
  const beforeMulti = hits.length;

  const status = await fetch(`http://127.0.0.1:${MULTI}/api/ai/status`).then((r) => r.json());
  check('status → the server is configured', status.configured, true);
  check('status → the default provider', status.default?.provider, 'deepseek');
  checkThat(
    'status → every provider is listed',
    status.providers?.map((p) => p.id),
    (ids) => Array.isArray(ids) && ids.includes('anthropic') && ids.includes('openai'),
  );
  checkThat(
    'status → a key never reaches the browser',
    JSON.stringify(status),
    (body) => !body.includes('sk-stub'),
  );

  const openai = await call(MULTI, { prompt: 'hi', provider: 'openai', model: 'gpt-4o' });
  check('openai → 200', openai.status, 200);
  check('openai → the completion text', openai.json?.text, 'Stub answer.');
  check('openai → the provider that answered', openai.json?.provider, 'openai');
  const openaiHit = hits[hits.length - 1];
  check('openai → the OpenAI path', openaiHit?.path, '/v1/chat/completions');
  check('openai → the requested model', openaiHit?.model, 'gpt-4o');
  check('openai → a bearer key', openaiHit?.authorization, 'Bearer sk-stub-openai');

  const anthropic = await call(MULTI, { prompt: 'hi', provider: 'anthropic' });
  check('anthropic → 200', anthropic.status, 200);
  check('anthropic → the completion text', anthropic.json?.text, 'Stub answer.');
  check('anthropic → the provider that answered', anthropic.json?.provider, 'anthropic');
  const anthropicHit = hits[hits.length - 1];
  check('anthropic → the messages path', anthropicHit?.path, '/v1/messages');
  check('anthropic → its own key header', anthropicHit?.apiKey, 'sk-stub-anthropic');
  check('anthropic → the version header', anthropicHit?.anthropicVersion, '2023-06-01');
  checkThat(
    'anthropic → the request carries max_tokens',
    anthropicHit?.body,
    (body) => typeof body === 'string' && body.includes('max_tokens'),
  );

  const kimi = await call(MULTI, { prompt: 'hi', provider: 'kimi', model: 'kimi-k2.6' });
  check('kimi → 200', kimi.status, 200);
  check('kimi → the requested model', hits[hits.length - 1]?.model, 'kimi-k2.6');

  const unknown = await call(MULTI, { prompt: 'hi', provider: 'acme' });
  check('an unknown provider → kind contract', unknown.json?.kind, 'contract');
  check('an unknown provider → 400', unknown.status, 400);

  const outside = await call(MULTI, { prompt: 'hi', provider: 'openai', model: 'not-a-model' });
  check('a model outside the allowlist → kind contract', outside.json?.kind, 'contract');
  check('a model outside the allowlist → 400', outside.status, 400);

  const unconfiguredProvider = await call(WITH_KEY, { prompt: 'hi', provider: 'anthropic' });
  check('a provider without a key → kind not_configured', unconfiguredProvider.json?.kind, 'not_configured');
  checkThat(
    'a provider without a key → the message names its variable',
    unconfiguredProvider.json?.message,
    (m) => typeof m === 'string' && m.includes('ANTHROPIC_API_KEY'),
  );

  /* A refusal must not reach the upstream either. */
  const hitsBeforeRefusal = hits.length;
  await call(MULTI, { prompt: 'hi', provider: 'acme' });
  check('a refused provider never reaches the upstream', hits.length - hitsBeforeRefusal, 0);
  check('the provider calls did reach the upstream', hits.length - beforeMulti, 3);

  // ---- the stream, per provider ----
  const openaiStream = await callStream(MULTI, { prompt: 'hi', provider: 'openai', model: 'gpt-4o' });
  check('the stream → 200', openaiStream.status, 200);
  check('the stream → the provider in the header', openaiStream.provider, 'openai');
  check('the stream → the model in the header', openaiStream.model, 'gpt-4o');
  checkThat(
    'the stream → the OpenAI bytes are the upstream bytes',
    openaiStream.text,
    (text) => typeof text === 'string' && text.includes('"content":"Stub "') && text.includes('[DONE]'),
  );

  const anthropicStream = await callStream(MULTI, { prompt: 'hi', provider: 'anthropic' });
  check('the anthropic stream → 200', anthropicStream.status, 200);
  check('the anthropic stream → the provider in the header', anthropicStream.provider, 'anthropic');
  checkThat(
    'the anthropic stream → the events are re-framed as OpenAI SSE',
    anthropicStream.text,
    (text) =>
      typeof text === 'string' &&
      text.includes('"choices"') &&
      text.includes('"content":"Stub "') &&
      text.includes('[DONE]') &&
      !text.includes('content_block_delta'),
  );

  const refusedStream = await callStream(MULTI, { prompt: 'hi', provider: 'acme' });
  check('a refused provider never opens a stream', refusedStream.json?.kind, 'contract');

  // ---- contract ----
  mode = 'ok';
  const long = await call(WITH_KEY, { prompt: 'x'.repeat(8001) });  check('8001 characters → kind contract', long.json?.kind, 'contract');
  checkThat(
    '8001 characters → the message states the limit',
    long.json?.message,
    (m) => typeof m === 'string' && m.includes('8000'),
    '(expected the limit in the message)',
  );
  const atLimit = await call(WITH_KEY, { prompt: 'x'.repeat(8000) });
  check('8000 characters is allowed', atLimit.status, 200);

  /* Over the 64 KB wire cap, so the refusal comes from the body reader rather
     than the character count — a caller sending a megabyte must be stopped
     before it is buffered, not after. */
  const huge = await call(WITH_KEY, { prompt: 'x'.repeat(70_000) });
  check('a 70 KB body → kind contract', huge.json?.kind, 'contract');
  checkThat(
    'a 70 KB body → the byte cap is named',
    huge.json?.message,
    (m) => typeof m === 'string' && m.includes('KB'),
    '(expected the KB cap in the message)',
  );

  const notJson = await call(WITH_KEY, '{oops');
  check('a body that is not JSON → kind contract', notJson.json?.kind, 'contract');
  const empty = await call(WITH_KEY, { prompt: '   ' });
  check('a blank prompt → kind contract', empty.json?.kind, 'contract');
  const get = await fetch(`http://127.0.0.1:${WITH_KEY}/api/ai`);
  check('GET → 405', get.status, 405);

  // ---- preview mounts the same handler, not just dev ----
  let hasDist = true;
  try {
    statSync(join(ROOT, 'dist', 'index.html'));
  } catch {
    hasDist = false;
  }
  if (hasDist) {
    startVite('preview', PREVIEW, {
      ...noKeys,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${STUB}`,
    });
    await waitFor(PREVIEW, 'preview server');
    const prev = await call(PREVIEW, { prompt: 'hi' });
    check('preview → the middleware is mounted', prev.json?.kind, 'not_configured');
    check('preview → 503', prev.status, 503);
  } else {
    console.log('…  dist/ is absent; the preview mount is unchecked');
  }

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
  .finally(async () => {
    /* The dev servers have to be gone before this process exits: a child that
       outlives the run keeps its port, and the next run then talks to the
       wrong server instead of its own. */
    const stopped = servers.map(
      (child) =>
        new Promise((resolve) => {
          const timer = setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
          }, 3000);
          child.once('exit', () => {
            clearTimeout(timer);
            resolve();
          });
          child.kill();
        }),
    );
    await Promise.all(stopped);
    stub.close();
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n${passed}/${results.length} passed`);
    /* The exit code is set, not the exit: `process.exit()` can truncate stdout
       when it is a pipe, and the results are the whole point of the run. */
    process.exitCode = passed === results.length ? 0 : 1;
  });
