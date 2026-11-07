import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import { getNote, getWorkspace, notes } from '../data/selectors';
import { useApp, useRegisterTab } from '../state/app';
import { Button, EmptyState, Field } from '../components/ui';
import { IconPlus } from '../components/icons';
import { TabStrip } from '../shell/TabStrip';
import { ContextPanel } from '../shell/ContextPanel';
import g from '../styles/grammar.module.css';
import s from './notes.module.css';

function scopeLabel(n: ReturnType<typeof notes>[number]): string {
  if (n.scope === 'personal') return 'Personal';
  return getWorkspace(n.wsId)?.name ?? 'Workspace';
}

export function NotesPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { panelOpen } = useApp();
  const [scope, setScope] = useState<string>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const note = getNote(noteId);

  useRegisterTab(
    'notes',
    note ? { type: 'note', label: note.title, path: routes.note(note.id) } : null,
  );

  const scopes = useMemo(() => {
    const ids = new Set(notes().map((n) => n.wsId ?? 'personal'));
    return ['all', ...Array.from(ids)];
  }, []);

  const visible = notes().filter((n) => {
    if (scope === 'all') return true;
    if (scope === 'personal') return n.scope === 'personal';
    return n.wsId === scope;
  });

  return (
    <>
      <TabStrip ctx="notes" variant="notes" />
      <div className={s.body}>
        <nav className={s.list} aria-label="Notes" data-scroll-region="notes-list">
          <div className={s.listHead}>
            <h2 className={s.listTitle}>Notes</h2>
            <Button
              size="sm"
              variant="ghost"
              icon={<IconPlus size={12} />}
              onClick={() => setNotice('Note creation needs the notes service. The editor itself is not in this build.')}
              aria-label="New note"
            >
              New
            </Button>
          </div>
          <div className={s.filters}>
            {scopes.map((id) => (
              <button
                key={id}
                type="button"
                className={[s.filter, scope === id ? s.filterOn : ''].join(' ')}
                onClick={() => setScope(id)}
              >
                {id === 'all' ? 'All' : id === 'personal' ? 'Personal' : (getWorkspace(id)?.name ?? id)}
              </button>
            ))}
          </div>
          {notice ? <p className={g.banner}>{notice}</p> : null}
          <ul className={s.noteList}>
            {visible.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={[s.noteRow, n.id === noteId ? s.noteRowOn : ''].join(' ')}
                  onClick={() => navigate(routes.note(n.id))}
                >
                  <span className={s.noteRowTitle}>{n.title}</span>
                  <span className={s.noteRowMeta}>{scopeLabel(n)} · {n.updated}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className={s.listFoot}>One note, one scope. Notes is a lens over every scope you can read.</p>
        </nav>

        <main className={s.readerWrap} data-scroll-region="notes-reader">
          {note ? (
            <article className={s.reader}>
              <p className={s.eyebrow}>
                Note · {scopeLabel(note)}
              </p>
              <h1 className={s.title}>{note.title}</h1>
              <p className={s.meta}>
                Ceaser Zhao · edited {note.updated} · {note.minutes} min read · {note.refs.length} references
              </p>
              <div className={s.rule} />
              <div className={s.prose}>
                {note.body.map((block, i) => {
                  if (block.kind === 'h2') return <h2 key={i} className={s.h2}>{block.text}</h2>;
                  if (block.kind === 'quote')
                    return (
                      <blockquote key={i} className={s.quote}>
                        {block.text}
                      </blockquote>
                    );
                  if (block.kind === 'list')
                    return (
                      <ul key={i} className={s.list2}>
                        {block.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    );
                  if (block.kind === 'code') return <pre key={i} className={s.code}>{block.text}</pre>;
                  return (
                    <p key={i} className={s.p}>
                      {block.text}
                    </p>
                  );
                })}
              </div>
              <p className={s.endMark}>◦</p>
            </article>
          ) : (
            <div className={s.readerEmpty}>
              <EmptyState
                title="Nothing open"
                hint="Pick a note from the list. Notes written inside a workspace are the same objects as the ones here — this is a view, not a second library."
              />
            </div>
          )}
        </main>

        {panelOpen ? (
          <ContextPanel ctx="notes" title={note ? 'Scope' : 'Notes'}>
            {note ? (
              <div className={s.panelInner}>
                <div className={s.panelFields}>
                  <Field label="Home">{scopeLabel(note)}</Field>
                  <Field label="Visible in">Notes{note.scope === 'workspace' ? ` · ${scopeLabel(note)}` : ''}</Field>
                  <Field label="Edited">{note.updated}</Field>
                </div>
                <p className={s.panelNote}>
                  One note, one scope. It appears in two places because it has one owner and two views.
                </p>
                <Button size="sm" onClick={() => setNotice('Moving a note between scopes needs the notes service.')}>
                  Move to…
                </Button>

                <div className={s.panelSection}>
                  <div className={s.panelHead}>References</div>
                  <ul className={s.refList}>
                    {note.refs.map((ref) => (
                      <li key={`${ref.kind}-${ref.id}`} className={s.refRow}>
                        <span className={s.refMark}>{ref.kind === 'file' ? '▤' : '▶'}</span>
                        <span className={s.refLabel}>{ref.label}</span>
                        <span className={s.refMeta}>{ref.meta}</span>
                      </li>
                    ))}
                    {note.refs.length === 0 ? <li className={s.panelNote}>No references in this note.</li> : null}
                  </ul>
                </div>
                {notice ? <p className={s.panelNotice}>{notice}</p> : null}
              </div>
            ) : (
              <p className={s.panelNote}>
                Notes lists every note you can read, with a scope filter. It owns nothing.
              </p>
            )}
          </ContextPanel>
        ) : null}
      </div>
    </>
  );
}
