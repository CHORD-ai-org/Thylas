/**
 * The wire contract for `POST /api/ai`, owned by neither side so a change on one
 * side breaks the other at compile time (D-006).
 *
 * Why the kinds are this specific: each one asks the reader to do a different
 * thing. `not_configured` is fixed by adding a key, `unauthorized` by fixing the
 * key, `rate_limited` by waiting, `timeout`/`network` by trying again, and
 * `contract` by sending a different request. A single "request failed" would
 * collapse six different actions into one shrug.
 */

export const AI_PATH = '/api/ai';

/**
 * A read-only answer to "is this endpoint able to work at all". It exists
 * because the alternative is worse: either the send control is always enabled
 * and every reader learns about a missing key by failing, or the browser is
 * told something about the key. This says `configured: true|false` and nothing
 * else — no key, no length, no prefix.
 */
export const AI_STATUS_PATH = '/api/ai/status';

export type AiStatusBody = { configured: boolean; model: string };

/** Characters, not bytes: this is the number the answer's message states. */
export const AI_MAX_PROMPT = 8000;

/** Upstream budget. A completion past 30 s reads as broken, not slow. */
export const AI_TIMEOUT_MS = 30_000;

export type AiErrorKind =
  /** No key on the server. Nothing was sent upstream. */
  | 'not_configured'
  /** Upstream rejected the key (401/403). Retrying keeps it rejected. */
  | 'unauthorized'
  /** Upstream quota (429). Waiting helps. */
  | 'rate_limited'
  /** No answer inside AI_TIMEOUT_MS. */
  | 'timeout'
  /** The request never reached upstream: DNS, TLS, refused, offline. */
  | 'network'
  /** Upstream answered with a status or a shape we cannot use. */
  | 'upstream'
  /** The request or the reply did not match this contract. */
  | 'contract';

export type AiOk = { ok: true; text: string; model: string; ms: number };

export type AiErr = {
  ok: false;
  kind: AiErrorKind;
  message: string;
  retryable: boolean;
};

export type AiBody = AiOk | AiErr;

/** Retry is only honest when a second attempt can plausibly end differently. */
const RETRYABLE: Record<AiErrorKind, boolean> = {
  not_configured: false,
  unauthorized: false,
  rate_limited: true,
  timeout: true,
  network: true,
  upstream: true,
  contract: false,
};

export function failure(kind: AiErrorKind, message: string, retryable = RETRYABLE[kind]): AiErr {
  return { ok: false, kind, message, retryable };
}

/**
 * HTTP status for a failure. Only `contract` is a 4xx, because only `contract`
 * is the caller's request being wrong. Everything else happened behind the
 * endpoint, so the caller gets a gateway error rather than a status implying it
 * sent something bad.
 */
export function statusFor(kind: AiErrorKind): number {
  switch (kind) {
    case 'not_configured':
      return 503;
    case 'contract':
      return 400;
    case 'rate_limited':
      return 429;
    case 'timeout':
      return 504;
    default:
      return 502;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const KINDS: readonly AiErrorKind[] = [
  'not_configured',
  'unauthorized',
  'rate_limited',
  'timeout',
  'network',
  'upstream',
  'contract',
];

export function isAiErrorKind(value: unknown): value is AiErrorKind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value);
}

export function isAiStatusBody(value: unknown): value is AiStatusBody {
  return (
    isRecord(value) &&
    typeof value.configured === 'boolean' &&
    typeof value.model === 'string' &&
    value.model !== ''
  );
}

/** Shape check, not a schema: enough that the client never renders a raw body. */
export function isAiBody(value: unknown): value is AiBody {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false;
  if (value.ok) {
    return (
      typeof value.text === 'string' &&
      typeof value.model === 'string' &&
      typeof value.ms === 'number' &&
      Number.isFinite(value.ms)
    );
  }
  return (
    isAiErrorKind(value.kind) &&
    typeof value.message === 'string' &&
    typeof value.retryable === 'boolean'
  );
}

/**
 * Pull a completion out of an OpenAI-shaped reply. Returns null for anything
 * else — an empty `content`, a missing `choices`, an HTML error page parsed as
 * JSON — so the caller reports one honest failure instead of rendering `undefined`.
 */
export function readCompletion(payload: unknown): { text: string; model: string | null } | null {
  if (!isRecord(payload)) return null;
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first: unknown = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return null;
  const content = first.message.content;
  if (typeof content !== 'string' || content.trim() === '') return null;
  return { text: content, model: typeof payload.model === 'string' ? payload.model : null };
}
