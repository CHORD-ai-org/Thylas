import { describe, expect, it } from 'vitest';
import { buildBacklinks, outgoing, type LinkSource } from './backlinks';

const note = (over: Partial<LinkSource> & Pick<LinkSource, 'id' | 'title' | 'body'>): LinkSource => ({
  scope: 'workspace',
  wsId: 'ws-research',
  ...over,
});

const METHOD = note({ id: 'n-method', title: 'Method', body: 'the rules' });
const A = note({ id: 'n-a', title: 'A', body: 'see [[Method]] for the rules' });
const B = note({ id: 'n-b', title: 'B', body: 'also [[method|the method]]' });
const DANGLING = note({ id: 'n-d', title: 'D', body: 'see [[Missing]]' });
const PERSONAL = note({ id: 'n-p', title: 'P', scope: 'personal', body: 'see [[Method]]' });
const OTHER_WS = note({ id: 'n-o', title: 'O', wsId: 'ws-onda', body: 'see [[Method]]' });
const SELF = note({ id: 'n-s', title: 'S', body: 'links to [[S]]' });

const ALL = [METHOD, A, B, DANGLING, PERSONAL, OTHER_WS, SELF];

describe('outgoing', () => {
  it('resolves by title, case-insensitively', () => {
    expect(outgoing(A, ALL)).toEqual(['n-method']);
    expect(outgoing(B, ALL)).toEqual(['n-method']);
  });

  it('drops a dangling target', () => {
    expect(outgoing(DANGLING, ALL)).toEqual([]);
  });

  it('cannot reach another scope or another workspace', () => {
    expect(outgoing(PERSONAL, ALL)).toEqual([]);
    expect(outgoing(OTHER_WS, ALL)).toEqual([]);
  });

  it('does not count a self-link', () => {
    expect(outgoing(SELF, ALL)).toEqual([]);
  });

  it('deduplicates repeated mentions', () => {
    const repeated = note({ id: 'n-r', title: 'R', body: '[[Method]] … [[Method|again]]' });
    expect(outgoing(repeated, [...ALL, repeated])).toEqual(['n-method']);
  });
});

describe('buildBacklinks', () => {
  it('lists exactly the notes that link, in source order', () => {
    expect(buildBacklinks(ALL).get('n-method')).toEqual(['n-a', 'n-b']);
  });

  it('has no entry for a note nothing links to', () => {
    expect(buildBacklinks(ALL).get('n-a')).toBeUndefined();
  });

  it('re-resolves after a rename instead of using stale ids', () => {
    const renamed = { ...METHOD, title: 'Method — revised' };
    const after = [renamed, A, B];
    expect(buildBacklinks(after).get('n-method')).toBeUndefined();
    const retargeted = { ...A, body: 'see [[Method — revised]]' };
    expect(buildBacklinks([renamed, retargeted]).get('n-method')).toEqual(['n-a']);
  });

  it('ignores a link inside a code fence', () => {
    const fenced = note({ id: 'n-f', title: 'F', body: '```\n[[Method]]\n```' });
    expect(buildBacklinks([METHOD, fenced]).get('n-method')).toBeUndefined();
  });
});
