import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The chat store owns conversations, blocks and context. The cases below are
 * the ways that state can go wrong: a payload someone edited, a cap that must
 * keep the newest, a stop that must read as a partial answer rather than an
 * error, and a regenerate that removes exactly one turn.
 */

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  },
});

const fresh = async () => {
  vi.resetModules();
  return { store: await import('./chat') };
};

beforeEach(() => {
  storage.clear();
});

describe('conversations', () => {
  it('starts with none and creates an active one', async () => {
    const { store } = await fresh();
    expect(store.__readForTest().conversations).toHaveLength(0);
    const created = store.newConversation();
    const state = store.__readForTest();
    expect(state.activeId).toBe(created.id);
    expect(state.conversations).toHaveLength(1);
  });

  it('keeps at most 20 conversations, newest first', async () => {
    const { store } = await fresh();
    for (let i = 0; i < 23; i++) store.newConversation();
    const state = store.__readForTest();
    expect(state.conversations).toHaveLength(20);
    const times = state.conversations.map((c) => c.createdAt);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('renames with a real title and ignores a blank one', async () => {
    const { store } = await fresh();
    const c = store.newConversation();
    store.renameConversation(c.id, '  Tokenizer plan  ');
    expect(store.__readForTest().conversations[0]!.title).toBe('Tokenizer plan');
    store.renameConversation(c.id, '   ');
    expect(store.__readForTest().conversations[0]!.title).toBe('Tokenizer plan');
  });

  it('deleting the active one activates the next newest', async () => {
    const { store } = await fresh();
    const a = store.newConversation();
    const b = store.newConversation();
    store.deleteConversation(b.id);
    expect(store.__readForTest().activeId).toBe(a.id);
  });

  it('a hand-edited payload loses bad entries and an unknown activeId', async () => {
    storage.set(
      'thylas:chat:v1',
      JSON.stringify({
        version: 1,
        conversations: [
          { id: 'conv-ok', title: 'Ok', createdAt: 2, messages: [], context: [] },
          { id: 'conv-bad', title: 'Bad', createdAt: 3, messages: [{ id: 'x', role: 'system', at: 1, blocks: [] }], context: [] },
        ],
        activeId: 'conv-missing',
      }),
    );
    const { store } = await fresh();
    const state = store.__readForTest();
    expect(state.conversations.map((c) => c.id)).toEqual(['conv-ok']);
    expect(state.activeId).toBe('conv-ok');
  });
});

describe('messages', () => {
  it('a user turn carries evidence for attached sources, never for the workspace itself', async () => {
    const { store } = await fresh();
    const c = store.newConversation();
    store.addContextSource(c.id, { kind: 'workspace', name: 'Research' });
    store.addContextSource(c.id, { kind: 'note', name: 'Method' });
    const user = store.addUserMessage(c.id, 'What does the method say?');
    const evidence = user.blocks.filter((b) => b.kind === 'evidence');
    expect(evidence).toHaveLength(1);
    expect((evidence[0] as { name: string }).name).toBe('Method');
  });

  it('the first user message names the conversation', async () => {
    const { store } = await fresh();
    const c = store.newConversation();
    store.addUserMessage(c.id, 'Compare the two tokenizer baselines');
    expect(store.__readForTest().conversations[0]!.title).toBe('Compare the two tokenizer baselines');
  });

  it('streaming appends into the open text block; finish closes it and stamps meta', async () => {
    const { store } = await fresh();
    const c = store.newConversation();
    store.addUserMessage(c.id, 'hello');
    const assistant = store.beginAssistantMessage(c.id);
    store.appendDelta(c.id, assistant.id, 'A boundary ');
    store.appendDelta(c.id, assistant.id, 'is where one thing stops.');
    store.finishAssistantMessage(c.id, assistant.id, { model: 'deepseek-chat', ms: 320 });
    const saved = store.__readForTest().conversations[0]!.messages[1]!;
    expect((saved.blocks[0] as { text: string }).text).toBe('A boundary is where one thing stops.');
    expect((saved.blocks[0] as { streaming?: boolean }).streaming).toBe(false);
    expect(saved.meta).toEqual({ model: 'deepseek-chat', ms: 320 });
  });

  it('a stop appends a status block and keeps the partial text, without an error', async () => {
    const { store } = await fresh();
    const c = store.newConversation();
    store.addUserMessage(c.id, 'hello');
    const assistant = store.beginAssistantMessage(c.id);
    store.appendDelta(c.id, assistant.id, 'partial');
    store.finishAssistantMessage(c.id, assistant.id, { stopped: true });
    const saved = store.__readForTest().conversations[0]!.messages[1]!;
    expect(saved.error).toBeUndefined();
    expect(saved.blocks.at(-1)).toMatchObject({ kind: 'status', state: 'done' });
  });

  it('an error is typed and the partial text stands', async () => {
    const { store } = await fresh();
    const c = store.newConversation();
    store.addUserMessage(c.id, 'hello');
    const assistant = store.beginAssistantMessage(c.id);
    store.appendDelta(c.id, assistant.id, 'so far');
    store.finishAssistantMessage(c.id, assistant.id, { error: { ok: false, kind: 'rate_limited', message: 'stub rate limit', retryable: true } });
    const saved = store.__readForTest().conversations[0]!.messages[1]!;
    expect(saved.error?.kind).toBe('rate_limited');
    expect((saved.blocks[0] as { text: string }).text).toBe('so far');
  });

  it('regenerate drops exactly the last assistant turn', async () => {
    const { store } = await fresh();
    const c = store.newConversation();
    store.addUserMessage(c.id, 'q1');
    store.beginAssistantMessage(c.id);
    store.dropLastAssistant(c.id);
    const messages = store.__readForTest().conversations[0]!.messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]!.role).toBe('user');
  });

  it('history stops before the given message and flattens to text', async () => {
    const { store } = await fresh();
    const c = store.newConversation();
    store.addUserMessage(c.id, 'q1');
    const a1 = store.beginAssistantMessage(c.id);
    store.appendDelta(c.id, a1.id, 'a1');
    const turns = store.historyOf(store.__readForTest().conversations[0]!, a1.id);
    expect(turns).toEqual([{ role: 'user', text: 'q1' }]);
  });
});

describe('context and dock', () => {
  it('adding the same source twice does not duplicate it', async () => {
    const { store } = await fresh();
    const c = store.newConversation();
    store.addContextSource(c.id, { kind: 'note', name: 'Method' });
    store.addContextSource(c.id, { kind: 'note', name: 'Method' });
    expect(store.__readForTest().conversations[0]!.context).toHaveLength(1);
  });

  it('dock width is clamped and persisted', async () => {
    const { store } = await fresh();
    store.setDock(true);
    store.setDockWidth(9999);
    const state = store.__readForTest();
    expect(state.dock).toEqual({ open: true, width: 640 });
    vi.resetModules();
    const reloaded = await import('./chat');
    expect(reloaded.__readForTest().dock.width).toBe(640);
  });
});
