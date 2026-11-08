import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';

export type NoteEditorHandle = {
  /** Replaces the document without emitting a change (used when loading theirs). */
  replaceBody: (text: string) => void;
  focus: () => void;
};

type Props = {
  initialBody: string;
  onChange: (body: string) => void;
  /** Esc leaves the editor. Without this, Tab indents and the keyboard is trapped. */
  onEscape: () => void;
};

/**
 * Markdown source, in the same measure as the reader so switching does not
 * reflow. Styling comes from CSS variables, so the type contract stays the
 * single source of truth: no font sizes are written here.
 */
export const NoteEditor = forwardRef<NoteEditorHandle, Props>(function NoteEditor(
  { initialBody, onChange, onEscape },
  ref,
) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);

  /* React owns nothing about the document after mount: CodeMirror does, and
     pushing every keystroke through state would re-create the editor. */
  const change = useRef(onChange);
  change.current = onChange;
  const escape = useRef(onEscape);
  escape.current = onEscape;

  useEffect(() => {
    if (!host.current) return;
    const theme = EditorView.theme({
      /* Every layer CM6 paints gets an explicit transparent background: its base
         theme fills the editor with white, which turns the page into a box. */
      '&': {
        fontSize: '16px',
        lineHeight: '26px',
        color: 'var(--ink)',
        backgroundColor: 'transparent',
        minHeight: '260px',
      },
      /* No box on focus: an outline around a 600px document reads as a panel,
         and the caret plus the selection already say where focus is. */
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': {
        fontFamily: 'var(--ui)',
        lineHeight: '26px',
        overflow: 'visible',
        backgroundColor: 'transparent',
      },
      '.cm-content': { padding: '0', caretColor: 'var(--accent)', backgroundColor: 'transparent' },
      '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
      '.cm-line': { padding: '0' },
      '.cm-cursor': { borderLeftColor: 'var(--accent)' },
      '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(181, 111, 80, 0.16)' },
      '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(181, 111, 80, 0.2)' },
      '.cm-activeLine': { backgroundColor: 'transparent' },
      '.cm-placeholder': { color: 'var(--ink-3)' },
    });

    const instance = new EditorView({
      state: EditorState.create({
        doc: initialBody,
        extensions: [
          history(),
          markdown(),
          EditorView.lineWrapping,
          theme,
          EditorView.contentAttributes.of({
            'aria-label': 'Note body, Markdown',
            'aria-multiline': 'true',
            spellcheck: 'true',
          }),
          /* Highest precedence: Escape must win over any default binding, and
             Tab indents on purpose — Escape is the documented way out. */
          Prec.highest(
            keymap.of([
              {
                key: 'Escape',
                run: () => {
                  escape.current();
                  return true;
                },
              },
            ]),
          ),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) change.current(update.state.doc.toString());
          }),
        ],
      }),
      parent: host.current,
    });
    view.current = instance;
    return () => {
      instance.destroy();
      view.current = null;
    };
    /* Mounted once per note: the caller keys this component on the note id, so
       a different note is a different instance. Re-running on every prop change
       would rebuild the document and lose the cursor. */
  }, []);

  useImperativeHandle(ref, () => ({
    replaceBody(text: string) {
      const instance = view.current;
      if (!instance || instance.state.doc.toString() === text) return;
      instance.dispatch({ changes: { from: 0, to: instance.state.doc.length, insert: text } });
    },
    focus() {
      view.current?.focus();
    },
  }));

  return <div className="cm-host" ref={host} />;
});
