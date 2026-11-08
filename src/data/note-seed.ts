import { LEGACY_NOTES } from './mock';
import type { LegacyBlock, LegacyNote, Note } from './types';

/**
 * The six sample notes were written as block arrays before a store existed.
 * Rather than retyping them as Markdown by hand (and losing whatever the
 * retyping gets wrong), they are converted once at seed time by a pure function
 * that has tests.
 */

/** Fixed, not `Date.now()`: a seed that changes every run cannot be asserted. */
const SEED_TIME = Date.parse('2026-11-07T18:00:00Z');

function blockToMarkdown(block: LegacyBlock): string {
  switch (block.kind) {
    case 'p':
      return block.text;
    case 'h2':
      return `## ${block.text}`;
    case 'quote':
      return block.text
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    case 'list':
      return block.items.map((item) => `- ${item}`).join('\n');
    case 'code':
      return `\`\`\`\n${block.text}\n\`\`\``;
  }
}

export function legacyToMarkdown(blocks: LegacyBlock[]): string {
  return blocks.map(blockToMarkdown).join('\n\n');
}

export function seedNote(legacy: LegacyNote, index: number): Note {
  return {
    id: legacy.id,
    title: legacy.title,
    scope: legacy.scope,
    ...(legacy.wsId === undefined ? {} : { wsId: legacy.wsId }),
    body: legacyToMarkdown(legacy.body),
    version: 1,
    updatedAt: SEED_TIME - index * 3 * 60 * 60 * 1000,
  };
}

export const NOTE_SEEDS: Note[] = LEGACY_NOTES.map(seedNote);
