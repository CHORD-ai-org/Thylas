import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE, SESSION_PATH, sessionFailure, statusForSession } from './session';

describe('session contract', () => {
  it('names the cookie and the endpoint', () => {
    expect(SESSION_COOKIE).toBe('thylas_session');
    expect(SESSION_PATH).toBe('/api/session');
  });

  it('keeps the failure shape and never claims a retry helps', () => {
    expect(sessionFailure('forbidden', 'no access')).toEqual({
      ok: false,
      kind: 'forbidden',
      message: 'no access',
      retryable: false,
    });
  });

  it('maps 401 / 403 / 503', () => {
    expect(statusForSession('unauthorized')).toBe(401);
    expect(statusForSession('forbidden')).toBe(403);
    expect(statusForSession('not_configured')).toBe(503);
  });
});
