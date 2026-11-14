/**
 * The Anthropic adapter: `POST {base}/v1/messages`, `x-api-key` +
 * `anthropic-version`, a mandatory `max_tokens`, and an event stream of its
 * own (`message_start` / `content_block_delta` / `message_stop`).
 *
 * Two conversions happen here, and nowhere else (D-062):
 *
 * 1. the request — roles are merged so they alternate, and the model's reply
 *    is re-shaped into the OpenAI completion the shared contract already
 *    understands;
 * 2. the stream — Anthropic's events are re-framed into OpenAI SSE
 *    (`choices[0].delta.content`), so the browser keeps parsing one shape
 *    whatever provider answered.
 *
 * The OpenAI-compatible providers keep the byte-for-byte passthrough; only
 * Anthropic pays for a translation, and only in the server.
 */
import type { ProviderConfig } from '../../config.ts';
import type { ChatMessage, UpstreamRequest } from './types.ts';

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;

type AnthropicMessage = { role: 'user' | 'assistant'; content: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Anthropic requires alternating roles and a first message from the user.
 * Our history can carry two turns of the same role (or start with the
 * assistant), so same-role neighbours are merged and leading assistant turns
 * are dropped. The prompt is always a user message, so the list never ends
 * empty.
 */
export function toAnthropicMessages(messages: ChatMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (const message of messages) {
    const last = out[out.length - 1];
    if (last && last.role === message.role) {
      last.content = `${last.content}\n\n${message.content}`;
      continue;
    }
    out.push({ role: message.role, content: message.content });
  }
  while (out.length > 0 && out[0]?.role !== 'user') out.shift();
  return out;
}

export function buildAnthropicRequest(
  provider: ProviderConfig,
  model: string,
  messages: ChatMessage[],
  stream: boolean,
): UpstreamRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': provider.apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
  };
  if (stream) headers.accept = 'text/event-stream';

  const maxTokens = provider.maxTokens > 0 ? provider.maxTokens : DEFAULT_MAX_TOKENS;

  return {
    url: `${provider.baseUrl}/v1/messages`,
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: toAnthropicMessages(messages),
      stream,
    }),
  };
}

/**
 * An Anthropic reply becomes the OpenAI completion shape the shared contract
 * already parses, so the client and the error taxonomy stay untouched.
 */
export function toOpenAiCompletion(payload: unknown): unknown {
  if (!isRecord(payload) || !Array.isArray(payload.content)) return payload;
  const text = payload.content
    .filter((block): block is Record<string, unknown> => isRecord(block))
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('');
  return {
    model: typeof payload.model === 'string' ? payload.model : undefined,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
  };
}

export type AnthropicNormalizer = {
  /** Feed raw upstream text; get back the OpenAI SSE to send to the browser. */
  push(chunk: string): string;
  /** The tail of the stream, including the terminating `[DONE]`. */
  flush(): string;
};

/**
 * Re-frame Anthropic's event stream as OpenAI SSE. Non-text blocks (thinking,
 * tool use) are ignored rather than guessed at; an upstream error becomes an
 * error frame instead of a silent empty answer.
 */
export function createAnthropicNormalizer(model: string): AnthropicNormalizer {
  let buffer = '';
  let currentModel = model;
  let done = false;

  const frame = (delta: Record<string, unknown>, finish: string | null): string =>
    `data: ${JSON.stringify({
      model: currentModel,
      choices: [{ index: 0, delta, finish_reason: finish }],
    })}\n\n`;

  const handle = (data: string): string => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return '';
    }
    if (!isRecord(parsed)) return '';

    if (parsed.type === 'message_start') {
      const message = parsed.message;
      if (isRecord(message) && typeof message.model === 'string' && message.model !== '') {
        currentModel = message.model;
      }
      return frame({ role: 'assistant' }, null);
    }

    if (parsed.type === 'content_block_delta') {
      const delta = parsed.delta;
      if (
        isRecord(delta) &&
        delta.type === 'text_delta' &&
        typeof delta.text === 'string' &&
        delta.text !== ''
      ) {
        return frame({ content: delta.text }, null);
      }
      return '';
    }

    if (parsed.type === 'message_delta') {
      const delta = parsed.delta;
      const reason = isRecord(delta) && typeof delta.stop_reason === 'string' ? delta.stop_reason : null;
      const finish = reason === 'max_tokens' ? 'length' : reason === 'tool_use' ? 'tool_calls' : 'stop';
      return frame({}, finish);
    }

    if (parsed.type === 'message_stop') {
      done = true;
      return 'data: [DONE]\n\n';
    }

    if (parsed.type === 'error') {
      const error = parsed.error;
      const message =
        isRecord(error) && typeof error.message === 'string'
          ? error.message
          : 'The provider reported an error mid-stream.';
      done = true;
      return `data: ${JSON.stringify({ error: { message } })}\n\ndata: [DONE]\n\n`;
    }

    return '';
  };

  return {
    push(text: string): string {
      buffer += text;
      let out = '';
      let index: number;
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line.startsWith('data:')) continue;
        out += handle(line.slice(5).trim());
      }
      return out;
    },
    flush(): string {
      let out = '';
      const rest = buffer.trim();
      buffer = '';
      if (rest.startsWith('data:')) out += handle(rest.slice(5).trim());
      if (!done) out += 'data: [DONE]\n\n';
      return out;
    },
  };
}
