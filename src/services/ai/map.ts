import { failure, isAiBody } from '../../lib/ai';
import type { AskResult } from './types';

/**
 * The only place a response body becomes an `Answer`. Anything that does not
 * match the contract — an HTML error page from a proxy, a field of the wrong
 * type, a `kind` this build does not know — becomes one `contract` failure. The
 * UI never sees a raw body, so it cannot accidentally render `undefined`.
 */
export function toAnswer(body: unknown): AskResult {
  if (!isAiBody(body)) {
    return {
      ok: false,
      error: failure('contract', 'The endpoint answered with a body this client cannot read.'),
    };
  }
  if (!body.ok) return { ok: false, error: body };
  return {
    ok: true,
    answer: { text: body.text, model: body.model, provider: body.provider, ms: body.ms },
  };
}
