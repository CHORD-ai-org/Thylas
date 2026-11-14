import type { AiErr } from '../../lib/ai';

/**
 * Re-exported rather than redefined: the middleware imports the same module, so
 * a field added on one side is a compile error on the other.
 */
export type { AiBody, AiErr, AiErrorKind, AiOk } from '../../lib/ai';

/** What the UI receives. Wire fields stop here. */
export type Answer = {
  text: string;
  model: string;
  /** The provider that answered, when the server named one. */
  provider?: string;
  ms: number;
};

export type AskResult = { ok: true; answer: Answer } | { ok: false; error: AiErr };
