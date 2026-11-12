import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_MAX_TITLE,
  conversationFailure,
  isCreateConversationBody,
  isPatchConversationBody,
  statusForConversation,
} from './conversations';

describe('conversations contract', () => {
  it('accepts a create body with or without a title', () => {
    expect(isCreateConversationBody({ id: 'c-1', workspaceId: 'ws-1' })).toBe(true);
    expect(isCreateConversationBody({ id: 'c-1', workspaceId: 'ws-1', title: 'First' })).toBe(true);
  });

  it('rejects empty ids, a non-object, and a title over the cap', () => {
    expect(isCreateConversationBody({ id: '', workspaceId: 'ws-1' })).toBe(false);
    expect(isCreateConversationBody(null)).toBe(false);
    expect(
      isCreateConversationBody({
        id: 'c-1',
        workspaceId: 'ws-1',
        title: 'x'.repeat(CONVERSATION_MAX_TITLE + 1),
      }),
    ).toBe(false);
  });

  it('accepts only title/archived in a patch, with at least one field', () => {
    expect(isPatchConversationBody({})).toBe(false);
    expect(isPatchConversationBody({ title: 'x', extra: 1 })).toBe(false);
    expect(isPatchConversationBody({ archived: true })).toBe(true);
    expect(isPatchConversationBody({ archived: 'yes' })).toBe(false);
  });

  it('keeps the failure shape and an honest retryable flag', () => {
    expect(conversationFailure('contract', 'bad')).toEqual({
      ok: false,
      kind: 'contract',
      message: 'bad',
      retryable: false,
    });
    expect(conversationFailure('upstream', 'db down').retryable).toBe(true);
  });

  it('maps failure kinds to HTTP status', () => {
    expect(statusForConversation('contract')).toBe(400);
    expect(statusForConversation('not_found')).toBe(404);
    expect(statusForConversation('not_configured')).toBe(503);
    expect(statusForConversation('upstream')).toBe(502);
  });
});
