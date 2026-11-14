import { describe, expect, it } from 'vitest';
import { ARTIFACTS, COVER_HUES } from '../data/artifacts';
import { derivedHue, hashId, isCoverHue, isCoverSymbol, resolveCover, sanitizeCover } from './cover';

/**
 * Covers are a determinism contract: the same artifact gets the same glyph and
 * the same hue everywhere, and only whitelisted values ever reach the DOM.
 */

describe('hue derivation', () => {
  it('hashes the same id to the same 32-bit value', () => {
    expect(hashId('a-boundary')).toBe(hashId('a-boundary'));
    expect(hashId('a-boundary')).not.toBe(hashId('a-boundary-2'));
    for (const a of ARTIFACTS) {
      const hash = hashId(a.id);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(2 ** 32);
    }
  });

  it('maps every seed to one of the six named hues', () => {
    for (const a of ARTIFACTS) expect(COVER_HUES).toContain(derivedHue(a.id, a.kind));
  });

  it('spreads the seven seeds over at least four hues', () => {
    const used = new Set(ARTIFACTS.map((a) => derivedHue(a.id, a.kind)));
    expect(used.size).toBeGreaterThanOrEqual(4);
  });

  it('anchors the hue on the kind, then shifts by the id', () => {
    /* A pure id hash put the seven seeds on three hues; the kind anchor makes
       the default wheel deterministic per kind without collapsing it. */
    const hash = hashId('a-boundary') % 3;
    const base = ['concept', 'methodology', 'executable', 'product', 'empirical', 'structural', 'external'].indexOf('structural');
    expect(derivedHue('a-boundary', 'structural')).toBe(COVER_HUES[(base + hash) % COVER_HUES.length]);
  });
});

describe('whitelist', () => {
  it('accepts only named hues and known kinds', () => {
    expect(isCoverHue('teal')).toBe(true);
    expect(isCoverHue('magenta')).toBe(false);
    expect(isCoverHue(7)).toBe(false);
    expect(isCoverSymbol('structural')).toBe(true);
    expect(isCoverSymbol('poem')).toBe(false);
  });

  it('drops unknown fields instead of rendering them', () => {
    expect(sanitizeCover({ hue: 'magenta', symbol: 'poem' })).toBeUndefined();
    expect(sanitizeCover({ hue: 'clay' })).toEqual({ hue: 'clay' });
    expect(sanitizeCover({ hue: 'clay', symbol: 'poem' })).toEqual({ hue: 'clay' });
    expect(sanitizeCover(null)).toBeUndefined();
    expect(sanitizeCover('clay')).toBeUndefined();
  });
});

describe('resolveCover', () => {
  it('derives the symbol from the kind and the hue from the id', () => {
    const seed = ARTIFACTS[0]!;
    const resolved = resolveCover(seed);
    expect(resolved.symbol).toBe(seed.kind);
    expect(resolved.hue).toBe(derivedHue(seed.id, seed.kind));
  });

  it('honours an explicit selection', () => {
    const seed = ARTIFACTS[0]!;
    const resolved = resolveCover({ ...seed, cover: { hue: 'amber', symbol: 'external' } });
    expect(resolved).toEqual({ symbol: 'external', hue: 'amber' });
  });

  it('ignores a stored selection that is no longer valid', () => {
    const seed = ARTIFACTS[0]!;
    const resolved = resolveCover({ ...seed, cover: { hue: 'magenta' as never } });
    expect(resolved).toEqual({ symbol: seed.kind, hue: derivedHue(seed.id, seed.kind) });
  });

  it('keeps the external seed on its own glyph', () => {
    const external = ARTIFACTS.find((a) => a.kind === 'external')!;
    expect(resolveCover(external).symbol).toBe('external');
  });
});
