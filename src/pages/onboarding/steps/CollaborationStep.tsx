import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  outlineToText,
  suggestedTask,
  templateOf,
  type Outline,
} from '../../../lib/onboarding';
import type { StepProps } from '../types';
import s from '../onboarding.module.css';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* clipboard permission is optional; the textarea below still works */
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

function ArtifactGlyph({ path }: { path: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

function ArtifactPane({ state, patch, outline }: { state: StepProps['state']; patch: StepProps['patch']; outline: Outline | null }) {
  /** `manual` is a real fallback: some embedded browsers refuse the clipboard,
      so the outline is shown as selectable text instead of a dead button. */
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const template = templateOf(state.templateId);
  const workspace = state.workspaceName.trim() || 'the workspace';

  if (!outline) {
    return (
      <aside className={s.artifactPane} data-ob-artifact="empty">
        <p className={s.artifactEyebrow}>Retained output / none yet</p>
        <div className={s.artifactEmpty}>
          Run the suggested task. Your Coworker's first output appears here as a structured
          artifact, not a chat message.
        </div>
      </aside>
    );
  }

  return (
    <aside className={s.artifactPane} data-ob-artifact="ready">
      <p className={s.artifactEyebrow}>Retained output / 01</p>
      <div className={s.artifactHead}>
        <span className={s.artifactGlyph}><ArtifactGlyph path={template.glyph} /></span>
        <div>
          <p className={s.artifactTitle} data-ob-artifact-title>{outline.title}</p>
          <p className={s.artifactKind}>{outline.output} · structured artifact</p>
        </div>
      </div>
      <div className={s.artifactMeta}>
        by {outline.author} · {workspace}
        <br />
        status: {state.kept ? 'retained' : 'preview'} · {outline.sections.length} sections
      </div>
      <div className={s.artifactBody}>
        <div className={s.outline} aria-live="polite">
          {outline.sections.map((section) => (
            <div className={s.outlineSection} key={section.title}>
              <p className={s.outlineTitle}>{section.title}</p>
              <ul className={s.outlineLines}>
                {section.lines.slice(0, 2).map((line, i) => <li key={i}>- {line}</li>)}
                {section.lines.length > 2 ? (
                  <li className={s.outlineMore}>+ {section.lines.length - 2} more in the full outline</li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
        {copyState === 'manual' ? (
          <textarea
            className={s.copyFallback}
            data-ob-copy-fallback
            aria-label="Outline text — select and copy"
            readOnly
            autoFocus
            rows={6}
            value={outlineToText(outline)}
            onFocus={(e) => e.currentTarget.select()}
          />
        ) : null}
      </div>
      <div className={s.artifactActions}>
        <button
          type="button"
          className={[s.smallButton, state.kept ? s.smallButtonOn : ''].join(' ').trim()}
          aria-pressed={state.kept}
          data-ob-keep
          onClick={() => patch({ kept: !state.kept })}
        >
          {state.kept ? 'Kept in workspace' : `Keep in ${workspace}`}
        </button>
        <button
          type="button"
          className={s.smallButton}
          data-ob-copy
          onClick={async () => {
            const ok = await copyText(outlineToText(outline));
            if (!ok) return setCopyState('manual');
            setCopyState('copied');
            window.setTimeout(() => setCopyState('idle'), 1600);
          }}
        >
          {copyState === 'copied' ? 'Copied' : copyState === 'manual' ? 'Try copy again' : 'Copy outline'}
        </button>
      </div>
    </aside>
  );
}

export function CollaborationStep({ state, patch, collab, actions }: StepProps) {
  const [draft, setDraft] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const template = templateOf(state.templateId);

  /* A conversation follows its latest turn. Without this, a new reply would
     arrive as a half-visible line behind the thread's bottom edge. */
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [collab.messages.length, collab.phase]);
  const coworker = state.coworkerName.trim() || template.name;
  const task = suggestedTask(state);

  const send = () => {
    const text = draft.trim();
    if (!text || collab.phase === 'working') return;
    actions.sendDirection(text);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      send();
    }
  };

  return (
    <>
      <h2 className={s.stepTitle}>A first piece of work, together.</h2>

      <div className={s.collabLayout}>
        <div className={s.thread}>
          <div className={s.threadHead}>
            <span className={s.avatar}><ArtifactGlyph path={template.glyph} /></span>
            <div>
              <p className={s.threadName} data-ob-thread-name>{coworker}</p>
              <p className={s.threadRole}>
                {template.name} · {state.workspaceName.trim() || 'your workspace'}
              </p>
            </div>
            <span className={s.simTag}>simulated</span>
          </div>

          <div className={s.messages} aria-live="polite" ref={messagesRef}>
            {collab.messages.map((message) =>
              message.from === 'system' ? (
                <div className={s.working} key={message.id} role="status" data-ob-working>
                  <span className={s.workingBar}><span className={s.workingFill} /></span>
                  Preparing a structured output
                </div>
              ) : (
                <div
                  className={[s.msg, message.from === 'user' ? s.msgUser : ''].join(' ').trim()}
                  key={message.id}
                  data-ob-message={message.from}
                >
                  <p className={s.msgBy}>{message.from === 'user' ? 'You' : coworker}</p>
                  <p className={s.msgBody}>{message.text}</p>
                </div>
              ),
            )}
          </div>

          <div className={s.suggestionWrap}>
            <div className={s.suggestion}>
              <p className={s.suggestionText} data-ob-task>{task}</p>
              <button
                type="button"
                className={s.runButton}
                data-ob-run-task
                disabled={collab.phase === 'working'}
                onClick={actions.runTask}
              >
                {collab.phase === 'idle' ? 'Run this task' : 'Run again'} →
              </button>
            </div>
          </div>

          <div className={s.composer}>
            <input
              className={s.composerInput}
              data-ob-composer
              aria-label="Add direction for your coworker"
              placeholder={collab.phase === 'working' ? 'Working…' : 'Tell your Coworker what to change…'}
              value={draft}
              maxLength={180}
              disabled={collab.phase === 'working'}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              type="button"
              className={s.sendButton}
              data-ob-send
              disabled={draft.trim() === '' || collab.phase === 'working'}
              onClick={send}
            >
              Send
            </button>
          </div>
        </div>

        <ArtifactPane state={state} patch={patch} outline={collab.outline} />
      </div>
    </>
  );
}
