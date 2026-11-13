/**
 * The Chat store: conversations, their messages as blocks, declared context,
 * and the dock's presentation state (D-051, P1-7).
 *
 * One store serves both surfaces — the /chat page and the dock beside any
 * route render the same active conversation. Types and validated reads come
 * from `src/lib/chat.ts`, so the server route imports the same contract.
 *
 * P1-7: `VITE_CHAT_SOURCE=local|api` switches the persistence backing. The
 * default `local` path is byte-for-byte the original behaviour. In `api` mode
 * every commit stays optimistic and synchronous (all action signatures are
 * unchanged); the network write is a throttled background side effect and the
 * local envelope is always kept as a fallback. Streaming deltas never hit the
 * network — only the finished turn does.
 *
 * Nothing here talks to the model: streaming is the caller's job, driven
 * through `beginAssistantMessage` / `appendDelta` / `finishAssistantMessage`.
 */
import { useSyncExternalStore } from 'react';
import type { AiErr } from '../lib/ai';
import {
  DOCK_DEFAULT,
  DOCK_MAX,
  DOCK_MIN,
  MAX_CONVERSATIONS,
  MAX_MESSAGES,
  isConversation,
  type Block,
  type ContextSource,
  type Conversation,
  type Message,
  type State,
} from '../lib/chat';
import { createChatClient } from '../services/chat/client';

export { DOCK_MIN, DOCK_MAX } from '../lib/chat';
export type { SourceKind, ContextSource, Block, Message, Conversation, State } from '../lib/chat';

const KEY = 'thylas:chat:v1';
const MIGRATED_KEY = 'thylas:chat:migrated:v1';
const SYNC_DELAY_MS = 300;

const MODE: 'local' | 'api' =
  (import.meta.env.VITE_CHAT_SOURCE as string | undefined) === 'api' ? 'api' : 'local';

const EMPTY: State = {
  conversations: [],
  activeId: null,
  dock: { open: false, width: DOCK_DEFAULT },
};

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

function persistLocal(next: State): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, ...next }));
  } catch {
    /* quota: the session keeps its conversations in memory only */
  }
}

/* ---- P1-7: background remote persistence ---- */

const chatClient = createChatClient();
let remoteVersion = 0;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let booting = false;

function scheduleSync(): void {
  if (MODE !== 'api' || booting) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void flushSync();
  }, SYNC_DELAY_MS);
}

async function flushSync(): Promise<void> {
  if (MODE !== 'api' || booting) return;
  const result = await chatClient.putState({
    expectedVersion: remoteVersion,
    conversations: snapshot.conversations,
  });
  if (!result.ok) {
    /* The local envelope is already written. Never lose it on a failed sync. */
    console.warn('[chat] remote sync failed — local envelope kept');
    return;
  }
  remoteVersion = result.version;
}

/** First switch to `api`: import the old envelope once, then hydrate from the server. */
async function bootstrap(): Promise<void> {
  if (MODE !== 'api') return;
  booting = true;
  try {
    const remote = await chatClient.getState();
    if (!remote.ok) {
      console.warn('[chat] could not load remote state — local envelope kept');
      return;
    }
    remoteVersion = remote.version;
    const migrated = typeof localStorage !== 'undefined' && localStorage.getItem(MIGRATED_KEY) === '1';

    if (remote.conversations.length === 0 && !migrated && snapshot.conversations.length > 0) {
      const put = await chatClient.putState({
        expectedVersion: remoteVersion,
        conversations: snapshot.conversations,
      });
      if (put.ok) {
        remoteVersion = put.version;
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(MIGRATED_KEY, '1');
          } catch {
            /* quota: the envelope is intact, it will be re-imported next time */
          }
        }
      } else {
        console.warn('[chat] envelope import failed — local copy kept');
      }
      return;
    }

    if (remote.conversations.length > 0) {
      const ids = new Set(remote.conversations.map((c) => c.id));
      commit(
        {
          ...snapshot,
          conversations: remote.conversations,
          activeId:
            snapshot.activeId && ids.has(snapshot.activeId)
              ? snapshot.activeId
              : (remote.conversations[0]?.id ?? null),
        },
        { sync: false },
      );
    }
  } finally {
    booting = false;
  }
}

function commit(next: State, options: { sync?: boolean } = {}): void {
  snapshot = next;
  persistLocal(next);
  if (MODE === 'api' && options.sync !== false) scheduleSync();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): State => snapshot;

if (MODE === 'api') void bootstrap();

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
  /* The stream is over: flush once now instead of waiting out the throttle. */
  if (MODE === 'api' && !booting) {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    void flushSync();
  }
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
