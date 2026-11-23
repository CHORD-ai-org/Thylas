import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  },
});

const fresh = async () => {
  vi.resetModules();
  return import('./skills');
};

beforeEach(() => {
  storage.clear();
});

describe('skills store', () => {
  it('seeds the official catalog with mixed enable states', async () => {
    const s = await fresh();
    const all = s.skillsView();
    expect(all.length).toBeGreaterThan(8);
    expect(all.some((x) => x.enabled)).toBe(true);
    expect(all.some((x) => !x.enabled)).toBe(true);
    expect(all.every((x) => x.source === 'official')).toBe(true);
  });

  it('toggles and disables all, and the state persists', async () => {
    const s = await fresh();
    const first = s.skillsView()[0]!;
    s.toggleSkill(first.id);
    expect(s.skillsView().find((x) => x.id === first.id)?.enabled).toBe(!first.enabled);
    s.setAllEnabled(false);
    expect(s.skillsView().every((x) => !x.enabled)).toBe(true);
    expect(storage.has('thylas:skills:v1')).toBe(true);
  });

  it('creates a custom skill on top and removes it', async () => {
    const s = await fresh();
    const created = s.createSkill({ name: '  我的技能  ', description: 'd', category: '研究' });
    expect(created.source).toBe('mine');
    expect(created.name).toBe('我的技能');
    expect(s.skillsView()[0]!.id).toBe(created.id);
    s.removeSkill(created.id);
    expect(s.skillsView().some((x) => x.id === created.id)).toBe(false);
  });

  it('falls back to 工程 for an unknown category', async () => {
    const s = await fresh();
    expect(s.createSkill({ name: 'x', category: 'nope' }).category).toBe('工程');
  });
});
