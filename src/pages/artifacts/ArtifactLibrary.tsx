import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { KIND_LABEL, type ArtifactKind, type ArtifactStatus } from '../../data/artifacts';
import { artifactsView, useArtifacts } from '../../state/artifacts';
import { PlainLayout } from '../../shell/layouts';
import { Button, EmptyState } from '../../components/ui';
import { IconPlus } from '../../components/icons';
import s from './artifacts.module.css';

/**
 * The Library — the primary entry point. Hybrid layout: one orientation line,
 * view chips, lightweight filters, then the list. Nothing here pretends the
 * taxonomy is a class hierarchy: kinds filter, they do not organize.
 */

type View = 'all' | 'recent' | 'mine' | 'external';

const VIEWS: { id: View; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recent', label: 'Recent' },
  { id: 'mine', label: 'Created by me' },
  { id: 'external', label: 'External' },
];

const KINDS: ArtifactKind[] = ['concept', 'methodology', 'executable', 'product', 'empirical', 'structural', 'external'];
const STATUSES: ArtifactStatus[] = ['draft', 'in-review', 'accepted', 'deprecated'];

const DAY = 86_400_000;

function when(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (60 * 24))}d ago`;
}

export function ArtifactLibrary() {
  useArtifacts();
  const [view, setView] = useState<View>('all');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ArtifactKind | 'all'>('all');
  const [status, setStatus] = useState<ArtifactStatus | 'all'>('all');

  const all = artifactsView();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((a) => {
      if (view === 'recent' && Date.now() - a.updatedAt > 7 * DAY) return false;
      if (view === 'mine' && a.author !== 'Ceaser') return false;
      if (view === 'external' && a.source === 'native') return false;
      if (kind !== 'all' && a.kind !== kind) return false;
      if (status !== 'all' && a.status !== status) return false;
      if (!q) return true;
      return `${a.name} ${a.summary} ${KIND_LABEL[a.kind]}`.toLowerCase().includes(q);
    });
  }, [all, view, kind, status, query]);

  const filtered = view !== 'all' || kind !== 'all' || status !== 'all';

  return (
    <PlainLayout size="console">
      <header className={s.head}>
        <div className={s.headText}>
          <p className={s.eyebrow}>LIBRARY</p>
          <h1 className={s.title}>Artifacts</h1>
          <p className={s.sub}>
            Concepts, methods, tools, products, evidence — the things work produces and
            later work reuses. Prototype data; edits persist in this browser.
          </p>
        </div>
        <div className={s.headActions}>
          <input
            className={s.search}
            type="search"
            aria-label="Search artifacts"
            placeholder="Search name, summary, type"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Link to={routes.artifactNew()} className={s.createBtn} data-create-artifact>
            <IconPlus size={12} /> Create Artifact
          </Link>
        </div>
      </header>

      <div className={s.navRow}>
        <div className={s.chipRow} role="group" aria-label="Views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={[s.chip, view === v.id ? s.chipOn : ''].join(' ')}
              onClick={() => setView(v.id)}
              aria-pressed={view === v.id}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className={s.filterRow}>
          <select
            className={s.select}
            aria-label="Filter by type"
            value={kind}
            onChange={(e) => setKind(e.target.value as ArtifactKind | 'all')}
          >
            <option value="all">All types</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <select
            className={s.select}
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ArtifactStatus | 'all')}
          >
            <option value="all">All statuses</option>
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          {filtered ? (
            <button
              type="button"
              className={s.clear}
              onClick={() => {
                setView('all');
                setKind('all');
                setStatus('all');
              }}
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <div className={s.resultLine}>
        <span className={s.resultCount}>
          {visible.length} artifact{visible.length === 1 ? '' : 's'}
        </span>
        <span className={s.resultNote}>edits persist in this browser only</span>
      </div>

      {visible.length === 0 ? (
        query.trim() !== '' ? (
          <EmptyState
            title="Nothing matches this search"
            hint="Search covers names, summaries and types. Clear it to see the full library."
            action={
              <Button size="sm" onClick={() => setQuery('')}>
                Clear search
              </Button>
            }
          />
        ) : filtered ? (
          <EmptyState
            title="Nothing matches these filters"
            hint="The library holds artifacts across every type — loosen a filter or reset."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setView('all');
                  setKind('all');
                  setStatus('all');
                }}
              >
                Reset filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No artifacts yet"
            hint="Create the first one — an idea, a method, a tool, or a reference to something external."
            action={
              <Link to={routes.artifactNew()} className={s.linkArrow}>
                Create Artifact
              </Link>
            }
          />
        )
      ) : (
        <ul className={s.rows}>
          {visible.map((a) => {
            const external = a.source !== 'native';
            return (
              <li key={a.id}>
                <Link className={s.row} to={routes.artifact(a.id)} data-artifact-row={a.id}>
                  <span className={s.rowMain}>
                    <span className={s.rowTitle}>
                      {a.name}
                      {external ? (
                        <span className={s.externalChip}>{(a.source as { system: string }).system}</span>
                      ) : null}
                    </span>
                    <span className={s.rowMeta}>{a.summary || 'No summary yet.'}</span>
                  </span>
                  <span className={s.rowAside}>
                    <span className={s.kindChip}>{KIND_LABEL[a.kind]}</span>
                    <span className={s.statusChip} data-status={a.status}>
                      {a.status}
                    </span>
                    <span className={s.updated}>{when(a.updatedAt)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PlainLayout>
  );
}
