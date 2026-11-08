import { describe, expect, it } from 'vitest';
import { relativeTime } from './relative';

const NOW = Date.parse('2026-11-08T12:00:00Z');
const at = (msAgo: number) => NOW - msAgo;

describe('relativeTime', () => {
  it('says "just now" under a minute', () => {
    expect(relativeTime(at(5_000), NOW)).toBe('just now');
  });

  it('counts minutes and hours', () => {
    expect(relativeTime(at(3 * 60_000), NOW)).toBe('3m ago');
    expect(relativeTime(at(5 * 3_600_000), NOW)).toBe('5h ago');
  });

  it('says "yesterday" only for the second day', () => {
    expect(relativeTime(at(25 * 3_600_000), NOW)).toBe('yesterday');
    expect(relativeTime(at(3 * 86_400_000), NOW)).toBe('3d ago');
  });

  it('falls back to a date after a week', () => {
    expect(relativeTime(at(30 * 86_400_000), NOW)).toMatch(/^Oct \d+$/);
  });

  it('never reports a negative age for a clock that moved backwards', () => {
    expect(relativeTime(NOW + 10_000, NOW)).toBe('just now');
  });
});
