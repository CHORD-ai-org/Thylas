import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import { relativeTime } from '../lib/relative';
import { getWorkspace } from '../data/selectors';
import { createNote, useNotes } from '../state/notes';
import type { Note } from '../data/types';
import { useApp, useRegisterTab } from '../state/app';
import { Button, EmptyState, Field } from '../components/ui';
import { IconPlus } from '../components/icons';
import { TabStrip } from '../shell/TabStrip';
import { ContextPanel } from '../shell/ContextPanel';
import { NoteReader } from './notes/NoteReader';
import s from './notes.module.css';

function scopeLabel(note: Note): string {
  return note.scope === 'personal' ? 'Personal' : (getWorkspace(note.wsId)?.name ?? 'Workspace');
}

const scopeOf = (note: Note): string => (note.scope === 'personal' ? 'personal' : (note.wsId ?? ''));

export function NotesPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { panelOpen } = useApp();
  const all = useNotes();
  const [scope, setScope] = useState<string>('all');

  const note = noteId ? all.find((n) => n.id === noteId) : undefined;

  useRegisterTab('notes', note ? { type: 'note', label: note.title, path: routes.note(note.id) } : null);

  const scopes = useMemo(() => {
    const ids = new Set(all.map(scopeOf));
    return ['all', ...Array.from(ids)];
  }, [all]);

  const visible = all.filter((n) => scope === 'all' || scopeOf(n) === scope);

  /* The capability exists now, so the control does what it says: a note is
     created in the scope being looked at and opened. */
  const addNote = () => {
    const created = createNote(
      scope === 'all' || scope === 'personal'
        ? { scope: 'personal' }
        : { scope: 'workspace', wsId: scope },
    );
    navigate(routes.note(created.id));
  };

  const words = note && note.body.trim() !== '' ? note.body.trim().split(/\s+/).length : 0;

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
              onClick={addNote}
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
                aria-pressed={scope === id}
                onClick={() => setScope(id)}
              >
                {id === 'all' ? 'All' : id === 'personal' ? 'Personal' : (getWorkspace(id)?.name ?? id)}
              </button>
            ))}
          </div>
          <ul className={s.noteList}>
            {visible.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={[s.noteRow, n.id === noteId ? s.noteRowOn : ''].join(' ')}
                  aria-current={n.id === noteId ? 'page' : undefined}
                  onClick={() => navigate(routes.note(n.id))}
                >
                  <span className={s.noteRowTitle}>{n.title}</span>
                  <span className={s.noteRowMeta}>
                    {scopeLabel(n)} · {relativeTime(n.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
            {visible.length === 0 ? (
              <li className={s.listEmpty}>No note in this scope yet.</li>
            ) : null}
          </ul>
          <p className={s.listFoot}>
            One note, one scope. Notes is a lens over every scope you can read.
          </p>
        </nav>

        <main className={s.readerWrap} data-scroll-region="notes-reader">
          {note ? (
            <article className={s.reader}>
              <p className={s.eyebrow}>Note · {scopeLabel(note)}</p>
              <h1 className={s.title}>{note.title}</h1>
              <p className={s.meta}>
                Edited {relativeTime(note.updatedAt)} · {words} words · v{note.version}
              </p>
              <div className={s.rule} />
              <NoteReader note={note} all={all} onOpen={(id) => navigate(routes.note(id))} />
            </article>
          ) : (
            <div className={s.readerEmpty}>
              <EmptyState
                title="Nothing open"
                hint="Pick a note from the list, or start one with New. Notes written inside a workspace are the same objects as the ones here — this is a view, not a second library."
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
                  <Field label="Edited">{relativeTime(note.updatedAt)}</Field>
                  <Field label="Length">{words} words</Field>
                  <Field label="Version">{note.version}</Field>
                </div>
                <p className={s.panelNote}>
                  One note, one scope. It appears in two places because it has one owner and two
                  views.
                </p>
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
