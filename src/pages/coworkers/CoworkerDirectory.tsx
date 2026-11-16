import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { coworkersView, useCoworkers } from '../../state/coworkers';
import { PlainLayout } from '../../shell/layouts';
import { Button, EmptyState } from '../../components/ui';
import { IconPlus } from '../../components/icons';
import { CoworkerAvatar } from '../../components/CoworkerAvatar';
import { avatarFontOf } from '../../lib/coworker-avatar';
import { COWORKER_TEAMS } from '../../data/coworkerTeams';
import { TeamGallery } from './TeamGallery';
import a from '../artifacts/artifacts.module.css';
import c from './coworker.module.css';

/**
 * The Directory — list-first, one orientation line, view chips, search.
 * A row answers: who is this, what are they for, where do they work, what
 * state are they in.
 */

const DAY = 86_400_000;

export function CoworkerDirectory() {
  useCoworkers();
  const [perspective, setPerspective] = useState<'coworkers' | 'teams'>('coworkers');
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
          {perspective === 'coworkers' ? (
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
          ) : null}
          <input
            className={a.search}
            type="search"
            aria-label={perspective === 'teams' ? 'Search teams' : 'Search coworkers'}
            placeholder={perspective === 'teams' ? 'Search name, archetype' : 'Search name, brief'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {perspective === 'coworkers' ? (
            <Link to={routes.coworkerNew()} className={a.createBtn} data-create-coworker>
              <IconPlus size={12} /> Create Coworker
            </Link>
          ) : null}
        </div>
      </header>

      <div className={a.navRow}>
        <div className={c.navMeta}>
          <div className={c.perspective} role="group" aria-label="Perspective">
            {(['coworkers', 'teams'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={c.perspectiveBtn}
                data-perspective={p}
                aria-pressed={perspective === p}
                onClick={() => setPerspective(p)}
              >
                {p === 'coworkers' ? 'Coworkers' : 'Teams'}
              </button>
            ))}
          </div>
          {perspective === 'coworkers' ? (
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
          ) : null}
        </div>
      </div>

      <div className={a.resultLine}>
        <span className={a.resultCount}>
          {perspective === 'teams'
            ? `${COWORKER_TEAMS.length} teams`
            : `${visible.length} coworker${visible.length === 1 ? '' : 's'}`}
        </span>
        <span className={a.resultNote}>
          {perspective === 'teams'
            ? 'illustrative teams — no assignment or Team runtime'
            : 'prototype data — persists in this browser only'}
        </span>
      </div>

      {perspective === 'teams' ? (
        <TeamGallery query={query} />
      ) : visible.length === 0 ? (
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
        <ul className={c.tileGrid} data-coworker-grid>
          {visible.map((cw) => (
            <li key={cw.id}>
              <Link
                className={c.tileCard}
                to={routes.coworker(cw.id)}
                data-coworker-card={cw.id}
                aria-label={`${cw.name}, ${cw.status}`}
              >
                <span className={c.tilePlate}>
                  <CoworkerAvatar id={cw.id} size={128} />
                </span>
                <span className={[c.tileName, c[`font${avatarFontOf(cw.id)}`]].join(' ')} data-tile-name>
                  {cw.name}
                </span>
                <span className={c.tileBrief} data-tile-brief>
                  <span className={c.tileBriefText}>{cw.responsibilities.forWork || cw.description}</span>
                  <span className={c.tileBriefMeta}>
                    {cw.status} · {cw.memberships.length} workspace{cw.memberships.length === 1 ? '' : 's'}
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
              <Link
                className={[a.row, c.rowHover].join(' ')}
                to={routes.coworker(cw.id)}
                data-coworker-row={cw.id}
              >
                <CoworkerAvatar id={cw.id} size={28} className={c.avatarMark} />
                <span className={a.rowMain}>
                  <span className={[a.rowTitle, c[`font${avatarFontOf(cw.id)}`]].join(' ')}>{cw.name}</span>
                  <span className={[a.rowMeta, c.rowBrief].join(' ')}>
                    {cw.responsibilities.forWork || cw.description}
                  </span>
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
