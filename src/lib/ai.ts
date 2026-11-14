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
 * The streaming sibling (D-051). Same middleware, same key handling, same error
 * kinds — a separate path so `/api/ai` (and the single-turn Ask panel on it)
 * keeps its contract untouched. The 200 response is the model's own
 * OpenAI-format SSE (`data: {choices:[…]}` … `data: [DONE]`), piped through
 * byte-for-byte; the client parses that shape directly. Failures before the
 * stream starts are JSON bodies in the shared AiErr shape.
 */
export const AI_STREAM_PATH = '/api/ai/stream';

/** History turns the client may send and the server will accept per request. */
export const AI_MAX_HISTORY = 12;
/** Per-message cap inside history: a pasted file is context, not a prompt. */
export const AI_MAX_HISTORY_ITEM = 4000;

/**
 * A read-only answer to "is this endpoint able to work at all". It exists
 * because the alternative is worse: either the send control is always enabled
 * and every reader learns about a missing key by failing, or the browser is
 * told something about the key. This says `configured: true|false` and nothing
 * else — no key, no length, no prefix.
 */
export const AI_STATUS_PATH = '/api/ai/status';

export type AiProviderSummary = {
  id: string;
  label: string;
  /** The models this provider may serve — the allowlist, not the full catalogue. */
  models: string[];
  /** Whether the server holds a key for it. Never the key itself. */
  configured: boolean;
};

/** A named pair: which provider, which model of it. */
export type AiSelection = { provider: string; model: string };

export type AiStatusBody = {
  configured: boolean;
  model: string;
  default?: { provider: string; model: string };
  providers?: AiProviderSummary[];
};

/** Characters, not bytes: this is the number the answer's message states. */
export const AI_MAX_PROMPT = 8000;

/** Upstream budget. A completion past 30 s reads as broken, not slow. */
export const AI_TIMEOUT_MS = 30_000;

export type AiErrorKind =
  /** No key on the server, so no upstream call is attempted. */
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

export type AiOk = { ok: true; text: string; model: string; provider?: string; ms: number };

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
  if (!isRecord(value)) return false;
  if (typeof value.configured !== 'boolean') return false;
  if (typeof value.model !== 'string' || value.model === '') return false;
  /* The two newer fields are optional: an older server answers `{configured,
     model}` and must stay a valid answer. When they are present they have to
     be complete — a half-read provider list would render a broken picker. */
  if (value.default !== undefined) {
    const fallback = value.default;
    if (!isRecord(fallback)) return false;
    if (typeof fallback.provider !== 'string' || fallback.provider === '') return false;
    if (typeof fallback.model !== 'string' || fallback.model === '') return false;
  }
  if (value.providers !== undefined) {
    if (!Array.isArray(value.providers)) return false;
    if (!value.providers.every(isAiProviderSummary)) return false;
  }
  return true;
}

export function isAiProviderSummary(value: unknown): value is AiProviderSummary {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id === '') return false;
  if (typeof value.label !== 'string') return false;
  if (typeof value.configured !== 'boolean') return false;
  return Array.isArray(value.models) && value.models.every((m) => typeof m === 'string');
}

/** A selection read off the wire or out of storage; anything odd is null. */
export function readSelection(value: unknown): AiSelection | null {
  if (!isRecord(value)) return null;
  const provider = value.provider;
  const model = value.model;
  if (typeof provider !== 'string' || provider.trim() === '') return null;
  if (typeof model !== 'string' || model.trim() === '') return null;
  return { provider: provider.trim(), model: model.trim() };
}

/** `provider/model` — what the interface shows and what the chat log keeps. */
export function selectionLabel(selection: AiSelection): string {
  return `${selection.provider}/${selection.model}`;
}

/**
 * Whether a stored selection still exists on this server. A provider that was
 * removed from the configuration, or a model taken out of its allowlist, makes
 * the stored choice unusable — the caller falls back to the server default
 * rather than sending a request that will be refused.
 */
export function selectionInCatalog(
  selection: AiSelection | null,
  providers: AiProviderSummary[] | undefined,
): boolean {
  if (!selection || !providers) return false;
  const provider = providers.find((p) => p.id === selection.provider);
  if (!provider || !provider.configured) return false;
  return provider.models.includes(selection.model);
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

/* --------------------------------------------------------------------------
   The streaming contract: a byte-for-byte passthrough of the model's
   OpenAI-format SSE. No event types to keep in sync — the pipe is the
   contract, and only the failure shape (AiErr) is ours.
   -------------------------------------------------------------------------- */

export type AiHistoryItem = { role: 'user' | 'assistant'; content: string };

export function isAiHistory(value: unknown): value is AiHistoryItem[] {
  return (
    Array.isArray(value) &&
    value.length <= AI_MAX_HISTORY &&
    value.every(
      (item) =>
        isRecord(item) &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.length <= AI_MAX_HISTORY_ITEM,
    )
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
