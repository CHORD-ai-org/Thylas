import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { coworkersView, useCoworkers } from '../../state/coworkers';
import { PlainLayout } from '../../shell/layouts';
import { Button, EmptyState } from '../../components/ui';
import { IconPlus } from '../../components/icons';
import { hashId } from '../../lib/cover';
import a from '../artifacts/artifacts.module.css';
import c from './coworker.module.css';

/**
 * The Directory — list-first, one orientation line, view chips, search.
 * A row answers: who is this, what are they for, where do they work, what
 * state are they in.
 */

const DAY = 86_400_000;

/** Same hash as the artifact covers: a character sum put two of the three
    seeds on the same hue, which made the grid look like one colour. */
function hue(id: string): string {
  return String(hashId(id) % 4);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function CoworkerDirectory() {
  useCoworkers();
  const [view, setView] = useState<'all' | 'active' | 'archived'>('all');
  const [mode, setMode] = useState<'list' | 'grid'>('list');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coworkersView().filter((cw) => {
      if (view === 'active' && cw.status !== 'active') return false;
      if (view === 'archived' && cw.status !== 'archived') return false;
      if (!q) return true;
      return `${cw.name} ${cw.description} ${cw.responsibilities.forWork}`.toLowerCase().includes(q);
    });
  }, [view, query]);

  return (
    <PlainLayout size="console">
      <header className={a.head}>
        <div className={a.headText}>
          <p className={a.eyebrow}>LIBRARY</p>
          <h1 className={a.title}>Coworkers</h1>
          <p className={a.sub}>
            Reused across workspaces. Prototype data; edits persist in this browser.
          </p>
        </div>
        <div className={a.headActions}>
          <div className={a.modeRow} role="group" aria-label="View mode">
            <button
              type="button"
              className={[a.modeBtn, mode === 'list' ? a.modeBtnOn : ''].join(' ')}
              aria-label="List view"
              aria-pressed={mode === 'list'}
              onClick={() => setMode('list')}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
              </svg>
            </button>
            <button
              type="button"
              className={[a.modeBtn, mode === 'grid' ? a.modeBtnOn : ''].join(' ')}
              aria-label="Grid view"
              aria-pressed={mode === 'grid'}
              onClick={() => setMode('grid')}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <rect x="2.5" y="2.5" width="4.6" height="4.6" />
                <rect x="8.9" y="2.5" width="4.6" height="4.6" />
                <rect x="2.5" y="8.9" width="4.6" height="4.6" />
                <rect x="8.9" y="8.9" width="4.6" height="4.6" />
              </svg>
            </button>
          </div>
          <input
            className={a.search}
            type="search"
            aria-label="Search coworkers"
            placeholder="Search name, brief"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Link to={routes.coworkerNew()} className={a.createBtn} data-create-coworker>
            <IconPlus size={12} /> Create Coworker
          </Link>
        </div>
      </header>

      <div className={a.navRow}>
        <div className={a.chipRow} role="group" aria-label="Views">
          {(['all', 'active', 'archived'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={[a.chip, view === v ? a.chipOn : ''].join(' ')}
              onClick={() => setView(v)}
              aria-pressed={view === v}
            >
              {v[0]!.toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className={a.resultLine}>
        <span className={a.resultCount}>
          {visible.length} coworker{visible.length === 1 ? '' : 's'}
        </span>
        <span className={a.resultNote}>prototype data — persists in this browser only</span>
      </div>

      {visible.length === 0 ? (
        query.trim() !== '' ? (
          <EmptyState
            title="No coworker matches this search"
            hint="Search covers names and briefs. Clear it to see the full directory."
            action={
              <Button size="sm" onClick={() => setQuery('')}>
                Clear search
              </Button>
            }
          />
        ) : view === 'archived' ? (
          <EmptyState title="No archived coworkers" hint="Archive one from its working page when its work is done." />
        ) : (
          <EmptyState
            title="No coworkers yet"
            hint="Create the first coworker."
            action={
              <Link to={routes.coworkerNew()} className={a.linkArrow}>
                Create Coworker
              </Link>
            }
          />
        )
      ) : mode === 'grid' ? (
        <ul className={a.gallery} data-coworker-grid>
          {visible.map((cw) => (
            <li key={cw.id}>
              <Link
                className={a.galleryCard}
                to={routes.coworker(cw.id)}
                data-coworker-card={cw.id}
                aria-label={`${cw.name}, ${cw.status}`}
              >
                <span className={c.cardCover} data-hue={hue(cw.id)} aria-hidden>
                  <span className={c.cardInitials}>{initials(cw.name)}</span>
                </span>
                <span className={a.cardBodyPad}>
                  <span className={a.cardName}>{cw.name}</span>
                  <span className={a.cardSummary}>{cw.responsibilities.forWork || cw.description}</span>
                  <span className={a.cardMeta}>
                    <span className={c.statusChip} data-status={cw.status}>
                      {cw.status}
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      {cw.memberships.length} workspace{cw.memberships.length === 1 ? '' : 's'}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={a.rows}>
          {visible.map((cw) => (
            <li key={cw.id}>
              <Link className={a.row} to={routes.coworker(cw.id)} data-coworker-row={cw.id}>
                <span className={c.mark} data-hue={hue(cw.id)} aria-hidden>
                  {initials(cw.name)}
                </span>
                <span className={a.rowMain}>
                  <span className={a.rowTitle}>{cw.name}</span>
                  <span className={a.rowMeta}>{cw.responsibilities.forWork || cw.description}</span>
                </span>
                <span className={a.rowAside}>
                  <span className={c.statusChip} data-status={cw.status}>
                    {cw.status}
                  </span>
                  <span className={a.updated}>
                    {cw.memberships.length} workspace{cw.memberships.length === 1 ? '' : 's'}
                  </span>
                  <span className={a.updated}>
                    {Date.now() - cw.createdAt < DAY ? 'new' : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

    </PlainLayout>
  );
}
