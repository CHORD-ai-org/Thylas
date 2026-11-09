import { useState } from 'react';
import { createNote, saveNote } from '../../state/notes';
import { IconButton } from '../../components/ui';
import { IconCheck, IconCopy, IconPlus } from '../../components/icons';
import s from './chat.module.css';

/**
 * A fenced code block in an answer, with the two honest actions this build
 * can offer: copy, and Save as note — which writes a real note through the
 * notes store, so persistence is claimed only where it happens.
 */
export function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const [savedAs, setSavedAs] = useState<string | null>(null);

  const copy = () => {
    void navigator.clipboard?.writeText(content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  const save = () => {
    if (savedAs) return;
    const title = lang ? `${lang} snippet` : 'Snippet';
    const note = createNote({ scope: 'personal', title });
    saveNote(note.id, content, 1);
    setSavedAs(note.title);
  };

  return (
    <div className={s.code} data-code-block>
      <div className={s.codeHead}>
        <span>{lang || 'text'}</span>
        <span className={s.turnActions}>
          <IconButton label={copied ? 'Copied' : 'Copy code'} onClick={copy}>
            {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
          </IconButton>
          <IconButton
            label={savedAs ? `Saved as “${savedAs}”` : 'Save as note'}
            onClick={save}
            disabled={savedAs !== null}
            data-save-note
          >
            {savedAs ? <IconCheck size={12} /> : <IconPlus size={12} />}
          </IconButton>
        </span>
      </div>
      <pre className={s.codeText}>{content}</pre>
      {savedAs ? <p className={s.foot}>A real note in your library — open Notes to see it.</p> : null}
    </div>
  );
}
