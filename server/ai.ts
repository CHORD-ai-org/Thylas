/// <reference types="node" />
/**
 * The only path to the model. A browser cannot hold the key (brief §"no secrets
 * in the client"), so this middleware holds it and the client sees a typed body
 * instead of an upstream one (D-006).
 *
 * Mounted by Vite in `dev` and in `preview`; a real host mounts the same handler
 * later (Q-2). Nothing here is production-shaped on purpose: no retries, no
 * queue, no streaming.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import {
  AI_MAX_PROMPT,
  AI_PATH,
  AI_TIMEOUT_MS,
  failure,
  readCompletion,
  statusFor,
  type AiBody,
  type AiErrorKind,
} from '../src/lib/ai';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';

/**
 * 8000 characters is at most ~32 KB of UTF-8. The wire cap is what stops a
 * caller from streaming a gigabyte into memory before the character check runs.
 */
const MAX_BODY_BYTES = 64 * 1024;

type Env = Record<string, string | undefined>;

/** The key never enters a log line and never reaches the client. */
function scrub(text: string, key: string): string {
  return key ? text.split(key).join('***') : text;
}

function timeoutFrom(env: Env): number {
  const raw = Number(env.DEEPSEEK_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : AI_TIMEOUT_MS;
}

function sendJson(res: ServerResponse, status: number, body: AiBody): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(payload));
  res.setHeader('cache-control', 'no-store');
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    let size = 0;
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body-too-large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(chunks.join('')));
    req.on('error', reject);
  });
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).trim();
  } catch {
    return '';
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function upstreamMessage(kind: AiErrorKind, status: number, detail: string): string {
  const tail = detail ? ` — ${detail.slice(0, 200)}` : '';
  if (kind === 'unauthorized') {
    return `The model rejected the key (${status}). Check DEEPSEEK_API_KEY.${tail}`;
  }
  if (kind === 'rate_limited') {
    return `The model is rate limiting this key (${status}). Wait, then retry.${tail}`;
  }
  return `The model answered ${status}.${tail}`;
}

export async function handleAiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: Env,
): Promise<void> {
  if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
    res.setHeader('allow', 'POST');
    sendJson(res, 405, failure('contract', 'POST only.'));
    return;
  }

  const key = (env.DEEPSEEK_API_KEY ?? '').trim();
  if (!key) {
    /* A missing key is configuration, not a broken network. Say which variable
       is missing, and do not reach upstream at all. */
    sendJson(
      res,
      statusFor('not_configured'),
      failure(
        'not_configured',
        'No model key on the server. Put DEEPSEEK_API_KEY in .env.local and restart the dev server.',
      ),
    );
    return;
  }

  let raw: string;
  try {
    raw = await readBody(req);
  } catch (err) {
    const tooLarge = err instanceof Error && err.message === 'body-too-large';
    sendJson(
      res,
      tooLarge ? statusFor('contract') : 400,
      failure(
        'contract',
        tooLarge
          ? `The request body is over ${MAX_BODY_BYTES / 1024} KB. A prompt is capped at ${AI_MAX_PROMPT} characters.`
          : 'The request body could not be read.',
      ),
    );
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    sendJson(res, statusFor('contract'), failure('contract', 'The request body is not JSON.'));
    return;
  }

  const prompt =
    typeof parsed === 'object' && parsed !== null && 'prompt' in parsed
      ? typeof (parsed as { prompt: unknown }).prompt === 'string'
        ? ((parsed as { prompt: string }).prompt as string).trim()
        : ''
      : '';

  if (!prompt) {
    sendJson(res, statusFor('contract'), failure('contract', 'The request needs a non-empty "prompt" string.'));
    return;
  }
  if (prompt.length > AI_MAX_PROMPT) {
    sendJson(
      res,
      statusFor('contract'),
      failure(
        'contract',
        `The prompt is ${prompt.length} characters; the limit is ${AI_MAX_PROMPT}.`,
      ),
    );
    return;
  }

  const base = (env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = timeoutFrom(env);
  const started = Date.now();

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const timedOut = name === 'TimeoutError' || name === 'AbortError';
    sendJson(
      res,
      statusFor(timedOut ? 'timeout' : 'network'),
      timedOut
        ? failure('timeout', `No answer within ${Math.round(timeoutMs / 1000)} s.`, true)
        : failure(
            'network',
            `Could not reach ${base}. The machine may be offline or the host unreachable.`,
            true,
          ),
    );
    return;
  }

  if (!upstream.ok) {
    const detail = scrub(await safeText(upstream), key);
    const kind: AiErrorKind =
      upstream.status === 401 || upstream.status === 403
        ? 'unauthorized'
        : upstream.status === 429
          ? 'rate_limited'
          : 'upstream';
    const retryable = kind === 'rate_limited' || upstream.status === 408 || upstream.status >= 500;
    sendJson(
      res,
      statusFor(kind),
      failure(kind, upstreamMessage(kind, upstream.status, detail), retryable),
    );
    return;
  }

  const completion = readCompletion(await safeJson(upstream));
  if (!completion) {
    sendJson(
      res,
      statusFor('upstream'),
      failure('upstream', 'The reply from the model was not a completion.', true),
    );
    return;
  }

  sendJson(res, 200, {
    ok: true,
    text: completion.text,
    model: completion.model ?? model,
    ms: Date.now() - started,
  });
}

/**
 * `overrides` carries the project's `.env` files; a variable the shell already
 * set wins, so a one-off `DEEPSEEK_MODEL=… npm run dev` behaves as expected and
 * a `.env.local` cannot silently redirect a test that sets its own value.
 */
export function aiMiddleware(overrides: Env = {}): Plugin {
  const env: Env = { ...overrides, ...process.env };

  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    handleAiRequest(req, res, env).catch(() => {
      if (res.headersSent) {
        res.end();
        return;
      }
      sendJson(res, 500, failure('upstream', 'The AI endpoint failed while answering.', true));
    });
  };

  return {
    name: 'thylas-ai-endpoint',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(AI_PATH, handler);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(AI_PATH, handler);
    },
  };
}
