import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Bookmarks + notes UI state: the two new envelopes for the notes sidebar.
 * Hand-edited payloads lose bad entries, never the library (house rule).
 */
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  },
});

const fresh = async () => {
  vi.resetModules();
  return {
    bookmarks: await import('./bookmarks'),
    ui: await import('./notesUi'),
  };
};

beforeEach(() => {
  storage.clear();
});

describe('bookmarks', () => {
  it('toggle adds, removes, and survives a reload', async () => {
    const { bookmarks } = await fresh();
    expect(bookmarks.bookmarkedIds()).toEqual([]);
    bookmarks.toggleBookmark('n-1');
    expect(bookmarks.isBookmarked('n-1')).toBe(true);
    vi.resetModules();
    const reloaded = await import('./bookmarks');
    expect(reloaded.bookmarkedIds()).toEqual(['n-1']);
    reloaded.toggleBookmark('n-1');
    expect(reloaded.isBookmarked('n-1')).toBe(false);
  });

  it('a hand-edited payload drops bad ids and duplicates', async () => {
    storage.set('thylas:bookmarks:v1', JSON.stringify({ version: 1, ids: ['n-1', 3, 'n-1', 'n-2', ''] }));
    const { bookmarks } = await fresh();
    expect(bookmarks.bookmarkedIds()).toEqual(['n-1', 'n-2']);
  });

  it('a version mismatch starts empty', async () => {
    storage.set('thylas:bookmarks:v1', JSON.stringify({ version: 9, ids: ['n-1'] }));
    const { bookmarks } = await fresh();
    expect(bookmarks.bookmarkedIds()).toEqual([]);
  });
});

describe('notes UI state', () => {
  it('defaults to files on a desktop-width window', async () => {
    const { ui } = await fresh();
    expect(ui.__readForTest()).toEqual({ view: 'files', collapsed: false });
  });

  it('view changes open the panel and persist', async () => {
    const { ui } = await fresh();
    ui.toggleNotesPanel();
    expect(ui.__readForTest().collapsed).toBe(true);
    ui.setNotesView('bookmarks');
    expect(ui.__readForTest()).toEqual({ view: 'bookmarks', collapsed: false });
    vi.resetModules();
    const reloaded = await import('./notesUi');
    expect(reloaded.__readForTest().view).toBe('bookmarks');
  });

  it('a bad payload falls back instead of crashing', async () => {
    storage.set('thylas:notes-ui:v1', JSON.stringify({ version: 1, view: 'nope', collapsed: 'yes' }));
    const { ui } = await fresh();
    expect(ui.__readForTest().view).toBe('files');
    expect(ui.__readForTest().collapsed).toBe(false);
  });
});
