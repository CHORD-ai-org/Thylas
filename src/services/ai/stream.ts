import {
  AI_MAX_HISTORY,
  AI_MAX_HISTORY_ITEM,
  AI_MAX_PROMPT,
  AI_STREAM_PATH,
  failure,
  type AiErr,
  type AiHistoryItem,
} from '../../lib/ai';

/**
 * The client half of `POST /api/ai/stream` (D-051). Sends a prompt plus prior
 * turns, reads SSE incrementally, and never throws: every failure is a value,
 * and a partial answer is reported as a partial answer, not as an error.
 */
export type StreamResult =
  | { ok: true; text: string; model: string; ms: number; stopped: boolean }
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
      body: JSON.stringify({ prompt, history }),
      signal,
    });
  } catch (err) {
    console.log('STREAMCATCH', String(err));
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

  const dbg = (m: string, v: unknown) => {
    (globalThis as { __streamDbg?: unknown[] }).__streamDbg?.push(m + ':' + String(v).slice(0, 40));
  };
  dbg('open', res.status);
  const handleEvent = (raw: string): 'done' | null => {
    dbg('line', raw);
    if (raw === '[DONE]') return 'done';
    try {
      const event = JSON.parse(raw) as Record<string, unknown>;
      if (typeof event.delta === 'string') {
        text += event.delta;
        onDelta(event.delta);
      } else if (event.start === true && typeof event.model === 'string') {
        model = event.model;
      } else if (event.done === true) {
        if (typeof event.model === 'string') model = event.model;
        if (typeof event.ms === 'number') ms = event.ms;
        return 'done';
      } else if (event.error && typeof event.error === 'object') {
        const err = event.error as { kind?: unknown; message?: unknown; retryable?: unknown };
        error = failure(
          typeof err.kind === 'string' ? (err.kind as AiErr['kind']) : 'upstream',
          typeof err.message === 'string' ? err.message : 'The stream failed.',
          err.retryable === true,
        );
        return 'done';
      }
    } catch {
      /* An unparseable line is skipped, not fatal. */
    }
    return null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      dbg('chunk', value ? value.length : 'null');
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

  if (stopped()) {
    /* A stop is not a failure: the partial answer is the result. */
    return { ok: true, text, model, ms, stopped: true };
  }
  if (error) return { ok: false, text, error, stopped: false };
  if (text === '' && model === '') {
    return { ok: false, text: '', error: failure('upstream', 'The endpoint answered with nothing.', true), stopped: false };
  }
  return { ok: true, text, model, ms, stopped: false };
}
