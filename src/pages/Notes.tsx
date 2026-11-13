import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import { relativeTime } from '../lib/relative';
import { buildBacklinks, outgoing } from '../lib/markdown/backlinks';
import { getWorkspace } from '../data/selectors';
import { createNote, getNoteById, removeNote, renameNote, saveNote, useNotes } from '../state/notes';
import { isBookmarked, toggleBookmark, useBookmarks } from '../state/bookmarks';
import { setNotesView, toggleNotesPanel, useNotesUi } from '../state/notesUi';
import type { Note } from '../data/types';
import { useApp, useRegisterTab } from '../state/app';
import { Button, EmptyState, Field } from '../components/ui';
import { IconBookmark, IconPlus, IconSearch, IconFiles } from '../components/icons';
import { TabStrip } from '../shell/TabStrip';
import { ContextPanel } from '../shell/ContextPanel';
import { NoteReader } from './notes/NoteReader';
import type { NoteEditorHandle } from './notes/NoteEditor';
import g from '../styles/grammar.module.css';
import s from './notes.module.css';

/* CodeMirror is 174 KB gzip on its own. Most visits read and never type, so the
   editor is loaded the first time someone presses Edit rather than on every
   page load. The shell stays at 157 KB. */
const NoteEditor = lazy(() => import('./notes/NoteEditor').then((m) => ({ default: m.NoteEditor })));

function scopeLabel(note: Note): string {
  return note.scope === 'personal' ? 'Personal' : (getWorkspace(note.wsId)?.name ?? 'Workspace');
}

const scopeOf = (note: Note): string => (note.scope === 'personal' ? 'personal' : (note.wsId ?? ''));

const SAVE_IDLE = 800;
const SEARCH_IDLE = 200;

export function NotesPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { panelOpen, markDirty } = useApp();
  const all = useNotes();
  useBookmarks();
  const ui = useNotesUi();
  const [scope, setScope] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  /* The Search view owns its own term: typing there must not filter the Files
     list out from under the user. */
  const [findQuery, setFindQuery] = useState('');

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
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query), SEARCH_IDLE);
    return () => window.clearTimeout(handle);
  }, [query]);

  const needle = debounced.trim().toLowerCase();
  const visible = all.filter((n) => {
    if (scope !== 'all' && scopeOf(n) !== scope) return false;
    if (needle === '') return true;
    return n.title.toLowerCase().includes(needle) || n.body.toLowerCase().includes(needle);
  });

  const findNeedle = findQuery.trim().toLowerCase();
  const searchResults = findNeedle === '' ? [] : all.filter((n) =>
    n.title.toLowerCase().includes(findNeedle) || n.body.toLowerCase().includes(findNeedle));

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

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const openNote = (id: string) => {
    if (editing && note) flush(note.id, draft);
    setEditing(false);
    setConfirmDelete(false);
    navigate(routes.note(id));
  };

  const addNote = (title?: string) => {
    const created = createNote(
      title === undefined
        ? scope === 'all' || scope === 'personal'
          ? { scope: 'personal' }
          : { scope: 'workspace', wsId: scope }
        : note
          ? { scope: note.scope, ...(note.wsId === undefined ? {} : { wsId: note.wsId }), title }
          : { scope: 'personal', title },
    );
    navigate(routes.note(created.id));
    baseVersion.current = created.version;
    setEditing(true);
    setDraft('');
    setTitleDraft(created.title);
    setSaved('clean');
  };

  const deleteNote = () => {
    if (!note) return;
    markDirty(routes.note(note.id), false);
    removeNote(note.id);
    setEditing(false);
    navigate(routes.notes());
  };

  /* Arrow keys move between rows: a list of six buttons should not cost six
     Tabs (audit A8). */
  const onListKeys = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-note-row]')];
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (at === -1) return;
    e.preventDefault();
    const next = e.key === 'ArrowDown' ? Math.min(rows.length - 1, at + 1) : Math.max(0, at - 1);
    rows[next]?.focus();
  };

  const backlinkIds = note ? (buildBacklinks(all).get(note.id) ?? []) : [];
  const incoming = backlinkIds
    .map((id) => all.find((n) => n.id === id))
    .filter((n): n is Note => n !== undefined);
  const outgoingNotes = note
    ? outgoing(note, all)
        .map((id) => all.find((n) => n.id === id))
        .filter((n): n is Note => n !== undefined)
    : [];
  const linkTitles = note
    ? all.filter((n) => scopeOf(n) === scopeOf(note) && n.id !== note.id).map((n) => n.title)
    : [];

  const words = note && note.body.trim() !== '' ? note.body.trim().split(/\s+/).length : 0;

  const saveLabel =
    saved === 'dirty'
      ? 'Unsaved changes'
      : saved === 'saved'
        ? 'Saved'
        : saved === 'conflict'
          ? 'Not saved — this note changed elsewhere'
          : 'Saved automatically';

  const emptyMessage = needle
    ? `No note matches “${debounced.trim()}” in ${scope === 'all' ? 'any scope' : (getWorkspace(scope)?.name ?? 'Personal')}.`
    : 'No note in this scope yet.';

  /* Ctrl/Cmd + Shift + B toggles this panel. Ctrl+\ already belongs to the
     global rail — sharing it would move both surfaces at once. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleNotesPanel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const bookmarked = all.filter((n) => isBookmarked(n.id));

  /** One row grammar for every sidebar view. The row stays a button — arrow
      keys, tab order and the e2e journey all depend on `data-note-row`. */
  const noteRows = (list: Note[], _unused?: undefined) => (
    <ul className={s.noteList} onKeyDown={onListKeys} aria-label="Note list">
      {list.map((n, i) => (
        <li key={n.id} className={s.noteRowWrap}>
          <button
            type="button"
            data-note-row
            tabIndex={n.id === noteId || (noteId === undefined && i === 0) ? 0 : -1}
            className={[s.noteRow, n.id === noteId ? s.noteRowOn : ''].join(' ')}
            aria-current={n.id === noteId ? 'page' : undefined}
            onClick={() => openNote(n.id)}
          >
            <span className={s.noteRowTitle}>{n.title}</span>
            <span className={s.noteRowMeta}>{scopeLabel(n)} · {relativeTime(n.updatedAt)}</span>
          </button>
          <button
            type="button"
            className={[s.starBtn, isBookmarked(n.id) ? s.starBtnOn : ''].join(' ')}
            aria-label={isBookmarked(n.id) ? `Remove ${n.title} from bookmarks` : `Bookmark ${n.title}`}
            title={isBookmarked(n.id) ? 'Remove bookmark' : 'Add bookmark'}
            onClick={() => toggleBookmark(n.id)}
          >
            {isBookmarked(n.id) ? '★' : '☆'}
          </button>
        </li>
      ))}
      {list.length === 0 ? <li className={s.listEmpty}>{emptyMessage}</li> : null}
    </ul>
  );

  return (
    <>
      <TabStrip ctx="notes" variant="notes" />
      <div className={s.body}>
        <nav className={s.navRail} aria-label="Notes sidebar" data-notes-rail>
          <button
            type="button"
            className={[s.navBtn, ui.view === 'files' ? s.navBtnOn : ''].join(' ')}
            aria-label="Files"
            aria-pressed={ui.view === 'files'}
            title="Files"
            onClick={() => setNotesView('files')}
            data-notes-view="files"
          >
            <IconFiles size={15} />
          </button>
          <button
            type="button"
            className={[s.navBtn, ui.view === 'search' ? s.navBtnOn : ''].join(' ')}
            aria-label="Search"
            aria-pressed={ui.view === 'search'}
            title="Search"
            onClick={() => setNotesView('search')}
            data-notes-view="search"
          >
            <IconSearch size={15} />
          </button>
          <button
            type="button"
            className={[s.navBtn, ui.view === 'bookmarks' ? s.navBtnOn : ''].join(' ')}
            aria-label="Bookmarks"
            aria-pressed={ui.view === 'bookmarks'}
            title="Bookmarks"
            onClick={() => setNotesView('bookmarks')}
            data-notes-view="bookmarks"
          >
            <IconBookmark size={15} />
          </button>
          <button
            type="button"
            className={s.navCollapse}
            aria-label={ui.collapsed ? 'Expand notes panel' : 'Collapse notes panel'}
            aria-expanded={!ui.collapsed}
            title="Toggle sidebar (Ctrl+\)"
            onClick={toggleNotesPanel}
            data-notes-toggle
          >
            {ui.collapsed ? '»' : '«'}
          </button>
        </nav>

        {!ui.collapsed ? (
          <div className={s.list} aria-label="Notes" data-scroll-region="notes-list" data-notes-panel>
            {ui.view === 'files' ? (
              <>
                <div className={s.listHead}>
                  <h2 className={s.listTitle}>Notes</h2>
                  <Button size="sm" variant="ghost" icon={<IconPlus size={12} />} onClick={() => addNote()} aria-label="New note">
                    New
                  </Button>
                </div>
                <input
                  className={s.search}
                  type="search"
                  value={query}
                  placeholder="Search titles and text…"
                  aria-label="Search notes"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }}
                />
                <div className={s.filters}>
                  {scopes.map((id) => (
                    <button key={id} type="button" className={[s.filter, scope === id ? s.filterOn : ''].join(' ')} aria-pressed={scope === id} onClick={() => setScope(id)}>
                      {id === 'all' ? 'All' : id === 'personal' ? 'Personal' : (getWorkspace(id)?.name ?? id)}
                    </button>
                  ))}
                </div>
                {noteRows(visible, undefined)}
                <p className={s.listFoot}>{visible.length} of {all.length} notes · {scope === 'all' ? 'every scope you can read' : (getWorkspace(scope)?.name ?? 'Personal')}</p>
              </>
            ) : null}

            {ui.view === 'search' ? (
              <>
                <div className={s.listHead}><h2 className={s.listTitle}>Search</h2></div>
                <input
                  className={s.search}
                  type="search"
                  value={findQuery}
                  placeholder="Titles and text…"
                  aria-label="Find in notes"
                  onChange={(e) => setFindQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setFindQuery(''); }}
                />
                {findQuery.trim() !== '' ? noteRows(searchResults, undefined) : (
                  <p className={s.listEmpty}>Type to search note titles and text.</p>
                )}
              </>
            ) : null}

            {ui.view === 'bookmarks' ? (
              <>
                <div className={s.listHead}><h2 className={s.listTitle}>Bookmarks</h2></div>
                {bookmarked.length === 0 ? (
                  <p className={s.listEmpty}>No bookmarks yet. Star a note to keep it here.</p>
                ) : noteRows(bookmarked, undefined)}
              </>
            ) : null}
          </div>
        ) : null}

        <main className={s.readerWrap} data-scroll-region="notes-reader">
          {note ? (
            <article className={s.reader}>
              <div className={s.readerTools}>
                <p className={s.eyebrow}>Note · {scopeLabel(note)}</p>
                <div className={s.readerActions}>
                  <button
                    type="button"
                    className={[s.starBtn, isBookmarked(note.id) ? s.starBtnOn : ''].join(' ')}
                    aria-label={isBookmarked(note.id) ? 'Remove bookmark' : 'Add bookmark'}
                    title={isBookmarked(note.id) ? 'Remove bookmark' : 'Add bookmark'}
                    onClick={() => toggleBookmark(note.id)}
                    data-note-star
                  >
                    {isBookmarked(note.id) ? '★' : '☆'}
                  </button>
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
                      linkTitles={linkTitles}
                    />
                  </Suspense>
                  <p className={s.editorHint}>
                    Markdown · saves {SAVE_IDLE} ms after you stop typing · type <kbd>[[</kbd> to link
                    a note · <kbd>Esc</kbd> leaves the editor
                  </p>
                </>
              ) : (
                <NoteReader
                  note={note}
                  all={all}
                  onOpen={openNote}
                  onCreate={(title) => addNote(title)}
                />
              )}
            </article>
          ) : (
            <div className={s.readerEmpty}>
              <EmptyState
                title={needle ? 'Nothing matches' : 'Nothing open'}
                hint={
                  needle
                    ? `No note matches “${debounced.trim()}”. Clear the search, or widen the scope.`
                    : 'Pick a note from the list, or start one with New. Notes written inside a workspace are the same objects as the ones here — this is a view, not a second library.'
                }
              />
            </div>
          )}
        </main>

        {panelOpen ? (
          <ContextPanel ctx="notes" title={note ? 'Note' : 'Notes'}>
            {note ? (
              <div className={s.panelInner}>
                <div className={s.panelFields}>
                  <Field label="Home">{scopeLabel(note)}</Field>
                  <Field label="Edited">{relativeTime(note.updatedAt)}</Field>
                  <Field label="Length">{words} words</Field>
                  <Field label="Version">{note.version}</Field>
                </div>

                <div className={s.panelSection}>
                  <div className={s.panelHead}>Links out ({outgoingNotes.length})</div>
                  {outgoingNotes.length === 0 ? (
                    <p className={s.panelNote}>
                      This note names no other note yet. Type <kbd>[[</kbd> in the editor to link one.
                    </p>
                  ) : (
                    <ul className={s.linkList}>
                      {outgoingNotes.map((n) => (
                        <li key={n.id}>
                          <button type="button" className={s.linkRow} onClick={() => openNote(n.id)}>
                            <span className={s.linkTitle}>{n.title}</span>
                            <span className={s.linkMeta}>{scopeLabel(n)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={s.panelSection}>
                  <div className={s.panelHead}>Linked from ({incoming.length})</div>
                  {incoming.length === 0 ? (
                    <p className={s.panelNote}>Nothing links here yet.</p>
                  ) : (
                    <ul className={s.linkList}>
                      {incoming.map((n) => (
                        <li key={n.id}>
                          <button type="button" className={s.linkRow} onClick={() => openNote(n.id)}>
                            <span className={s.linkTitle}>{n.title}</span>
                            <span className={s.linkMeta}>{scopeLabel(n)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={s.panelSection}>
                  <div className={s.panelHead}>Delete</div>
                  {confirmDelete ? (
                    <div className={s.deleteRow}>
                      <p className={s.panelNote}>This note is removed from this browser. There is no undo.</p>
                      <Button size="sm" variant="ghost" onClick={deleteNote}>
                        Delete permanently
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                        Keep it
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
                      Delete note…
                    </Button>
                  )}
                </div>
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
