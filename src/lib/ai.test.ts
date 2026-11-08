import { describe, expect, it } from 'vitest';
import { isAiBody, readCompletion, statusFor } from './ai';

describe('readCompletion', () => {
  it('reads the first choice of an OpenAI-shaped reply', () => {
    expect(
      readCompletion({
        model: 'deepseek-chat',
        choices: [{ message: { role: 'assistant', content: '  a line  ' } }],
      }),
    ).toEqual({ text: '  a line  ', model: 'deepseek-chat' });
  });

  it('reports a null model rather than inventing one', () => {
    expect(readCompletion({ choices: [{ message: { content: 'hi' } }] })).toEqual({
      text: 'hi',
      model: null,
    });
  });

  it.each([
    ['no choices', {}],
    ['empty choices', { choices: [] }],
    ['no message', { choices: [{}] }],
    ['blank content', { choices: [{ message: { content: '   ' } }] }],
    ['numeric content', { choices: [{ message: { content: 42 } }] }],
    ['a string body', 'nope'],
    ['null', null],
  ])('returns null for %s', (_label, payload) => {
    expect(readCompletion(payload)).toBeNull();
  });
});

describe('isAiBody', () => {
  it('accepts a completion', () => {
    expect(isAiBody({ ok: true, text: 'hi', model: 'm', ms: 12 })).toBe(true);
  });

  it('accepts every failure kind', () => {
    for (const kind of [
      'not_configured',
      'unauthorized',
      'rate_limited',
      'timeout',
      'network',
      'upstream',
      'contract',
    ]) {
      expect(isAiBody({ ok: false, kind, message: 'x', retryable: false })).toBe(true);
    }
  });

  it.each([
    ['not an object', 'ok'],
    ['missing ok', { text: 'hi' }],
    ['ok as a string', { ok: 'true', text: 'hi', model: 'm', ms: 1 }],
    ['missing ms', { ok: true, text: 'hi', model: 'm' }],
    ['ms not finite', { ok: true, text: 'hi', model: 'm', ms: Number.NaN }],
    ['unknown kind', { ok: false, kind: 'exploded', message: 'x', retryable: true }],
    ['missing retryable', { ok: false, kind: 'timeout', message: 'x' }],
  ])('rejects %s', (_label, value) => {
    expect(isAiBody(value)).toBe(false);
  });
});

describe('statusFor', () => {
  it('keeps the caller-visible status honest per kind', () => {
    expect(statusFor('not_configured')).toBe(503);
    expect(statusFor('contract')).toBe(400);
    expect(statusFor('rate_limited')).toBe(429);
    expect(statusFor('timeout')).toBe(504);
    /* A rejected key and an unreachable host are the endpoint's problem, not the
       caller's: a 4xx here would read as "your request was malformed". */
    expect(statusFor('unauthorized')).toBe(502);
    expect(statusFor('network')).toBe(502);
  });
});
