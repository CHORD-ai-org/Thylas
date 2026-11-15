import { describe, expect, it } from 'vitest';
import { MOONSHOT_QUOTES } from './quotes';

/**
 * The rules in LOGIN-PLAN §6 are cheap to check, so they are checked: no quote
 * ships without a source, nothing is long enough to be truncated, and no two
 * entries repeat.
 */
describe('moonshot quotes', () => {
  it('every quote names an author, a year and a source', () => {
    for (const quote of MOONSHOT_QUOTES) {
      expect(quote.author.trim().length).toBeGreaterThan(0);
      expect(quote.year.trim().length).toBeGreaterThan(0);
      expect(quote.source.trim().length).toBeGreaterThan(0);
    }
  });

  it('fits the panel: no quote is longer than 180 characters', () => {
    for (const quote of MOONSHOT_QUOTES) expect(quote.text.length).toBeLessThanOrEqual(180);
  });

  it('has no duplicate ids and no duplicate sentences', () => {
    expect(new Set(MOONSHOT_QUOTES.map((q) => q.id)).size).toBe(MOONSHOT_QUOTES.length);
    expect(new Set(MOONSHOT_QUOTES.map((q) => q.text)).size).toBe(MOONSHOT_QUOTES.length);
  });
});
