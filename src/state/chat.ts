/**
 * The Chat store: conversations, their messages as blocks, declared context,
 * and the dock's presentation state (D-051).
 *
 * One store serves both surfaces — the /chat page and the dock beside any
 * route render the same active conversation. Persistence is the house
 * envelope: versioned, validated on read, capped (20 conversations, 200
 * messages each — the oldest quietly dropped), seeds-free.
 *
 * Nothing here talks to the model: streaming is the caller's job, driven
 * through `beginAssistantMessage` / `appendDelta` / `finishAssistantMessage`.
 */
import { useSyncExternalStore } from 'react';
import type { AiErr } from '../lib/ai';

const KEY = 'thylas:chat:v1';

const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES = 200;
export const DOCK_MIN = 300;
export const DOCK_MAX = 640;
const DOCK_DEFAULT = 400;

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
  /** Model + wall time, shown in the assistant footer. Absent on failures. */
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

export type State = {
  conversations: Conversation[];
  activeId: string | null;
  dock: { open: boolean; width: number };
};

const EMPTY: State = {
  conversations: [],
  activeId: null,
  dock: { open: false, width: DOCK_DEFAULT },
};

const SOURCE_KINDS: readonly SourceKind[] = ['workspace', 'file', 'note', 'board', 'integration'];

function isBlock(value: unknown): value is Block {
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

function isMessage(value: unknown): value is Message {
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

function isContextSource(value: unknown): value is ContextSource {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Partial<ContextSource>;
  return (
    typeof s.id === 'string' &&
    typeof s.kind === 'string' &&
    SOURCE_KINDS.includes(s.kind as SourceKind) &&
    typeof s.name === 'string'
  );
}

function isConversation(value: unknown): value is Conversation {
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

function clampWidth(w: number): number {
  return Math.min(DOCK_MAX, Math.max(DOCK_MIN, Math.round(w)));
}

function read(): State {
  if (typeof localStorage === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const p = parsed as Partial<State> & { version?: unknown };
    if (p.version !== 1) return EMPTY;
    const conversations = (Array.isArray(p.conversations) ? p.conversations : [])
      .filter(isConversation)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_CONVERSATIONS);
    const dock = (p.dock ?? {}) as Partial<State['dock']>;
    return {
      conversations,
      activeId: conversations.some((c) => c.id === p.activeId) ? (p.activeId as string) : (conversations[0]?.id ?? null),
      dock: {
        open: dock.open === true,
        width: typeof dock.width === 'number' ? clampWidth(dock.width) : DOCK_DEFAULT,
      },
    };
  } catch {
    return EMPTY;
  }
}

let snapshot: State = read();
const listeners = new Set<() => void>();

function commit(next: State): void {
  snapshot = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, ...snapshot }));
    } catch {
      /* quota: the session keeps its conversations in memory only */
    }
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): State => snapshot;

/* --------------------------------------------------------------------------
   Reads
   -------------------------------------------------------------------------- */

export function useChat(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function activeConversation(state: State): Conversation | null {
  return state.conversations.find((c) => c.id === state.activeId) ?? null;
}

export function conversationById(state: State, id: string | undefined): Conversation | undefined {
  if (!id) return undefined;
  return state.conversations.find((c) => c.id === id);
}

/** A non-hook read for async flows: a send callback sees the store as it is
    when it runs, not as the component last rendered it. */
export function conversationNow(id: string): Conversation | undefined {
  return snapshot.conversations.find((c) => c.id === id);
}

/** The plain-text turns a streaming request may carry as history. */
export function historyOf(conversation: Conversation, beforeMessageId?: string): { role: 'user' | 'assistant'; text: string }[] {
  const turns: { role: 'user' | 'assistant'; text: string }[] = [];
  for (const message of conversation.messages) {
    if (beforeMessageId !== undefined && message.id === beforeMessageId) break;
    const text = message.blocks
      .filter((b): b is Extract<Block, { kind: 'text' }> => b.kind === 'text')
      .map((b) => b.text)
      .join('\n\n')
      .trim();
    if (text !== '') turns.push({ role: message.role, text });
  }
  return turns;
}

/* --------------------------------------------------------------------------
   Writes
   -------------------------------------------------------------------------- */

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function updateConversation(state: State, id: string, update: (c: Conversation) => Conversation): State {
  return {
    ...state,
    conversations: state.conversations.map((c) => (c.id === id ? update(c) : c)),
  };
}

export function newConversation(): Conversation {
  const conversation: Conversation = {
    id: nextId('conv'),
    title: 'New conversation',
    createdAt: Date.now(),
    messages: [],
    context: [],
  };
  commit({
    ...snapshot,
    conversations: [conversation, ...snapshot.conversations].slice(0, MAX_CONVERSATIONS),
    activeId: conversation.id,
  });
  return conversation;
}

export function openConversation(id: string): void {
  commit({ ...snapshot, activeId: id });
}

export function deleteConversation(id: string): void {
  const conversations = snapshot.conversations.filter((c) => c.id !== id);
  commit({
    ...snapshot,
    conversations,
    activeId: snapshot.activeId === id ? (conversations[0]?.id ?? null) : snapshot.activeId,
  });
}

export function renameConversation(id: string, title: string): void {
  const trimmed = title.trim();
  if (!trimmed) return;
  commit(updateConversation(snapshot, id, (c) => ({ ...c, title: trimmed.slice(0, 60) })));
}

export function clearConversation(id: string): void {
  commit(updateConversation(snapshot, id, (c) => ({ ...c, messages: [] })));
}

export function setDock(open: boolean): void {
  commit({ ...snapshot, dock: { ...snapshot.dock, open } });
}

export function setDockWidth(width: number): void {
  commit({ ...snapshot, dock: { ...snapshot.dock, width: clampWidth(width) } });
}

/* ---- context ---- */

export function addContextSource(conversationId: string, source: Omit<ContextSource, 'id'>): void {
  commit(
    updateConversation(snapshot, conversationId, (c) =>
      c.context.some((s) => s.kind === source.kind && s.name === source.name)
        ? c
        : { ...c, context: [...c.context, { ...source, id: nextId('ctx') }] },
    ),
  );
}

export function removeContextSource(conversationId: string, sourceId: string): void {
  commit(
    updateConversation(snapshot, conversationId, (c) => ({
      ...c,
      context: c.context.filter((s) => s.id !== sourceId),
    })),
  );
}

/* ---- messages ---- */

function trimMessages(messages: Message[]): Message[] {
  return messages.length > MAX_MESSAGES ? messages.slice(messages.length - MAX_MESSAGES) : messages;
}

/**
 * Appends the user's turn: their text, then an evidence block for every
 * attached context source — the materials the question names, never a claim
 * about what the assistant went and read.
 */
export function addUserMessage(conversationId: string, prompt: string): Message {
  const conversation = snapshot.conversations.find((c) => c.id === conversationId);
  if (!conversation) throw new Error('no such conversation');
  const blocks: Block[] = [{ kind: 'text', text: prompt }];
  for (const source of conversation.context) {
    if (source.kind === 'workspace') continue;
    blocks.push({
      kind: 'evidence',
      name: source.name,
      sourceType: source.kind,
      ...(source.kind === 'note' ? { route: `/notes` } : {}),
    });
  }
  const message: Message = { id: nextId('msg'), role: 'user', at: Date.now(), blocks };
  commit(
    updateConversation(snapshot, conversationId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? (prompt.trim().slice(0, 40) || c.title) : c.title,
      messages: trimMessages([...c.messages, message]),
    })),
  );
  return message;
}

/** An empty assistant turn holding one streaming text block. */
export function beginAssistantMessage(conversationId: string): Message {
  const message: Message = {
    id: nextId('msg'),
    role: 'assistant',
    at: Date.now(),
    blocks: [{ kind: 'text', text: '', streaming: true }],
  };
  commit(updateConversation(snapshot, conversationId, (c) => ({ ...c, messages: trimMessages([...c.messages, message]) })));
  return message;
}

export function appendDelta(conversationId: string, messageId: string, chunk: string): void {
  commit(
    updateConversation(snapshot, conversationId, (c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              blocks: m.blocks.map((b) => (b.kind === 'text' && b.streaming ? { ...b, text: b.text + chunk } : b)),
            }
          : m,
      ),
    })),
  );
}

export type FinishInput = { model: string; ms: number } | { error: AiErr } | { stopped: true };

/** Ends the streaming block: footer meta, a stop marker, or a typed error. */
export function finishAssistantMessage(conversationId: string, messageId: string, input: FinishInput): void {
  commit(
    updateConversation(snapshot, conversationId, (c) => ({
      ...c,
      messages: c.messages.map((m) => {
        if (m.id !== messageId) return m;
        const blocks: Block[] = m.blocks.map((b) =>
          b.kind === 'text' ? { ...b, streaming: false } : b,
        );
        if ('stopped' in input) {
          blocks.push({ kind: 'status', label: 'Stopped before completing.', state: 'done' });
        }
        return {
          ...m,
          blocks,
          ...('model' in input ? { meta: { model: input.model, ms: input.ms } } : {}),
          ...('error' in input ? { error: input.error } : {}),
        };
      }),
    })),
  );
}

/** Removes the last assistant turn so its question can be asked again. */
export function dropLastAssistant(conversationId: string): void {
  commit(
    updateConversation(snapshot, conversationId, (c) => {
      if (c.messages.length === 0 || c.messages[c.messages.length - 1]!.role !== 'assistant') return c;
      return { ...c, messages: c.messages.slice(0, -1) };
    }),
  );
}

export function resetChat(): void {
  commit(EMPTY);
}

/** Test seam: the module reads storage once, so a test needs a fresh read. */
export function __readForTest(): State {
  return read();
}
