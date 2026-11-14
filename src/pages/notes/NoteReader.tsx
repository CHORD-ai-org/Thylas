import type { ReactNode } from 'react';
import { parseBlocks } from '../../lib/markdown/blocks';
import { titlesFor } from '../../lib/markdown/backlinks';
import { resolveLinks } from '../../lib/markdown/links';
import type { Note } from '../../data/types';
import s from '../notes.module.css';

/**
 * Reading mode. Blocks come from `parseBlocks`, links from `resolveLinks`, and
 * no HTML is ever injected: the document is shown as the lines that were typed.
 */

function inline(
  text: string,
  titles: Map<string, string>,
  onOpen: (id: string) => void,
  onCreate: (title: string) => void,
): ReactNode {
  const links = resolveLinks(text, titles);
  if (links.length === 0) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  links.forEach((link, i) => {
    if (link.start > cursor) parts.push(text.slice(cursor, link.start));
    const label = link.alias ?? link.target;
    const id = link.id;
    parts.push(
      id === null ? (
        <button
          key={`d${i}`}
          type="button"
          className={s.chipOff}
          title={`No note titled “${link.target}” — click to write it`}
          aria-label={`Create a note titled ${link.target}`}
          onClick={() => onCreate(link.target)}
        >
          {label}
        </button>
      ) : (
        <button key={`l${i}`} type="button" className={s.chip} onClick={() => onOpen(id)}>
          {label}
        </button>
      ),
    );
    cursor = link.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export function NoteReader({
  note,
  all,
  onOpen,
  onCreate,
}: {
  note: Note;
  all: Note[];
  onOpen: (id: string) => void;
  /** A dangling chip is not a dead end: it offers to write the note it names. */
  onCreate: (title: string) => void;
}) {
  const titles = titlesFor(note, all);
  const blocks = parseBlocks(note.body);
  const words = note.body.trim() === '' ? 0 : note.body.trim().split(/\s+/).length;

  return (
    <div className={s.prose}>
      {blocks.length === 0 ? (
        <p className={s.p}>
          <span className={s.placeholder}>
            This note is empty.
          </span>
        </p>
      ) : null}
      {blocks.map((block, i) => {
        const key = `${block.kind}-${i}`;
        if (block.kind === 'h2') return <h2 key={key} className={s.h2}>{block.text}</h2>;
        if (block.kind === 'quote') {
          return (
            <blockquote key={key} className={s.quote}>
              {inline(block.text, titles, onOpen, onCreate)}
            </blockquote>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={key} className={s.list2}>
              {block.items.map((item, j) => (
                <li key={j}>{inline(item, titles, onOpen, onCreate)}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === 'code') {
          return (
            <pre key={key} className={s.code}>
              {block.text}
            </pre>
          );
        }
        return (
          <p key={key} className={s.p}>
            {inline(block.text, titles, onOpen, onCreate)}
          </p>
        );
      })}
      {words > 0 ? <p className={s.endMark} aria-hidden /> : null}
    </div>
  );
}
