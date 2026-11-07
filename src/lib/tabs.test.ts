import { describe, expect, it } from 'vitest';
import {
  closeTab,
  makeObjectTab,
  openTab,
  pruneForQuota,
  reconcileTabs,
  rotateIntoView,
  roomPath,
  type Tab,
  type TabsState,
} from './tabs';

const tab = (id: string, type: Tab['type'] = 'file'): Tab =>
  makeObjectTab({ type, label: id, path: `/w/ws-a/files/${id}` });

const state = (...entries: Array<[string, Tab[]]>): TabsState => Object.fromEntries(entries);
const list = (value: TabsState, ctx: string): Tab[] => value[ctx] ?? [];

describe('open / close', () => {
  it('adds exactly one tab and ignores a duplicate open', () => {
    const one = openTab({}, 'ws:ws-a', tab('f-1'));
    expect(list(one, 'ws:ws-a')).toHaveLength(1);
    const two = openTab(one, 'ws:ws-a', tab('f-1'));
    expect(two).toBe(one); // same reference: no persist, no re-render
  });

  it('keeps contexts isolated', () => {
    let next = openTab({}, 'ws:ws-a', tab('f-1'));
    next = openTab(next, 'ws:ws-b', tab('f-2'));
    expect(list(next, 'ws:ws-a').map((t) => t.id)).toEqual(['/w/ws-a/files/f-1']);
    expect(list(next, 'ws:ws-b').map((t) => t.id)).toEqual(['/w/ws-a/files/f-2']);
  });

  it('closing an inactive tab leaves the rest and the other context alone', () => {
    const start = state(['ws:ws-a', [tab('f-1'), tab('f-2')]], ['ws:ws-b', [tab('f-3')]]);
    const next = closeTab(start, 'ws:ws-a', '/w/ws-a/files/f-1');
    expect(list(next, 'ws:ws-a').map((t) => t.label)).toEqual(['f-2']);
    expect(next['ws:ws-b']).toBe(start['ws:ws-b']);
  });

  it('closing the last tab leaves an empty list, not a missing context', () => {
    const next = closeTab(state(['ws:ws-a', [tab('f-1')]]), 'ws:ws-a', '/w/ws-a/files/f-1');
    expect(list(next, 'ws:ws-a')).toEqual([]);
  });

  it('a closed active tab returns to its own room, never another workspace', () => {
    expect(roomPath(tab('f-1'))).toBe('/w/ws-a/files');
    expect(roomPath(makeObjectTab({ type: 'board', label: 'b', path: '/w/ws-a/boards/b-1' }))).toBe('/w/ws-a/boards');
    expect(roomPath(makeObjectTab({ type: 'run', label: 'r', path: '/w/ws-a/processes/r-1' }))).toBe('/w/ws-a/processes');
    expect(roomPath(makeObjectTab({ type: 'note', label: 'n', path: '/notes/n-1' }))).toBe('/notes');
  });
});

describe('reconcile', () => {
  it('marks a deleted object as missing instead of dropping the tab', () => {
    const start = state(['ws:ws-a', [tab('f-1'), tab('f-2')]]);
    const next = reconcileTabs(start, ['ws:ws-a'], (t) => t.label !== 'f-2');
    expect(list(next, 'ws:ws-a')).toHaveLength(2);
    expect(list(next, 'ws:ws-a')[1]?.missing).toBe(true);
    expect(list(next, 'ws:ws-a')[0]?.missing).toBeUndefined();
  });

  it('clears the tombstone when the object resolves again, and drops dead contexts', () => {
    const start = state(
      ['ws:ws-a', [{ ...tab('f-1'), missing: true }]],
      ['ws:gone', [tab('f-9')]],
    );
    const next = reconcileTabs(start, ['ws:ws-a'], () => true);
    expect(list(next, 'ws:ws-a')[0]?.missing).toBe(false);
    expect(next['ws:gone']).toBeUndefined();
  });

  it('returns the same reference when nothing changed', () => {
    const start = state(['ws:ws-a', [tab('f-1')]]);
    expect(reconcileTabs(start, ['ws:ws-a'], () => true)).toBe(start);
  });
});

describe('overflow rotation', () => {
  const many = Array.from({ length: 9 }, (_, i) => tab(`f-${i}`));
  const first = many[0]!;
  const last = many[8]!;

  it('shows every tab when it fits', () => {
    const { visible, hidden } = rotateIntoView(many.slice(0, 3), first.path, 8);
    expect(visible).toHaveLength(3);
    expect(hidden).toHaveLength(0);
  });

  it('rotates a hidden active tab into view and lists the rest', () => {
    const { visible, hidden } = rotateIntoView(many, last.path, 3);
    expect(visible).toHaveLength(3);
    expect(visible.some((t) => t.path === last.path)).toBe(true);
    expect(hidden).toHaveLength(6);
    expect(new Set([...visible, ...hidden])).toEqual(new Set(many));
  });
});

describe('quota guard', () => {
  it('leaves a small set alone', () => {
    const start = state(['ws:ws-a', [tab('f-1')]]);
    expect(pruneForQuota(start, 100_000)).toBe(start);
  });

  it('shrinks a large set until it fits without throwing', () => {
    const big = state(['ws:ws-a', Array.from({ length: 400 }, (_, i) => tab(`f-${i}`))]);
    const next = pruneForQuota(big, 4_000);
    expect(JSON.stringify(next).length).toBeLessThanOrEqual(4_000);
    expect(list(next, 'ws:ws-a').length).toBeLessThan(400);
  });
});
