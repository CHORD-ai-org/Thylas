/// <reference types="node" />
/**
 * The only implementation of the three `/api/ai*` endpoints (D-055, P1-1).
 *
 * Pure `node:http`: no Vite import, no framework. Both `ai.ts` (the Vite plugin)
 * and `index.ts` (the standalone host) mount these same handlers, so a fix here
 * reaches dev, preview and the deployable process at once.
 *
 * The browser cannot hold the key (D-006); it sees a typed body instead of an
 * upstream one. Nothing here is production-shaped on purpose: no retries, no
 * queue, no WAM.
 */
import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  AI_MAX_HISTORY,
  AI_MAX_HISTORY_ITEM,
  AI_MAX_PROMPT,
  AI_PATH,
  AI_STATUS_PATH,
  AI_STREAM_PATH,
  failure,
  isAiHistory,
  readCompletion,
  statusFor,
  type AiBody,
  type AiErrorKind,
  type AiHistoryItem,
  type AiStatusBody,
} from '../src/lib/ai.ts';
import { CONFIG_ERROR_NOT_CONFIGURED, type ServerConfig } from './config.ts';

/**
 * 8000 characters is at most ~32 KB of UTF-8. The wire cap is what stops a
 * caller from streaming a gigabyte into memory before the character check runs.
 */
const MAX_BODY_BYTES = 64 * 1024;

/** The key never enters a log line and never reaches the client. */
function scrub(text: string, key: string): string {
  return key ? text.split(key).join('***') : text;
}

function sendJson(res: ServerResponse, status: number, body: AiBody): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(payload));
  res.setHeader('cache-control', 'no-store');
  res.end(payload);
}

/**
 * Resolves with the body, or with `null` when it exceeded MAX_BODY_BYTES. It
 * keeps draining past the cap so the response can still be written: destroying
 * the socket mid-upload turns a readable 413 into a reset connection.
 */
function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    let size = 0;
    let tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        /* Keep reading and discard: a caller that keeps sending cannot hold the
           process, and the refusal below is still delivered. */
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(tooLarge ? null : chunks.join('')));
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

/** The contract's only input. Anything else in the body is ignored, not echoed. */
function promptFrom(parsed: unknown): string {
  if (typeof parsed !== 'object' || parsed === null) return '';
  const value = (parsed as { prompt?: unknown }).prompt;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * An upstream error body is JSON, and pasting `{"error":{"message":"…"}}` into a
 * banner is noise. Take the sentence if there is one, keep the rest as-is.
 */
function readableDetail(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as { error?: { message?: unknown } };
    const message = parsed.error?.message;
    if (typeof message === 'string' && message.trim() !== '') return message.trim();
  } catch {
    /* not JSON after all */
  }
  return trimmed;
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
  config: ServerConfig,
): Promise<void> {
  if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
    res.setHeader('allow', 'POST');
    sendJson(res, 405, failure('contract', 'POST only.'));
    return;
  }

  const { apiKey: key, baseUrl, model, timeoutMs } = config;
  if (!key) {
    /* A missing key is configuration, not a broken network. Say which variable
       is missing, and do not reach upstream at all. */
    sendJson(res, statusFor('not_configured'), failure('not_configured', CONFIG_ERROR_NOT_CONFIGURED));
    return;
  }

  let raw: string | null;
  try {
    raw = await readBody(req);
  } catch {
    sendJson(res, 400, failure('contract', 'The request body could not be read.'));
    return;
  }
  if (raw === null) {
    sendJson(
      res,
      statusFor('contract'),
      failure(
        'contract',
        `The request body is over ${MAX_BODY_BYTES / 1024} KB. A prompt is capped at ${AI_MAX_PROMPT} characters.`,
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

  const prompt = promptFrom(parsed);

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

  const base = baseUrl;
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
    const detail = scrub(readableDetail(await safeText(upstream)), key);
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
 * The streaming sibling (D-051). Same checks as `handleAiRequest` — key, body,
 * prompt cap — then `stream: true` upstream, piped through byte-for-byte. The
 * client reads the model's own OpenAI SSE (`data: {choices:[…]}` …
 * `data: [DONE]`); nothing is re-framed between the two. An error before
 * upstream headers is a JSON failure with the same kinds.
 *
 * History arrives as prior turns, capped by the contract; the caller's prompt
 * is the last user message. The key never reaches the client.
 */
export async function handleAiStreamRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig,
): Promise<void> {
  const failJson = (kind: AiErrorKind, message: string, retryable?: boolean): void => {
    sendJson(res, statusFor(kind), failure(kind, message, retryable));
  };

  if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
    res.setHeader('allow', 'POST');
    failJson('contract', 'POST only.');
    return;
  }

  const { apiKey: key, baseUrl: base, model, timeoutMs } = config;
  if (!key) {
    failJson('not_configured', CONFIG_ERROR_NOT_CONFIGURED);
    return;
  }

  let raw: string | null;
  try {
    raw = await readBody(req);
  } catch {
    failJson('contract', 'The request body could not be read.');
    return;
  }
  if (raw === null) {
    failJson('contract', `The request body is over ${MAX_BODY_BYTES / 1024} KB.`);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    failJson('contract', 'The request body is not JSON.');
    return;
  }

  const record = (parsed ?? {}) as { prompt?: unknown; history?: unknown };
  const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
  if (!prompt) {
    failJson('contract', 'The request needs a non-empty "prompt" string.');
    return;
  }
  if (prompt.length > AI_MAX_PROMPT) {
    failJson('contract', `The prompt is ${prompt.length} characters; the limit is ${AI_MAX_PROMPT}.`);
    return;
  }
  const historyRaw: AiHistoryItem[] = isAiHistory(record.history) ? record.history : [];
  /* The contract caps both; the server enforces it again rather than trusting
     the caller's client. Oldest turns are the ones dropped. */
  const history: AiHistoryItem[] = historyRaw.slice(-AI_MAX_HISTORY).map((h) => ({
    role: h.role,
    content: h.content.slice(0, AI_MAX_HISTORY_ITEM),
  }));

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: prompt },
  ];

  const upstreamController = new AbortController();
  /* A client that walks away takes the upstream request with it. `req`'s own
     'close' fires the moment its body is fully read — it says nothing about
     the connection — so the response is the thing watched here. */
  res.on('close', () => {
    if (!res.writableEnded) upstreamController.abort();
  });

  /* The raw node:http client, deliberately not fetch: the upstream SSE is
     piped through byte-for-byte — no response re-framing, no connection-pool
     reuse between the model and the browser. An error before upstream headers
     is a JSON failure with the shared kinds; after that, the upstream stream
     is exactly what the client reads (OpenAI-format chunks, then [DONE]). */
  const up = httpRequest(
    `${base}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
        accept: 'text/event-stream',
      },
    },
    (upRes) => {
      const status = upRes.statusCode ?? 0;
      if (status !== 200) {
        let body = '';
        upRes.setEncoding('utf8');
        upRes.on('data', (c) => (body += c));
        upRes.on('end', () => {
          const kind: AiErrorKind =
            status === 401 || status === 403
              ? 'unauthorized'
              : status === 429
                ? 'rate_limited'
                : 'upstream';
          const retryable = kind === 'rate_limited' || status === 408 || status >= 500;
          failJson(kind, upstreamMessage(kind, status, scrub(readableDetail(body.trim()), key)), retryable);
        });
        return;
      }
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.flushHeaders?.();
      upRes.pipe(res);
      upRes.on('end', () => res.end());
    },
  );
  upstreamController.signal.addEventListener('abort', () => up.destroy());
  const upstreamTimer = setTimeout(() => {
    up.destroy(new Error('timeout'));
  }, timeoutMs);
  up.on('close', () => clearTimeout(upstreamTimer));
  up.on('error', (err) => {
    if (upstreamController.signal.aborted) return;
    if (err.message === 'timeout') {
      failJson('timeout', `No answer within ${Math.round(timeoutMs / 1000)} s.`, true);
      return;
    }
    failJson(
      'network',
      `Could not reach ${base}. The machine may be offline or the host unreachable.`,
      true,
    );
  });
  up.end(JSON.stringify({ model, messages, stream: true }));
}

export type AiHandlers = {
  status: (req: IncomingMessage, res: ServerResponse) => void;
  completion: (req: IncomingMessage, res: ServerResponse) => void;
  stream: (req: IncomingMessage, res: ServerResponse) => void;
};

/** One set of handlers per process, shared by the Vite plugin and the host. */
export function createAiHandlers(config: ServerConfig): AiHandlers {
  /* Answers "can this endpoint work" without a request to the model and without
     saying anything about the key beyond whether it exists (SP-07b). */
  const status = (req: IncomingMessage, res: ServerResponse): void => {
    if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
      res.setHeader('allow', 'GET');
      sendJson(res, 405, failure('contract', 'GET only.'));
      return;
    }
    const body: AiStatusBody = {
      configured: config.apiKey !== '',
      model: config.model,
    };
    const payload = JSON.stringify(body);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('content-length', Buffer.byteLength(payload));
    res.setHeader('cache-control', 'no-store');
    res.end(payload);
  };

  const completion = (req: IncomingMessage, res: ServerResponse): void => {
    handleAiRequest(req, res, config).catch(() => {
      if (res.headersSent) {
        res.end();
        return;
      }
      sendJson(res, 500, failure('upstream', 'The AI endpoint failed while answering.', true));
    });
  };

  const stream = (req: IncomingMessage, res: ServerResponse): void => {
    handleAiStreamRequest(req, res, config).catch(() => {
      if (res.headersSent) {
        res.end();
        return;
      }
      sendJson(res, 500, failure('upstream', 'The AI stream endpoint failed before answering.', true));
    });
  };

  return { status, completion, stream };
}

/**
 * Routes by exact path for the standalone host. The Vite plugin does not need
 * this: Connect's `use(path, fn)` already splits the three mounts.
 */
export function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  handlers: AiHandlers,
): void {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (path === AI_STATUS_PATH) {
    handlers.status(req, res);
    return;
  }
  if (path === AI_STREAM_PATH) {
    handlers.stream(req, res);
    return;
  }
  if (path === AI_PATH) {
    handlers.completion(req, res);
    return;
  }
  sendJson(res, 404, failure('contract', 'Unknown API path.'));
}
