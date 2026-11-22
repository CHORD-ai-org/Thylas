import { describe, expect, it } from 'vitest';
import {
  CHAT_STATE_PATH,
  MAX_CONVERSATIONS,
  MAX_MESSAGES,
  chatFailure,
  isBlock,
  isConversation,
  isMessage,
  isPutChatStateBody,
  statusForChat,
} from './chat';

const message = {
  id: 'm-1',
  role: 'user',
  at: 1,
  blocks: [{ kind: 'text', text: 'hi' }],
};

const conversation = {
  id: 'c-1',
  title: 'First',
  createdAt: 1,
  messages: [message],
  context: [{ id: 's-1', kind: 'file', name: 'report.pdf' }],
};

describe('chat contract', () => {
  it('names the endpoint and the caps', () => {
    expect(CHAT_STATE_PATH).toBe('/api/chat/state');
    expect(MAX_CONVERSATIONS).toBe(20);
    expect(MAX_MESSAGES).toBe(200);
  });

  it('validates the base block kinds and rejects a foreign one', () => {
    expect(isBlock({ kind: 'text', text: 'x' })).toBe(true);
    expect(isBlock({ kind: 'artifact', title: 'a', artifactKind: 'code', content: 'x' })).toBe(true);
    expect(isBlock({ kind: 'evidence', name: 'a', sourceType: 'file' })).toBe(true);
    expect(isBlock({ kind: 'status', label: 'a', state: 'done' })).toBe(true);
    expect(isBlock({ type: 'text', text: 'old shape' })).toBe(false);
  });

  it('validates the five interaction block kinds', () => {
    expect(
      isBlock({ kind: 'source-picker', title: 't', options: [{ id: 'o1', name: 'Diary' }], selected: ['o1'] }),
    ).toBe(true);
    expect(isBlock({ kind: 'candidates', title: 't', candidateIds: ['c1'] })).toBe(true);
    expect(
      isBlock({ kind: 'proposal', title: 't', summary: 's', target: { kind: 'artifact' }, risk: 'high', status: 'proposed' }),
    ).toBe(true);
    expect(isBlock({ kind: 'diff', title: 't', before: 'a', after: 'b', status: 'proposed' })).toBe(true);
    expect(isBlock({ kind: 'approval', title: 't', body: 'b', risk: 'low', state: 'pending' })).toBe(true);
    /* A bad enum or a missing field must not pass as a decision surface. */
    expect(isBlock({ kind: 'approval', title: 't', body: 'b', risk: 'nuke', state: 'pending' })).toBe(false);
    expect(isBlock({ kind: 'candidates', title: 't' })).toBe(false);
    expect(isBlock({ kind: 'source-picker', title: 't', options: 'x', selected: [] })).toBe(false);
  });

  it('validates a message and a conversation', () => {
    expect(isMessage(message)).toBe(true);
    expect(isConversation(conversation)).toBe(true);
    expect(isConversation({ ...conversation, context: [{ id: 'x', kind: 'nope', name: 'x' }] })).toBe(false);
  });

  it('validates a PUT body and enforces the caps', () => {
    expect(isPutChatStateBody({ expectedVersion: 0, conversations: [conversation] })).toBe(true);
    expect(isPutChatStateBody({ expectedVersion: -1, conversations: [] })).toBe(false);
    expect(isPutChatStateBody({ expectedVersion: 0, conversations: [1] })).toBe(false);
    expect(
      isPutChatStateBody({ expectedVersion: 0, conversations: Array(MAX_CONVERSATIONS + 1).fill(conversation) }),
    ).toBe(false);
  });

  it('keeps the failure shape and maps 400 / 409 / 503 / 502', () => {
    expect(chatFailure('conflict', 'stale')).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'stale',
      retryable: false,
    });
    expect(chatFailure('upstream', 'db').retryable).toBe(true);
    expect(statusForChat('contract')).toBe(400);
    expect(statusForChat('conflict')).toBe(409);
    expect(statusForChat('not_configured')).toBe(503);
    expect(statusForChat('upstream')).toBe(502);
  });
});
