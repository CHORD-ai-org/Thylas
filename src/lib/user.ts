/**
 * Wire shapes and validated reads for the User domain (Phase 2, A0).
 *
 * `src/state/user.ts` re-exports these types so existing UI imports stay put;
 * a future server route imports this same file (D-006 pattern). Nothing here
 * reads a store, a session, or the network. No API path is declared yet: where
 * the User state lives is still an open decision (PHASE-2-USER.md Q1).
 */
export type Landing = 'overview' | 'recently' | 'notes';
export type Density = 'comfortable' | 'compact';

export type Prefs = {
  landing: Landing;
  density: Density;
  /** A workspace id, resolved against the live list by whoever renders it. */
  defaultWorkspace: string | null;
};

export const DEFAULT_PREFS: Prefs = {
  landing: 'overview',
  density: 'comfortable',
  defaultWorkspace: null,
};

const LANDINGS: Landing[] = ['overview', 'recently', 'notes'];
const DENSITIES: Density[] = ['comfortable', 'compact'];

/**
 * Validated read of a persisted `prefs` object. Bad entries are dropped, never
 * the whole envelope: a hand-edited payload loses the entry, not the library.
 */
export function readPrefs(value: unknown): Partial<Prefs> {
  if (typeof value !== 'object' || value === null) return {};
  const raw = value as Record<string, unknown>;
  const prefs: Partial<Prefs> = {};
  if (typeof raw.landing === 'string' && LANDINGS.includes(raw.landing as Landing)) {
    prefs.landing = raw.landing as Landing;
  }
  if (typeof raw.density === 'string' && DENSITIES.includes(raw.density as Density)) {
    prefs.density = raw.density as Density;
  }
  if (typeof raw.defaultWorkspace === 'string') {
    prefs.defaultWorkspace = raw.defaultWorkspace;
  } else if (raw.defaultWorkspace === null) {
    prefs.defaultWorkspace = null;
  }
  return prefs;
}

/** A blank or non-string name means "fall back to the identity provider". */
export function readDisplayName(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/* ---- Phase 2 A1: the server-side User surface (D-059) ------------------- */

export const USER_PATH = '/api/user';
export const USER_DISPLAY_NAME_MAX = 40;

/** `null` means no override: the identity provider's name is used. */
export type UserDto = { displayName: string | null };
export type UserPatch = { displayName: string | null };

export type UserErrorKind =
  | 'contract'
  | 'unauthorized'
  | 'forbidden'
  | 'not_configured'
  | 'upstream';

export type UserErr = {
  ok: false;
  kind: UserErrorKind;
  message: string;
  retryable: boolean;
};

export type UserResultBody = { ok: true; user: UserDto } | UserErr;

/** Only an upstream failure can change on a second attempt. */
export function userFailure(kind: UserErrorKind, message: string): UserErr {
  return { ok: false, kind, message, retryable: kind === 'upstream' };
}

export function statusForUser(kind: UserErrorKind): number {
  if (kind === 'contract') return 400;
  if (kind === 'unauthorized') return 401;
  if (kind === 'forbidden') return 403;
  return 503;
}

/** Only a bounded string or an explicit clear is accepted. */
export function isUserPatch(value: unknown): value is UserPatch {
  if (typeof value !== 'object' || value === null) return false;
  const raw = value as Record<string, unknown>;
  if (!('displayName' in raw)) return false;
  if (raw.displayName === null) return true;
  return typeof raw.displayName === 'string' && raw.displayName.length <= USER_DISPLAY_NAME_MAX;
}

/** A blank override is the same as clearing it. */
export function normalizeDisplayName(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
