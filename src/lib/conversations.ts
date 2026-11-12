/**
 * Wire contract for the conversations API (P1-4). Following the D-006 pattern:
 * the server route and the client import this one file, so a field change is a
 * compile error on the other side. No server or client logic lives here.
 */
export const CONVERSATIONS_PATH = '/api/conversations';
export const CONVERSATION_MAX_ID = 128;
export const CONVERSATION_MAX_TITLE = 200;

export type ConversationDto = {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type CreateConversationBody = { id: string; workspaceId: string; title?: string };
export type PatchConversationBody = { title?: string; archived?: boolean };

export type ConversationErrorKind =
  /** The caller's request did not match this contract. */
  | 'contract'
  /** No conversation with that id. */
  | 'not_found'
  /** No DATABASE_URL on the server. */
  | 'not_configured'
  /** Storage failed behind the endpoint. */
  | 'upstream';

export type ConversationErr = {
  ok: false;
  kind: ConversationErrorKind;
  message: string;
  retryable: boolean;
};

export type ConversationListBody = { ok: true; items: ConversationDto[] };
export type ConversationBody = { ok: true; item: ConversationDto };
export type ConversationDeleteBody = { ok: true; id: string };
export type ConversationResultBody =
  | ConversationListBody
  | ConversationBody
  | ConversationDeleteBody
  | ConversationErr;

/** Retry only helps when a second attempt can end differently. */
const RETRYABLE: Record<ConversationErrorKind, boolean> = {
  contract: false,
  not_found: false,
  not_configured: false,
  upstream: true,
};

export function conversationFailure(
  kind: ConversationErrorKind,
  message: string,
  retryable = RETRYABLE[kind],
): ConversationErr {
  return { ok: false, kind, message, retryable };
}

/** Resource semantics: 400 for a bad request, 404 for a missing id. */
export function statusForConversation(kind: ConversationErrorKind): number {
  switch (kind) {
    case 'contract':
      return 400;
    case 'not_found':
      return 404;
    case 'not_configured':
      return 503;
    default:
      return 502;
  }
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= CONVERSATION_MAX_ID;
}

export function isCreateConversationBody(value: unknown): value is CreateConversationBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!isId(v.id) || !isId(v.workspaceId)) return false;
  return (
    v.title === undefined ||
    (typeof v.title === 'string' && v.title.length <= CONVERSATION_MAX_TITLE)
  );
}

export function isPatchConversationBody(value: unknown): value is PatchConversationBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v);
  if (keys.length === 0) return false;
  if (!keys.every((key) => key === 'title' || key === 'archived')) return false;
  if (v.title !== undefined && (typeof v.title !== 'string' || v.title.length > CONVERSATION_MAX_TITLE)) {
    return false;
  }
  return v.archived === undefined || typeof v.archived === 'boolean';
}
