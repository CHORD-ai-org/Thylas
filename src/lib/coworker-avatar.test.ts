import { describe, expect, it } from 'vitest';
import { AVATAR_HUES, avatarFontOf, avatarStroke, avatarStyleOf } from './coworker-avatar';

describe('coworker avatars', () => {
  it('is deterministic for an id', () => {
    expect(avatarStyleOf('cw-reviewer')).toEqual(avatarStyleOf('cw-reviewer'));
  });

  it('spreads the three seed coworkers across looks', () => {
    const seeds = ['cw-reviewer', 'cw-scribe', 'cw-archivist'].map(avatarStyleOf);
    expect(new Set(seeds.map((s) => s.hair)).size).toBeGreaterThan(1);
    expect(new Set(seeds.map((s) => s.hue)).size).toBe(3);
    expect(seeds.every((s) => AVATAR_HUES.includes(s.hue))).toBe(true);
  });

  it('keeps every derived dimension in range', () => {
    for (let i = 0; i < 200; i += 1) {
      const style = avatarStyleOf(`cw-${i}`);
      expect([0, 1, 2]).toContain(style.hair);
      expect([0, 1, 2]).toContain(style.accessory);
      expect(AVATAR_HUES).toContain(style.hue);
    }
  });

  it('gives the three seed coworkers three different name faces', () => {
    const fonts = ['cw-reviewer', 'cw-scribe', 'cw-archivist'].map(avatarFontOf);
    expect(new Set(fonts).size).toBe(3);
    for (let i = 0; i < 200; i += 1) expect([0, 1, 2]).toContain(avatarFontOf(`cw-${i}`));
  });

  it('allows any plain colour name or hex, rejects markup', () => {
    expect(avatarStroke('#ff6b6b', 'clay')).toBe('#ff6b6b');
    expect(avatarStroke('emerald', 'clay')).toBe('emerald');
    expect(avatarStroke(undefined, 'clay')).toBe('var(--cover-clay)');
    expect(avatarStroke('url(javascript:alert(1))', 'clay')).toBe('var(--cover-clay)');
    expect(avatarStroke('<script>', 'clay')).toBe('var(--cover-clay)');
  });
});
