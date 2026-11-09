import type { ReactNode } from 'react';
import s from './chat.module.css';
import { CodeBlock } from './CodeBlock';

/**
 * A small, safe markdown renderer: headings, lists, tables, blockquotes,
 * fenced code, hr, and inline code / bold / italic / links. No engine, no
 * `dangerouslySetInnerHTML`, no HTML anywhere — every node is constructed, so
 * a model cannot inject markup into the page. Links resolve only to http(s)
 * or in-app routes; anything else renders as plain text.
 *
 * Math, footnotes and images are out of scope on purpose (SPEC §7); they
 * render as their source text rather than breaking the block around them.
 */

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; level: 1 | 2 | 3; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'code'; lang: string; content: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'hr' };

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  const splitRow = (line: string): string[] =>
    line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const content: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        content.push(lines[i] ?? '');
        i += 1;
      }
      i += 1; /* closing fence (or end of input while streaming) */
      blocks.push({ type: 'code', lang, content: content.join('\n') });
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: 'h', level: heading[1]!.length as 1 | 2 | 3, text: heading[2] ?? '' });
      i += 1;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('>')) {
        quote.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', lines: quote });
      continue;
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? '') && (lines[i + 1] ?? '').includes('-')) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        rows.push(splitRow(lines[i] ?? ''));
        i += 1;
      }
      blocks.push({ type: 'table', head, rows });
      continue;
    }

    /* paragraph: consecutive plain lines */
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^(#{1,3}\s|```|\s*[-*]\s|\s*\d+\.\s|>|\|)/.test(lines[i] ?? '')
    ) {
      paragraph.push(lines[i] ?? '');
      i += 1;
    }
    if (paragraph.length > 0) blocks.push({ type: 'p', text: paragraph.join('\n') });
    else i += 1;
  }

  return blocks;
}

const INLINE_RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\((?:https?:\/\/[^\s)]+|\/[^\s)]*)\))/g;

function renderInline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const keyN = `${key}-${index++}`;
    if (token.startsWith('`')) {
      nodes.push(<code key={keyN}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={keyN}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<em key={keyN}>{token.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (link) {
        const href = link[2]!;
        nodes.push(
          href.startsWith('/') ? (
            <a key={keyN} href={href}>
              {link[1]}
            </a>
          ) : (
            <a key={keyN} href={href} target="_blank" rel="noreferrer">
              {link[1]}
            </a>
          ),
        );
      } else {
        nodes.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MarkdownBody({ source, caret }: { source: string; caret?: boolean }) {
  const blocks = parseMarkdown(source);
  return (
    <div className={s.md}>
        {blocks.map((block, bi) => {
          const key = `b${bi}`;
          switch (block.type) {
            case 'h': {
              const Tag = (['h1', 'h2', 'h3'] as const)[block.level - 1]!;
              return <Tag key={key}>{renderInline(block.text, key)}</Tag>;
            }
            case 'p': {
              const lines = block.text.split('\n');
              return (
                <p key={key}>
                  {lines.map((line, li) => (
                    <span key={li}>
                      {li > 0 ? <br /> : null}
                      {renderInline(line, `${key}-${li}`)}
                    </span>
                  ))}
                  {caret && bi === blocks.length - 1 ? <span className={s.caret} aria-hidden /> : null}
                </p>
              );
            }
            case 'ul':
              return (
                <ul key={key}>
                  {block.items.map((item, ii) => (
                    <li key={ii}>{renderInline(item, `${key}-${ii}`)}</li>
                  ))}
                </ul>
              );
            case 'ol':
              return (
                <ol key={key}>
                  {block.items.map((item, ii) => (
                    <li key={ii}>{renderInline(item, `${key}-${ii}`)}</li>
                  ))}
                </ol>
              );
            case 'quote':
              return (
                <blockquote key={key}>
                  {block.lines.map((line, li) => (
                    <p key={li}>{renderInline(line, `${key}-${li}`)}</p>
                  ))}
                </blockquote>
              );
            case 'code':
              return <CodeBlock key={key} lang={block.lang} content={block.content} />;
            case 'hr':
              return <hr key={key} />;
            case 'table':
              return (
                <table key={key}>
                  <thead>
                    <tr>
                      {block.head.map((cell, ci) => (
                        <th key={ci}>{renderInline(cell, `${key}-h${ci}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{renderInline(cell, `${key}-${ri}-${ci}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            default:
              return null;
          }
        })}
    </div>
  );
}
