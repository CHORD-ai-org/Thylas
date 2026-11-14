import { IconBoards } from '../components/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWorkspace, recent, STATE_LABEL, STATE_TONE } from '../data/selectors';
import type { RecentKind } from '../data/types';
import { Chip, SectionLabel, StatusDot, TypeGlyph, NoteGlyph, ProcessGlyph } from '../components/ui';
import { PlainLayout } from '../shell/layouts';
import s from './recently.module.css';

const TYPES: Array<{ id: 'all' | RecentKind; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'file', label: 'Files' },
  { id: 'note', label: 'Notes' },
  { id: 'board', label: 'Boards' },
  { id: 'process', label: 'Processes' },
];

function glyph(kind: RecentKind) {
  if (kind === 'file') return <TypeGlyph kind="pdf" />;
  if (kind === 'note') return <NoteGlyph />;
  if (kind === 'process') return <ProcessGlyph />;
  return (
    <span className={s.boardGlyph}>
      <IconBoards size={11} />
    </span>
  );
}

export function Recently() {
  const navigate = useNavigate();
  const [type, setType] = useState<'all' | RecentKind>('all');
  const items = recent().filter((r) => type === 'all' || r.kind === type);

  return (
    <PlainLayout wide>
      <header className={s.head}>
        <h1 className={s.title}>Recently</h1>
        <p className={s.sub}>One row per object, most recent first.</p>
      </header>

      <div className={s.filters} role="tablist" aria-label="Filter by type">
        {TYPES.map((t) => {
          const count = t.id === 'all' ? recent().length : recent().filter((r) => r.kind === t.id).length;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={type === t.id}
              className={[s.filter, type === t.id ? s.filterOn : ''].join(' ')}
              onClick={() => setType(t.id)}
            >
              {t.label}
              <span className={s.filterCount}>{count}</span>
            </button>
          );
        })}
      </div>

      <section>
        <SectionLabel aside={`${items.length} of 50`}>Last touched</SectionLabel>
        <ul className={s.rows}>
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <button type="button" className={s.row} onClick={() => navigate(item.route)}>
                <span className={s.glyph}>{glyph(item.kind)}</span>
                <span className={s.label}>{item.label}</span>
                <span className={s.meta}>
                  {item.kind} · {getWorkspace(item.wsId)?.name}
                </span>
                {item.state ? (
                  <Chip tone={STATE_TONE[item.state]}>
                    <StatusDot tone={STATE_TONE[item.state]} /> {STATE_LABEL[item.state]}
                  </Chip>
                ) : null}
                <span className={s.when}>{item.when}</span>
              </button>
            </li>
          ))}
        </ul>
        {items.length === 0 ? <p className={s.empty}>No {type} in the last 50 events.</p> : null}
      </section>

    </PlainLayout>
  );
}
