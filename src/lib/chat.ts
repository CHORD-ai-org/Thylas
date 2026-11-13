/**
 * Wire contract for the chat state surface (P1-7). The client store and the
 * server route import this one file — a field change is a compile error on the
 * other side (D-006). `src/state/chat.ts` re-exports these types so no UI file
 * changes its import path.
 */
import type { AiErr } from './ai';

export const CHAT_STATE_PATH = '/api/chat/state';
export const MAX_CONVERSATIONS = 20;
export const MAX_MESSAGES = 200;
export const DOCK_MIN = 300;
export const DOCK_MAX = 640;
export const DOCK_DEFAULT = 400;

export type SourceKind = 'workspace' | 'file' | 'note' | 'board' | 'integration';

export type ContextSource = {
  id: string;
  kind: SourceKind;
  name: string;
  /** One honest line, e.g. "connected · retrieval not implemented". */
  detail?: string;
};

export type Block =
  | { kind: 'text'; text: string; streaming?: boolean }
  | { kind: 'artifact'; title: string; artifactKind: 'code' | 'note'; content: string; savedAs?: string }
  | { kind: 'evidence'; name: string; sourceType: string; route?: string }
  | { kind: 'status'; label: string; state: 'active' | 'done' | 'failed' };

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  at: number;
  blocks: Block[];
  meta?: { model: string; ms: number };
  error?: AiErr;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
  context: ContextSource[];
};

/** Client-only state: `activeId` and `dock` stay local, never cross the wire. */
export type State = {
  conversations: Conversation[];
  activeId: string | null;
  dock: { open: boolean; width: number };
};

export type ChatStateDto = {
  ok: true;
  workspaceId: string;
  version: number;
  conversations: Conversation[];
};

export type ChatPutOk = { ok: true; version: number };
export type PutChatStateBody = { expectedVersion: number; conversations: Conversation[] };

export type ChatErrorKind = 'contract' | 'not_configured' | 'conflict' | 'upstream';
export type ChatErr = {
  ok: false;
  kind: ChatErrorKind;
  message: string;
  retryable: boolean;
};
export type ChatResultBody = ChatStateDto | ChatPutOk | ChatErr;

const RETRYABLE: Record<ChatErrorKind, boolean> = {
  contract: false,
  not_configured: false,
  conflict: false,
  upstream: true,
};

export function chatFailure(
  kind: ChatErrorKind,
  message: string,
  retryable = RETRYABLE[kind],
): ChatErr {
  return { ok: false, kind, message, retryable };
}

export function statusForChat(kind: ChatErrorKind): number {
  switch (kind) {
    case 'contract':
      return 400;
    case 'conflict':
      return 409;
    case 'not_configured':
      return 503;
    default:
      return 502;
  }
}

/* ---- validated reads, shared by the store and the server ---- */

const SOURCE_KINDS: readonly SourceKind[] = ['workspace', 'file', 'note', 'board', 'integration'];

export function isBlock(value: unknown): value is Block {
  if (typeof value !== 'object' || value === null) return false;
  const b = value as Partial<Block>;
  if (b.kind === 'text') return typeof b.text === 'string';
  if (b.kind === 'artifact')
    return (
      typeof b.title === 'string' &&
      (b.artifactKind === 'code' || b.artifactKind === 'note') &&
      typeof b.content === 'string'
    );
  if (b.kind === 'evidence')
    return typeof b.name === 'string' && typeof b.sourceType === 'string';
  if (b.kind === 'status')
    return typeof b.label === 'string' && (b.state === 'active' || b.state === 'done' || b.state === 'failed');
  return false;
}

export function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Partial<Message>;
  return (
    typeof m.id === 'string' &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.at === 'number' &&
    Array.isArray(m.blocks) &&
    m.blocks.every(isBlock) &&
    m.blocks.length <= 32
  );
}

export function isContextSource(value: unknown): value is ContextSource {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Partial<ContextSource>;
  return (
    typeof s.id === 'string' &&
    typeof s.kind === 'string' &&
    SOURCE_KINDS.includes(s.kind as SourceKind) &&
    typeof s.name === 'string'
  );
}

export function isConversation(value: unknown): value is Conversation {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Partial<Conversation>;
  return (
    typeof c.id === 'string' &&
    typeof c.title === 'string' &&
    typeof c.createdAt === 'number' &&
    Array.isArray(c.messages) &&
    c.messages.every(isMessage) &&
    Array.isArray(c.context) &&
    c.context.every(isContextSource)
  );
}

export function isPutChatStateBody(value: unknown): value is PutChatStateBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<PutChatStateBody>;
  return (
    typeof v.expectedVersion === 'number' &&
    Number.isFinite(v.expectedVersion) &&
    v.expectedVersion >= 0 &&
    Array.isArray(v.conversations) &&
    v.conversations.length <= MAX_CONVERSATIONS &&
    v.conversations.every(isConversation) &&
    v.conversations.every((c) => c.messages.length <= MAX_MESSAGES)
  );
}
