import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  USER_DISPLAY_NAME_MAX,
  isUserPatch,
  normalizeDisplayName,
  readDisplayName,
  readPrefs,
  statusForUser,
  userFailure,
} from './user';

/**
 * The shared User contract (Phase 2 A0). These are the ways a persisted
 * envelope actually breaks: hand-edited values, wrong enum, wrong type, a
 * blank display name. Behaviour here must stay identical to the store's old
 * inline checks — `src/state/user.test.ts` covers the store side unchanged.
 */
describe('DEFAULT_PREFS', () => {
  it('matches the values the UI renders before any preference is saved', () => {
    expect(DEFAULT_PREFS).toEqual({
      landing: 'overview',
      density: 'comfortable',
      theme: 'warm',
      defaultWorkspace: null,
    });
  });
});

describe('readPrefs', () => {
  it('drops non-object input', () => {
    expect(readPrefs(undefined)).toEqual({});
    expect(readPrefs(null)).toEqual({});
    expect(readPrefs('comfortable')).toEqual({});
    expect(readPrefs([])).toEqual({});
  });

  it('keeps three valid preferences', () => {
    expect(
      readPrefs({ landing: 'notes', density: 'compact', defaultWorkspace: 'ws-research' }),
    ).toEqual({ landing: 'notes', density: 'compact', defaultWorkspace: 'ws-research' });
  });

  it('drops enum values the router or CSS cannot understand', () => {
    expect(readPrefs({ landing: 'settings', density: 'tiny' })).toEqual({});
    expect(readPrefs({ landing: 1, density: true })).toEqual({});
  });

  it('accepts a string or null default workspace, ignores anything else', () => {
    expect(readPrefs({ defaultWorkspace: null })).toEqual({ defaultWorkspace: null });
    expect(readPrefs({ defaultWorkspace: '' })).toEqual({ defaultWorkspace: '' });
    expect(readPrefs({ defaultWorkspace: 42 })).toEqual({});
    expect(readPrefs({ defaultWorkspace: {} })).toEqual({});
  });

  it('ignores unknown fields instead of rejecting the envelope', () => {
    expect(readPrefs({ landing: 'recently', unknown: 'x' })).toEqual({ landing: 'recently' });
  });

  it('keeps valid fields when a sibling is malformed', () => {
    expect(readPrefs({ landing: 'notes', density: 'nope', defaultWorkspace: 7 })).toEqual({
      landing: 'notes',
    });
  });
});

describe('readDisplayName', () => {
  it('keeps the stored value verbatim, including surrounding spaces', () => {
    expect(readDisplayName('  Ceaser  ')).toBe('  Ceaser  ');
  });

  it('treats blank and non-string values as no override', () => {
    expect(readDisplayName('')).toBeUndefined();
    expect(readDisplayName('   ')).toBeUndefined();
    expect(readDisplayName(null)).toBeUndefined();
    expect(readDisplayName(12)).toBeUndefined();
  });
});

describe('A1 user contract', () => {
  it('accepts a bounded string or an explicit clear, nothing else', () => {
    expect(isUserPatch({ displayName: 'C. Zhao' })).toBe(true);
    expect(isUserPatch({ displayName: null })).toBe(true);
    expect(isUserPatch({ displayName: '' })).toBe(true);
    expect(isUserPatch({ displayName: 'x'.repeat(USER_DISPLAY_NAME_MAX + 1) })).toBe(false);
    expect(isUserPatch({ displayName: 7 })).toBe(false);
    expect(isUserPatch({ userId: 'u-2' })).toBe(false);
    expect(isUserPatch(null)).toBe(false);
  });

  it('normalizes a blank override to null and trims a real one', () => {
    expect(normalizeDisplayName('  C. Zhao  ')).toBe('C. Zhao');
    expect(normalizeDisplayName('   ')).toBeNull();
    expect(normalizeDisplayName(null)).toBeNull();
  });

  it('maps error kinds to statuses and only retries upstream', () => {
    expect(statusForUser('contract')).toBe(400);
    expect(statusForUser('unauthorized')).toBe(401);
    expect(statusForUser('forbidden')).toBe(403);
    expect(statusForUser('not_configured')).toBe(503);
    expect(userFailure('unauthorized', 'Sign in to continue.').retryable).toBe(false);
    expect(userFailure('upstream', 'offline').retryable).toBe(true);
  });
});
