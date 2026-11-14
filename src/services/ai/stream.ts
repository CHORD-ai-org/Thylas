import {
  AI_MAX_HISTORY,
  AI_MAX_HISTORY_ITEM,
  AI_MAX_PROMPT,
  AI_STREAM_PATH,
  failure,
  type AiErr,
  type AiHistoryItem,
  type AiSelection,
} from '../../lib/ai';

/**
 * The client half of `POST /api/ai/stream` (D-051). Sends a prompt plus prior
 * turns, reads SSE incrementally, and never throws: every failure is a value,
 * and a partial answer is reported as a partial answer, not as an error.
 */
export type StreamResult =
  | { ok: true; text: string; model: string; provider?: string; ms: number; stopped: boolean }
  | { ok: false; text: string; error: AiErr; stopped: boolean };

export function historyFor(
  messages: { role: 'user' | 'assistant'; text: string }[],
  limit = AI_MAX_HISTORY,
): AiHistoryItem[] {
  return messages
    .slice(-limit)
    .map((m) => ({ role: m.role, content: m.text.slice(0, AI_MAX_HISTORY_ITEM) }));
}

export async function streamChat(
  prompt: string,
  history: AiHistoryItem[],
  signal: AbortSignal | undefined,
  onDelta: (chunk: string) => void,
  selection?: AiSelection | null,
): Promise<StreamResult> {
  const stopped = () => signal?.aborted ?? false;

  if (prompt.trim().length > AI_MAX_PROMPT) {
    return {
      ok: false,
      text: '',
      stopped: false,
      error: failure('contract', `The question is ${prompt.trim().length} characters; the limit is ${AI_MAX_PROMPT}.`),
    };
  }

  let res: Response;
  try {
    res = await fetch(AI_STREAM_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt,
        history,
        ...(selection ? { provider: selection.provider, model: selection.model } : {}),
      }),
      signal,
    });
  } catch {
    /* An aborted request is the caller's own stop; anything else is the wire. */
    if (stopped()) return { ok: true, text: '', model: '', ms: 0, stopped: true };
    return {
      ok: false,
      text: '',
      stopped: false,
      error: failure('network', 'The endpoint did not answer. Is the dev server running?', true),
    };
  }

  if (!res.ok || !res.body) {
    /* A pre-stream failure is a normal JSON body with the shared contract. */
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* fall through to the generic message */
    }
    if (
      body && typeof body === 'object' && (body as { ok?: unknown }).ok === false &&
      typeof (body as { kind?: unknown }).kind === 'string'
    ) {
      const err = body as { kind: string; message?: unknown; retryable?: unknown };
      return {
        ok: false,
        text: '',
        stopped: false,
        error: failure(
          err.kind as AiErr['kind'],
          typeof err.message === 'string' ? err.message : `The endpoint answered ${res.status}.`,
          err.retryable === true,
        ),
      };
    }
    return {
      ok: false,
      text: '',
      stopped: false,
      error: failure('upstream', `The endpoint answered ${res.status} without a typed body.`, true),
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let model = '';
  let ms = 0;
  let error: AiErr | null = null;
  const streamStart = Date.now();
  /* The server states the effective selection in headers, so the label does
     not have to be guessed from the stream bytes. */
  const provider = res.headers.get('x-thylas-provider') ?? '';
  const headerModel = res.headers.get('x-thylas-model') ?? '';

  /* The stream is the model's own OpenAI-format SSE, piped through. */
  const handleEvent = (raw: string): 'done' | null => {
    if (raw === '[DONE]') {
      ms = Date.now() - streamStart;
      return 'done';
    }
    try {
      const chunk = JSON.parse(raw) as {
        model?: string;
        error?: { message?: string };
        choices?: { delta?: { content?: string } }[];
      };
      /* A provider that fails mid-stream says so in a frame; the text so far
         still stands, but the answer is not a success. */
      if (chunk.error && typeof chunk.error.message === 'string') {
        error = failure('upstream', chunk.error.message, true);
        return 'done';
      }
      if (typeof chunk.model === 'string' && model === '') model = chunk.model;
      const delta = chunk.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta !== '') {
        text += delta;
        onDelta(delta);
      }
    } catch {
      /* A keep-alive or unparseable line is skipped, not fatal. */
    }
    return null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line.startsWith('data:')) continue;
        if (handleEvent(line.slice(5).trim()) === 'done') {
          buffer = '';
        }
      }
    }
  } catch {
    /* Reader failure mid-stream: the text so far stands, marked by the caller
       via the stopped flag below or as an upstream error if the client did not
       abort. */
    if (!stopped()) {
      error = failure('upstream', 'The stream ended unexpectedly.', true);
    }
  }

  /* The label follows the server's effective selection: the header states the
     model that was called, the stream only states what the provider echoed. */
  const effectiveModel = headerModel || model;

  if (stopped()) {
    /* A stop is not a failure: the partial answer is the result. */
    return { ok: true, text, model: effectiveModel, provider: provider || undefined, ms, stopped: true };
  }
  if (error) return { ok: false, text, error, stopped: false };
  if (text === '' && effectiveModel === '') {
    return { ok: false, text: '', error: failure('upstream', 'The endpoint answered with nothing.', true), stopped: false };
  }
  return { ok: true, text, model: effectiveModel, provider: provider || undefined, ms, stopped: false };
}
