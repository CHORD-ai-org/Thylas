import { describe, expect, it } from 'vitest';
import { LEGACY_NOTES } from './mock';
import { NOTE_SEEDS, legacyToMarkdown, seedNote } from './note-seed';
import { parseBlocks } from '../lib/markdown/blocks';
import type { LegacyBlock } from './types';

describe('legacyToMarkdown', () => {
  it('writes each block kind in the syntax the parser reads back', () => {
    const blocks: LegacyBlock[] = [
      { kind: 'p', text: 'a paragraph' },
      { kind: 'h2', text: 'a heading' },
      { kind: 'quote', text: 'one\ntwo' },
      { kind: 'list', items: ['x', 'y'] },
      { kind: 'code', text: 'const a = 1;' },
    ];
    expect(legacyToMarkdown(blocks)).toBe(
      'a paragraph\n\n## a heading\n\n> one\n> two\n\n- x\n- y\n\n```\nconst a = 1;\n```',
    );
  });

  it('round-trips every sample note without losing a block', () => {
    for (const legacy of LEGACY_NOTES) {
      const markdown = legacyToMarkdown(legacy.body);
      const parsed = parseBlocks(markdown);
      expect(parsed.length, legacy.id).toBe(legacy.body.length);
      parsed.forEach((block, i) => {
        const source = legacy.body[i];
        expect(block.kind, `${legacy.id}#${i}`).toBe(source?.kind);
        if (source?.kind === 'list' && block.kind === 'list') {
          expect(block.items).toEqual(source.items);
        } else if (source?.kind !== 'list' && block.kind !== 'list' && source) {
          expect(block).toMatchObject({ text: source.kind === 'quote' ? source.text : source.text });
        }
      });
    }
  });
});

describe('NOTE_SEEDS', () => {
  it('has one note per sample, with body as Markdown', () => {
    expect(NOTE_SEEDS).toHaveLength(LEGACY_NOTES.length);
    expect(NOTE_SEEDS).toHaveLength(6);
    for (const note of NOTE_SEEDS) {
      expect(note.body).not.toContain('[object Object]');
      expect(note.body.startsWith('[')).toBe(false);
      expect(note.version).toBe(1);
    }
  });

  it('is deterministic: the same note converts to the same timestamp every run', () => {
    const first = seedNote(LEGACY_NOTES[0]!, 0);
    const again = seedNote(LEGACY_NOTES[0]!, 0);
    expect(first).toEqual(again);
  });
});
