import { describe, expect, it } from 'vitest';
import { parseLinks, resolveLinks } from './links';

const PROSE = `# not a heading
[[Method — how we measure comparability]] is the one.
See also [[method — how we measure comparability|the method]] and [[Nowhere]].
`;

describe('parseLinks', () => {
  it('reads target, alias and offsets', () => {
    const text = 'a [[Method]] b';
    const [link] = parseLinks(text);
    expect(link).toEqual({
      target: 'Method',
      alias: null,
      start: 2,
      end: 12,
      raw: '[[Method]]',
    });
    expect(text.slice(link!.start, link!.end)).toBe('[[Method]]');
  });

  it('keeps the alias, splitting on the first pipe only', () => {
    expect(parseLinks('[[A|B|C]]')[0]?.alias).toBe('B|C');
    expect(parseLinks('[[A|shown text]]')[0]).toMatchObject({ target: 'A', alias: 'shown text' });
  });

  it('trims the target but not the alias interior', () => {
    expect(parseLinks('[[  Missing  ]]')[0]?.target).toBe('Missing');
    expect(parseLinks('[[A|  spaced  ]]')[0]?.alias).toBe('spaced');
  });

  it('ignores an empty or whitespace-only target', () => {
    expect(parseLinks('[[]]')).toEqual([]);
    expect(parseLinks('[[   ]]')).toEqual([]);
  });

  it('finds several links in source order', () => {
    expect(parseLinks('[[A]] and [[B]]').map((l) => l.target)).toEqual(['A', 'B']);
  });

  it('leaves links inside fenced code alone', () => {
    const md = 'prose [[Yes]]\n```\nconst x = [[No]];\n```\n';
    expect(parseLinks(md).map((l) => l.target)).toEqual(['Yes']);
  });

  it('resumes after the fence closes', () => {
    const md = '```\n[[No]]\n```\n[[Yes]]\n';
    expect(parseLinks(md).map((l) => l.target)).toEqual(['Yes']);
  });

  it('treats an unclosed fence as code to the end', () => {
    expect(parseLinks('```\n[[No]]\n')).toEqual([]);
  });
});

describe('resolveLinks', () => {
  const titles = new Map([
    ['method — how we measure comparability', 'n-method'],
    ['reading list', 'n-reading'],
  ]);

  it('resolves case-insensitively and reports a dangling target as null', () => {
    const links = resolveLinks(PROSE, titles);
    expect(links.map((l) => l.id)).toEqual(['n-method', 'n-method', null]);
  });

  it('does not resolve a target that differs in punctuation', () => {
    expect(resolveLinks('[[Method—how]]', titles)[0]?.id).toBeNull();
  });
});
