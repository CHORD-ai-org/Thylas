/**
 * Wire contract for the session surface (P1-5). The server returns identity and
 * membership flags; the client never computes access (B1).
 *
 * CHORD owns sign-in. Thylas never implements password flows; it only reads a
 * session cookie. Until the IdP is reachable an explicit dev stand-in is used.
 */
export const SESSION_PATH = '/api/session';
export const SESSION_COOKIE = 'thylas_session';

export type SessionUser = { id: string; workspaceIds: string[] };
export type SessionBody = { ok: true; user: SessionUser };

export type SessionErrorKind = 'unauthorized' | 'forbidden' | 'not_configured';
export type SessionErr = {
  ok: false;
  kind: SessionErrorKind;
  message: string;
  retryable: boolean;
};
export type SessionResultBody = SessionBody | SessionErr;

/** A retry cannot manufacture credentials or a membership. */
export function sessionFailure(kind: SessionErrorKind, message: string): SessionErr {
  return { ok: false, kind, message, retryable: false };
}

export function statusForSession(kind: SessionErrorKind): number {
  switch (kind) {
    case 'unauthorized':
      return 401;
    case 'forbidden':
      return 403;
    default:
      return 503;
  }
}
