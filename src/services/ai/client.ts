import { AI_MAX_PROMPT, AI_PATH, failure } from '../../lib/ai';
import { toAnswer } from './map';
import type { AskResult } from './types';

/**
 * The client half of `POST /api/ai` (D-006). It sends a prompt and returns a
 * typed result; it never reads a key, never sees an upstream URL, and never
 * throws — every failure is a value the UI can render with a retry decision.
 */
export async function ask(prompt: string, signal?: AbortSignal): Promise<AskResult> {
  /* Refused here rather than at the server so the reader is not charged a round
     trip for a request that cannot succeed. The same numbers, one message. */
  if (prompt.trim().length > AI_MAX_PROMPT) {
    return {
      ok: false,
      error: failure(
        'contract',
        `The question is ${prompt.trim().length} characters; the limit is ${AI_MAX_PROMPT}.`,
      ),
    };
  }

  let res: Response;
  try {
    res = await fetch(AI_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal,
    });
  } catch {
    /* fetch rejects for an aborted request as well as for an unreachable host;
       the caller that aborted does not need a message, so it is not distinguished. */
    return {
      ok: false,
      error: failure('network', 'The endpoint did not answer. Is the dev server running?', true),
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return {
      ok: false,
      error: res.ok
        ? failure('contract', 'The endpoint answered with something that is not JSON.')
        : failure('upstream', `The endpoint answered ${res.status} without a typed body.`, true),
    };
  }

  return toAnswer(body);
}
