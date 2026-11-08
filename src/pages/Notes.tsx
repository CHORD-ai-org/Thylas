import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import { relativeTime } from '../lib/relative';
import { getWorkspace } from '../data/selectors';
import { createNote, getNoteById, renameNote, saveNote, useNotes } from '../state/notes';
import type { Note } from '../data/types';
import { useApp, useRegisterTab } from '../state/app';
import { Button, EmptyState, Field } from '../components/ui';
import { IconPlus } from '../components/icons';
import { TabStrip } from '../shell/TabStrip';
import { ContextPanel } from '../shell/ContextPanel';
import { NoteReader } from './notes/NoteReader';
import type { NoteEditorHandle } from './notes/NoteEditor';

/* CodeMirror is 166 KB gzip on its own. Most visits read and never type, so the
   editor is loaded the first time someone presses Edit rather than on every
   page load. The shell stays at 155 KB. */
const NoteEditor = lazy(() => import('./notes/NoteEditor').then((m) => ({ default: m.NoteEditor })));
import g from '../styles/grammar.module.css';
import s from './notes.module.css';

function scopeLabel(note: Note): string {
  return note.scope === 'personal' ? 'Personal' : (getWorkspace(note.wsId)?.name ?? 'Workspace');
}

const scopeOf = (note: Note): string => (note.scope === 'personal' ? 'personal' : (note.wsId ?? ''));

const SAVE_IDLE = 800;

export function NotesPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { panelOpen, markDirty } = useApp();
  const all = useNotes();
  const [scope, setScope] = useState<string>('all');

  const note = noteId ? all.find((n) => n.id === noteId) : undefined;

  useRegisterTab('notes', note ? { type: 'note', label: note.title, path: routes.note(note.id) } : null);

  /* Writing state. The editor owns the document; this component owns the
     promise that it reaches storage, which is the only irreversible failure
     in the product. */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState<'clean' | 'dirty' | 'saved' | 'conflict'>('clean');
  const [conflict, setConflict] = useState<Note | null>(null);
  const [showTheirs, setShowTheirs] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const editor = useRef<NoteEditorHandle | null>(null);
  /* The version this editing session started from. Comparing against the
     *latest* stored version would always succeed — that is how a conflict
     detector silently becomes an overwrite. */
  const baseVersion = useRef(0);

  const scopes = useMemo(() => {
    const ids = new Set(all.map(scopeOf));
    return ['all', ...Array.from(ids)];
  }, [all]);

  const visible = all.filter((n) => scope === 'all' || scopeOf(n) === scope);

  const store = (id: string) => getNoteById(id);

  const flush = (id: string, body: string) => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const current = store(id);
    if (!current) return;
    if (current.body === body) {
      setSaved('clean');
      markDirty(routes.note(id), false);
      return;
    }
    const result = saveNote(id, body, baseVersion.current);
    if (result.ok) {
      baseVersion.current = result.note.version;
      setSaved('saved');
      setConflict(null);
      markDirty(routes.note(id), false);
    } else {
      setConflict(result.theirs);
      setSaved('conflict');
      /* Still unsaved: the tab must keep asking. */
      markDirty(routes.note(id), true);
    }
  };

  const startEdit = () => {
    if (!note) return;
    baseVersion.current = note.version;
    setDraft(note.body);
    setTitleDraft(note.title);
    setTitleError(null);
    setConflict(null);
    setSaved('clean');
    setEditing(true);
  };

  const exitEdit = () => {
    if (note) flush(note.id, draft);
    setEditing(false);
  };

  const onChange = (body: string) => {
    setDraft(body);
    setSaved('dirty');
    if (note) markDirty(routes.note(note.id), true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (note) flush(note.id, body);
    }, SAVE_IDLE);
  };

  const commitTitle = () => {
    if (!note) return;
    const next = titleDraft.trim();
    if (next === note.title) return;
    const result = renameNote(note.id, next);
    if (!result.ok) {
      setTitleError(
        result.reason === 'duplicate'
          ? 'Another note in this scope already has that title.'
          : 'That title is not usable.',
      );
      setTitleDraft(note.title);
      return;
    }
    setTitleError(null);
  };

  /* One prompt while anything is unsaved, and none when it is not. */
  const unsaved = editing && note ? draft !== note.body : false;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  /* Leaving the note abandons the editor, not the text: a pending save is
     flushed before the component that owns the timer goes away. */
  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const addNote = () => {
    const created = createNote(
      scope === 'all' || scope === 'personal'
        ? { scope: 'personal' }
        : { scope: 'workspace', wsId: scope },
    );
    navigate(routes.note(created.id));
    baseVersion.current = created.version;
    setEditing(true);
    setDraft('');
    setTitleDraft(created.title);
    setSaved('clean');
  };

  const words = note && note.body.trim() !== '' ? note.body.trim().split(/\s+/).length : 0;

  const saveLabel =
    saved === 'dirty'
      ? 'Unsaved changes'
      : saved === 'saved'
        ? 'Saved'
        : saved === 'conflict'
          ? 'Not saved — this note changed elsewhere'
          : 'Saved automatically';

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
                  onClick={() => {
                    if (editing && note) flush(note.id, draft);
                    setEditing(false);
                    navigate(routes.note(n.id));
                  }}
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
              <div className={s.readerTools}>
                <p className={s.eyebrow}>Note · {scopeLabel(note)}</p>
                {editing ? (
                  <Button size="sm" onClick={exitEdit}>
                    Done
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={startEdit}>
                    Edit
                  </Button>
                )}
              </div>

              {editing ? (
                <input
                  className={s.titleInput}
                  value={titleDraft}
                  aria-label="Note title"
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitTitle();
                      e.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <h1 className={s.title}>{note.title}</h1>
              )}

              <p className={s.meta} data-save={editing ? saved : undefined}>
                {editing ? saveLabel : `Edited ${relativeTime(note.updatedAt)}`} · {words} words · v
                {note.version}
              </p>

              {titleError ? (
                <p className={g.banner} role="alert">
                  <span>{titleError}</span>
                </p>
              ) : null}

              {conflict ? (
                <div className={s.conflict} role="alert">
                  <p className={s.conflictText}>
                    This note was saved elsewhere while you were writing. Your text is still here —
                    nothing has been overwritten.
                  </p>
                  <div className={s.conflictActions}>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!note) return;
                        const forced = saveNote(note.id, draft, conflict.version);
                        if (forced.ok) {
                          baseVersion.current = forced.note.version;
                          setConflict(null);
                          setSaved('saved');
                          markDirty(routes.note(note.id), false);
                        }
                      }}
                    >
                      Keep mine
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (!note) return;
                        baseVersion.current = conflict.version;
                        setDraft(conflict.body);
                        editor.current?.replaceBody(conflict.body);
                        setConflict(null);
                        setSaved('clean');
                        markDirty(routes.note(note.id), false);
                      }}
                    >
                      Load theirs
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowTheirs((v) => !v)}>
                      {showTheirs ? 'Hide theirs' : 'Show both'}
                    </Button>
                  </div>
                  {showTheirs ? <pre className={s.theirs}>{conflict.body}</pre> : null}
                </div>
              ) : null}

              <div className={s.rule} />

              {editing ? (
                <>
                  <Suspense fallback={<p className={s.editorHint}>Loading the editor…</p>}>
                    <NoteEditor
                      key={note.id}
                      ref={editor}
                      initialBody={note.body}
                      onChange={onChange}
                      onEscape={exitEdit}
                    />
                  </Suspense>
                  <p className={s.editorHint}>
                    Markdown · saves {SAVE_IDLE} ms after you stop typing · <kbd>Esc</kbd> leaves the
                    editor
                  </p>
                </>
              ) : (
                <NoteReader note={note} all={all} onOpen={(id) => navigate(routes.note(id))} />
              )}
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
