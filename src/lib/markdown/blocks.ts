/**
 * The Markdown subset this product stores, parsed into blocks for rendering.
 *
 * Six kinds, hand-written, because a Markdown library would add ~30 KB and a
 * `dangerouslySetInnerHTML` surface to render five things. The parser is
 * line-based on purpose: the document is what a person typed, so the reader
 * shows the same lines the editor held.
 *
 * Deliberately not supported: headings other than `##`, nested lists, tables,
 * images, hard line breaks. Adding one of those is a decision, not a bug.
 */

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'code'; text: string; lang?: string };

const FENCE = /^```(\S*)\s*$/;
const LIST_ITEM = /^[-*] /;
const STRUCTURAL = /^(## |[-*] |> |```)/;

export function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const lang: string | undefined = fence[1] || undefined;
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        body.push(lines[i] ?? '');
        i += 1;
      }
      /* An unclosed fence runs to the end: the document is not lost, it is
         shown as code, which is what the author last typed. */
      i += 1;
      blocks.push(lang === undefined ? { kind: 'code', text: body.join('\n') } : { kind: 'code', text: body.join('\n'), lang });
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({ kind: 'h2', text: line.slice(3).trim() });
      i += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const quoted: string[] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('> ')) {
        quoted.push((lines[i] ?? '').slice(2));
        i += 1;
      }
      blocks.push({ kind: 'quote', text: quoted.join('\n').trim() });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const items: string[] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').slice(2).trim());
        i += 1;
      }
      blocks.push({ kind: 'list', items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length) {
      const next = lines[i] ?? '';
      if (next.trim() === '' || STRUCTURAL.test(next)) break;
      paragraph.push(next.trim());
      i += 1;
    }
    blocks.push({ kind: 'p', text: paragraph.join('\n') });
  }

  return blocks;
}

/** Blocks that can hold a `[[link]]`. Code cannot: its text is literal. */
export function isProse(block: Block): boolean {
  return block.kind !== 'code';
}
