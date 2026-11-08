import { expect, describe, it } from 'vitest';
import { parseBlocks } from './blocks';

describe('parseBlocks', () => {
  it('reads a paragraph', () => {
    expect(parseBlocks('one line')).toEqual([{ kind: 'p', text: 'one line' }]);
  });

  it('joins wrapped lines in a paragraph and keeps the break', () => {
    expect(parseBlocks('first\nsecond')).toEqual([{ kind: 'p', text: 'first\nsecond' }]);
  });

  it('reads a second-level heading', () => {
    expect(parseBlocks('## 1 · The problem')).toEqual([{ kind: 'h2', text: '1 · The problem' }]);
  });

  it('does not treat a single # as a heading', () => {
    expect(parseBlocks('# title')).toEqual([{ kind: 'p', text: '# title' }]);
  });

  it('merges a blockquote across lines', () => {
    expect(parseBlocks('> a\n> b')).toEqual([{ kind: 'quote', text: 'a\nb' }]);
  });

  it('groups list items and accepts both markers', () => {
    expect(parseBlocks('- one\n* two')).toEqual([{ kind: 'list', items: ['one', 'two'] }]);
  });

  it('reads a fenced block with a language', () => {
    expect(parseBlocks('```ts\nconst a = 1;\n```')).toEqual([
      { kind: 'code', text: 'const a = 1;', lang: 'ts' },
    ]);
  });

  it('reads a fenced block without a language', () => {
    expect(parseBlocks('```\nx\n```')).toEqual([{ kind: 'code', text: 'x' }]);
  });

  it('runs an unclosed fence to the end instead of dropping the text', () => {
    expect(parseBlocks('```\na\nb')).toEqual([{ kind: 'code', text: 'a\nb' }]);
  });

  it('separates blocks on a blank line', () => {
    expect(parseBlocks('a\n\nb').map((b) => b.kind)).toEqual(['p', 'p']);
  });

  it('ends a paragraph when a structural line starts without a blank line', () => {
    expect(parseBlocks('text\n## next').map((b) => b.kind)).toEqual(['p', 'h2']);
  });

  it('normalises CRLF', () => {
    expect(parseBlocks('a\r\n\r\nb').length).toBe(2);
  });

  it('returns nothing for whitespace only', () => {
    expect(parseBlocks('  \n\n \n')).toEqual([]);
  });

  it('keeps a fenced block from swallowing the next paragraph', () => {
    expect(parseBlocks('```\ncode\n```\nafter').map((b) => b.kind)).toEqual(['code', 'p']);
  });
});
