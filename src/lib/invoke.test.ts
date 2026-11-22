import { describe, expect, it } from 'vitest';
import { parseInvokeToken, rank, toContextSource, type InvokeItem } from './invoke';

const item = (over: Partial<InvokeItem>): InvokeItem => ({
  id: 'x',
  group: 'resource',
  kind: 'note',
  label: 'Note',
  scope: 'ws-1',
  ...over,
});

describe('parseInvokeToken', () => {
  it('reads a bare object token', () => {
    expect(parseInvokeToken('ask @Mira', 9)).toEqual({ trigger: '@', start: 4, query: 'Mira' });
  });

  it('reads an action token', () => {
    expect(parseInvokeToken('/extract', 8)).toEqual({ trigger: '/', start: 0, query: 'extract' });
  });

  it('allows an empty query right after the trigger (recents list)', () => {
    expect(parseInvokeToken('hi @', 4)).toEqual({ trigger: '@', start: 3, query: '' });
  });

  it('does not treat an e-mail as a trigger', () => {
    expect(parseInvokeToken('write to user@example.com', 25)).toBeNull();
  });

  it('does not treat a path segment as a trigger', () => {
    expect(parseInvokeToken('open src/lib/foo', 16)).toBeNull();
  });

  it('is null at whitespace, at the caret origin, and past the end', () => {
    expect(parseInvokeToken('hello ', 6)).toBeNull();
    expect(parseInvokeToken('hello', 0)).toBeNull();
    expect(parseInvokeToken('@a', 99)).toBeNull();
    expect(parseInvokeToken('@a', -1)).toBeNull();
  });

  it('stops the token at a newline', () => {
    expect(parseInvokeToken('@a\nb', 4)).toBeNull();
    expect(parseInvokeToken('@a\nb', 2)).toEqual({ trigger: '@', start: 0, query: 'a' });
  });

  it('keeps the most recent token when several are present', () => {
    expect(parseInvokeToken('@a and @b', 9)).toEqual({ trigger: '@', start: 7, query: 'b' });
  });

  it('handles unicode/CJK tokens', () => {
    expect(parseInvokeToken('@学习引擎', 5)).toEqual({ trigger: '@', start: 0, query: '学习引擎' });
  });
});

describe('rank', () => {
  const items: InvokeItem[] = [
    item({ id: '1', label: 'Mira', group: 'coworker', kind: 'coworker' }),
    item({ id: '2', label: 'Mirage', group: 'artifact', kind: 'concept' }),
    item({ id: '3', label: 'Learning Engine', group: 'artifact', kind: 'concept', scope: 'ws-2' }),
    item({ id: '4', label: 'diary', group: 'resource', kind: 'note', detail: 'Learning notes' }),
  ];

  it('puts exact matches above prefix and contains', () => {
    const out = rank(items, { token: 'mira', group: 'all', scope: 'ws-1' });
    expect(out[0]!.label).toBe('Mira');
  });

  it('matches on detail as a weaker tier', () => {
    const out = rank(items, { token: 'learning', group: 'all', scope: 'ws-1' });
    // "Learning Engine" is a prefix match; "diary" only matches via detail.
    expect(out.map((i) => i.id)).toEqual(['3', '4']);
  });

  it('filters by group', () => {
    const out = rank(items, { token: '', group: 'coworker', scope: 'ws-1' });
    expect(out.map((i) => i.id)).toEqual(['1']);
  });

  it('orders by recency when the query is empty', () => {
    const out = rank(items, { token: '', group: 'all', scope: 'ws-1' }, ['4', '3']);
    expect(out[0]!.id).toBe('4');
    expect(out[1]!.id).toBe('3');
  });

  it('prefers the same scope when otherwise tied', () => {
    const twins = [
      item({ id: 'a', label: 'Same', scope: 'ws-2' }),
      item({ id: 'b', label: 'Same', scope: 'ws-1' }),
    ];
    const out = rank(twins, { token: 'same', group: 'all', scope: 'ws-1' });
    expect(out.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('falls back to group priority, then label, deterministically', () => {
    const tied = [
      item({ id: 'a', label: 'Zed', group: 'artifact', kind: 'concept' }),
      item({ id: 'b', label: 'Alpha', group: 'resource', kind: 'note' }),
      item({ id: 'c', label: 'Beta', group: 'artifact', kind: 'concept' }),
    ];
    const out = rank(tied, { token: '', group: 'all', scope: 'zz' });
    expect(out.map((i) => i.id)).toEqual(['c', 'a', 'b']); // artifact first (label), then resource
    expect(rank(tied, { token: '', group: 'all', scope: 'zz' })).toEqual(out); // stable
  });
});

describe('toContextSource', () => {
  it('binds workspaces and the three resource kinds', () => {
    expect(toContextSource(item({ id: 'w', group: 'workspace', kind: 'workspace', label: 'WS' }))).toEqual({
      id: 'w',
      kind: 'workspace',
      name: 'WS',
    });
    expect(toContextSource(item({ id: 'n', kind: 'note', label: 'N' }))?.kind).toBe('note');
    expect(toContextSource(item({ id: 'f', kind: 'file', label: 'F' }))?.kind).toBe('file');
    expect(toContextSource(item({ id: 'b', kind: 'board', label: 'B' }))?.kind).toBe('board');
  });

  it('returns null where the binding shape has no kind yet', () => {
    expect(toContextSource(item({ group: 'coworker', kind: 'coworker' }))).toBeNull();
    expect(toContextSource(item({ group: 'gsc', kind: 'knowledge-object' }))).toBeNull();
    expect(toContextSource(item({ group: 'action', kind: 'extract' }))).toBeNull();
    expect(toContextSource(item({ kind: 'process' }))).toBeNull();
  });
});
