/// <reference types="node" />
/**
 * The only implementation of the three `/api/ai*` endpoints (D-055, P1-1).
 *
 * Pure `node:http`: no Vite import, no framework. Both `ai.ts` (the Vite plugin)
 * and `index.ts` (the standalone host) mount these same handlers, so a fix here
 * reaches dev, preview and the deployable process at once.
 *
 * The browser cannot hold the key (D-006); it sees a typed body instead of an
 * upstream one. Since D-061 the handler resolves the request against the
 * provider catalog first: the browser may name a provider and a model, never
 * an endpoint. Nothing here is production-shaped on purpose: no retries, no
 * queue, no WAM.
 */
import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  AI_MAX_HISTORY,
  AI_MAX_HISTORY_ITEM,
  AI_MAX_PROMPT,
  failure,
  isAiHistory,
  readCompletion,
  statusFor,
  type AiErrorKind,
  type AiHistoryItem,
  type AiStatusBody,
} from '../src/lib/ai.ts';
import { type ProviderConfig, type ServerConfig } from './config.ts';
import { MAX_BODY_BYTES, readBody, sendJson } from './http.ts';
import { providerSummaries, resolveProvider } from './ai/providers/catalog.ts';
import { buildOpenAiRequest } from './ai/providers/openai-compatible.ts';
import {
  buildAnthropicRequest,
  createAnthropicNormalizer,
  toOpenAiCompletion,
} from './ai/providers/anthropic.ts';
import type { ChatMessage, UpstreamRequest } from './ai/providers/types.ts';

/** The key never enters a log line and never reaches the client. */
function scrub(text: string, keys: string[]): string {
  let out = text;
  for (const key of keys) {
    if (key) out = out.split(key).join('***');
  }
  return out;
}

function secretKeys(config: ServerConfig): string[] {
  return config.providers.map((p) => p.apiKey).filter((key) => key !== '');
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

/** The optional provider and model, read without trusting either. */
function selectionFrom(parsed: unknown): { provider?: string; model?: string } {
  if (typeof parsed !== 'object' || parsed === null) return {};
  const raw = parsed as { provider?: unknown; model?: unknown };
  return {
    provider: typeof raw.provider === 'string' ? raw.provider : undefined,
    model: typeof raw.model === 'string' ? raw.model : undefined,
  };
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

function upstreamMessage(kind: AiErrorKind, status: number, detail: string, provider: ProviderConfig): string {
  const tail = detail ? ` — ${detail.slice(0, 200)}` : '';
  if (kind === 'unauthorized') {
    return `The model rejected the ${provider.label} key (${status}). Check ${provider.keyEnv}.${tail}`;
  }
  if (kind === 'rate_limited') {
    return `The model is rate limiting this ${provider.label} key (${status}). Wait, then retry.${tail}`;
  }
  return `The model answered ${status}.${tail}`;
}

/** One call shape per provider family; the adapter owns the difference. */
function buildRequest(
  provider: ProviderConfig,
  model: string,
  messages: ChatMessage[],
  stream: boolean,
): UpstreamRequest {
  return provider.id === 'anthropic'
    ? buildAnthropicRequest(provider, model, messages, stream)
    : buildOpenAiRequest(provider, model, messages, stream);
}

/** Anthropic's reply is re-shaped before the shared reader sees it. */
function completionPayload(provider: ProviderConfig, payload: unknown): unknown {
  return provider.id === 'anthropic' ? toOpenAiCompletion(payload) : payload;
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

  /* The provider is resolved before the prompt is judged: a server with no key
     for the requested provider says so, whatever the prompt looks like. */
  const resolved = resolveProvider(config, selectionFrom(parsed));
  if (!resolved.ok) {
    sendJson(res, statusFor(resolved.kind), failure(resolved.kind, resolved.message));
    return;
  }
  const { provider, model } = resolved.choice;

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

  const upstreamRequest = buildRequest(provider, model, [{ role: 'user', content: prompt }], false);
  const started = Date.now();

  let upstream: Response;
  try {
    upstream = await fetch(upstreamRequest.url, {
      method: 'POST',
      headers: upstreamRequest.headers,
      body: upstreamRequest.body,
      signal: AbortSignal.timeout(provider.timeoutMs),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const timedOut = name === 'TimeoutError' || name === 'AbortError';
    sendJson(
      res,
      statusFor(timedOut ? 'timeout' : 'network'),
      timedOut
        ? failure('timeout', `No answer within ${Math.round(provider.timeoutMs / 1000)} s.`, true)
        : failure(
            'network',
            `Could not reach ${provider.baseUrl}. The machine may be offline or the host unreachable.`,
            true,
          ),
    );
    return;
  }

  if (!upstream.ok) {
    const detail = scrub(readableDetail(await safeText(upstream)), secretKeys(config));
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
      failure(kind, upstreamMessage(kind, upstream.status, detail, provider), retryable),
    );
    return;
  }

  const completion = readCompletion(completionPayload(provider, await safeJson(upstream)));
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
    /* The model that was asked for, not the one the provider echoed back: the
       label the interface shows must be the one in the picker. The provider
       is named beside it. */
    model,
    provider: provider.id,
    ms: Date.now() - started,
  });
}

/**
 * The streaming sibling (D-051). Same checks as `handleAiRequest` — provider,
 * body, prompt cap — then `stream: true` upstream. For an OpenAI-compatible
 * provider the upstream bytes are piped through unchanged; Anthropic's own
 * event stream is re-framed into OpenAI SSE on the way out (D-062), so the
 * client keeps parsing one shape whatever provider answered.
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

  const resolved = resolveProvider(config, selectionFrom(parsed));
  if (!resolved.ok) {
    failJson(resolved.kind, resolved.message);
    return;
  }
  const { provider, model } = resolved.choice;

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

  const messages: ChatMessage[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: prompt },
  ];

  const upstreamRequest = buildRequest(provider, model, messages, true);

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
    upstreamRequest.url,
    {
      method: 'POST',
      headers: upstreamRequest.headers,
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
          failJson(
            kind,
            upstreamMessage(kind, status, scrub(readableDetail(body.trim()), secretKeys(config)), provider),
            retryable,
          );
        });
        return;
      }
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        /* The effective selection travels in headers, so the interface can
           label the answer without the stream bytes carrying anything extra. */
        'x-thylas-provider': provider.id,
        'x-thylas-model': model,
      });
      res.flushHeaders?.();
      if (provider.id === 'anthropic') {
        /* Anthropic speaks its own event stream; the normalizer re-frames it
           into the OpenAI SSE the client already parses. */
        const normalizer = createAnthropicNormalizer(model);
        upRes.setEncoding('utf8');
        upRes.on('data', (chunk) => {
          const out = normalizer.push(String(chunk));
          if (out) res.write(out);
        });
        upRes.on('end', () => {
          const out = normalizer.flush();
          if (out) res.write(out);
          res.end();
        });
        return;
      }
      upRes.pipe(res);
      upRes.on('end', () => res.end());
    },
  );
  upstreamController.signal.addEventListener('abort', () => up.destroy());
  const upstreamTimer = setTimeout(() => {
    up.destroy(new Error('timeout'));
  }, provider.timeoutMs);
  up.on('close', () => clearTimeout(upstreamTimer));
  up.on('error', (err) => {
    if (upstreamController.signal.aborted) return;
    if (err.message === 'timeout') {
      failJson('timeout', `No answer within ${Math.round(provider.timeoutMs / 1000)} s.`, true);
      return;
    }
    failJson(
      'network',
      `Could not reach ${provider.baseUrl}. The machine may be offline or the host unreachable.`,
      true,
    );
  });
  up.end(upstreamRequest.body);
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
      configured: config.providers.some((p) => p.apiKey !== ''),
      model: config.defaultModel,
      default: { provider: config.defaultProvider, model: config.defaultModel },
      providers: providerSummaries(config),
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

/* Routing lives in `router.ts` (P1-4); this module only implements the AI endpoints. */
