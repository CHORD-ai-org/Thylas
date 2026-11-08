import { describe, expect, it } from 'vitest';
import { toAnswer } from './map';

describe('toAnswer', () => {
  it('turns a completion into an answer and drops the wire shape', () => {
    expect(toAnswer({ ok: true, text: 'a line', model: 'deepseek-chat', ms: 812 })).toEqual({
      ok: true,
      answer: { text: 'a line', model: 'deepseek-chat', ms: 812 },
    });
  });

  it('passes a typed failure through untouched', () => {
    const failure = { ok: false, kind: 'rate_limited', message: 'wait 20 s', retryable: true };
    expect(toAnswer(failure)).toEqual({ ok: false, error: failure });
  });

  it.each([
    ['an HTML error page', '<html>502</html>'],
    ['an empty object', {}],
    ['a completion without text', { ok: true, model: 'm', ms: 1 }],
    ['a failure with an unknown kind', { ok: false, kind: 'exploded', message: 'x', retryable: true }],
    ['null', null],
  ])('refuses %s as a contract failure', (_label, body) => {
    const result = toAnswer(body);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('contract');
      expect(result.error.retryable).toBe(false);
    }
  });
});
