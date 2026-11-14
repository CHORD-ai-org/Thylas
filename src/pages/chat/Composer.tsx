import { useEffect, useRef, useState } from 'react';
import { AI_MAX_PROMPT, type AiStatusBody } from '../../lib/ai';
import { probe } from '../../services/ai/client';
import { boardsIn, filesIn } from '../../data/selectors';
import { listNotes } from '../../state/notes';
import { useWorkspaces } from '../../state/workspaces';
import { integrationsView, useConnect } from '../../state/connect';
import {
  addContextSource,
  removeContextSource,
  type ContextSource,
  type Conversation,
} from '../../state/chat';
import { IconCheck, IconClose, IconPlus } from '../../components/icons';
import s from './chat.module.css';

/**
 * The Composer: multiline input, context bar, model control, send/stop. The
 * toolbar only exposes what exists — attaching means attaching real workspace
 * materials, and the model list comes from the server's own status answer.
 */

const MODELS = ['deepseek-chat', 'deepseek-reasoner'];

export function Composer({
  conversation,
  streaming,
  onSend,
  onStop,
}: {
  conversation: Conversation;
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  useConnect();

  const [text, setText] = useState('');
  const [status, setStatus] = useState<AiStatusBody | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const overLimit = text.trim().length > AI_MAX_PROMPT;
  const canSend = text.trim().length > 0 && !overLimit && !streaming;

  useEffect(() => {
    let alive = true;
    void probe().then((body) => {
      if (alive) setStatus(body);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* Auto-height, capped by CSS; reset when the conversation switches. */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(216, Math.max(24, el.scrollHeight))}px`;
  }, [text, conversation.id]);

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const model = status?.model ?? null;

  return (
    <div className={[s.composer, 'glass'].join(' ')}>
      <div className={s.composerInner}>
        <ContextBar
          conversation={conversation}
          open={contextOpen}
          setOpen={setContextOpen}
        />

        <div className={s.inputWrap}>
          <button
            type="button"
            className={s.composerAdd}
            aria-label="Add context"
            title="Add context"
            onClick={() => setContextOpen(!contextOpen)}
            data-composer-add
          >
            <IconPlus size={13} />
          </button>
          <textarea
            ref={inputRef}
            className={s.input}
            aria-label="Message"
            placeholder={streaming ? 'Generating… press Stop to keep the partial answer' : 'Ask about this workspace…'}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className={s.send}
            data-streaming={streaming || undefined}
            onClick={streaming ? onStop : submit}
            disabled={!streaming && !canSend}
            aria-label={streaming ? 'Stop generating' : 'Send'}
            title={streaming ? 'Stop' : 'Send (Enter)'}
          >
            {streaming ? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <rect x="4.4" y="4.4" width="7.2" height="7.2" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <path d="M2.8 8h10.4M9.4 4.4 13 8l-3.6 3.6" />
              </svg>
            )}
          </button>
        </div>

        <div className={s.composerFoot}>
          <span className={s.hint}>
            Enter sends · Shift+Enter for a newline
            {overLimit ? ` · ${text.trim().length} characters, over the ${AI_MAX_PROMPT} limit` : ''}
          </span>
          <span className={s.right}>
            {text.trim().length > 6000 ? (
              <span className={s.count} data-over={overLimit || undefined}>
                {text.trim().length}
              </span>
            ) : null}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={s.modelBtn}
                onClick={() => setModelOpen((v) => !v)}
                aria-expanded={modelOpen}
                aria-label="Model"
                data-model-btn
              >
                {model ?? 'endpoint unknown'}
              </button>
              {modelOpen ? (
                <div className={s.modelPopover} role="group" aria-label="Model" data-model-popover>
                  <p className={s.popoverTitle}>Model</p>
                  {MODELS.map((name) => {
                    const pinned = name === model;
                    return (
                      <button
                        key={name}
                        type="button"
                        className={s.modelRow}
                        disabled={!pinned}
                        title={pinned ? undefined : 'The model is pinned by DEEPSEEK_MODEL on the server; switching needs a server change.'}
                        onClick={() => setModelOpen(false)}
                      >
                        {name}
                        {pinned ? <span className={s.modelCheck}><IconCheck size={12} /></span> : null}
                      </button>
                    );
                  })}
                  <p className={s.popoverNote}>
                    {status === null
                      ? 'The endpoint could not be reached to report its model. Sending still works — a failure would say so.'
                      : 'One provider is wired (DeepSeek, server-side key). Other providers are not implemented.'}
                  </p>
                </div>
              ) : null}
            </div>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---- context bar ----------------------------------------------------------- */

function ContextBar({
  conversation,
  open,
  setOpen,
}: {
  conversation: Conversation;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const workspaces = useWorkspaces();
  useConnect();
  const popoverRef = useRef<HTMLDivElement>(null);

  const workspaceSource = conversation.context.find((c) => c.kind === 'workspace');

  const setWorkspace = (name: string, id: string) => {
    if (workspaceSource) removeContextSource(conversation.id, workspaceSource.id);
    addContextSource(conversation.id, { kind: 'workspace', name });
    void id;
    setOpen(false);
  };

  const add = (source: Omit<ContextSource, 'id'>) => {
    addContextSource(conversation.id, source);
    setOpen(false);
  };

  const currentWs = workspaces.find((w) => w.name === workspaceSource?.name) ?? workspaces[0];

  return (
    <div className={s.contextBar}>
      {conversation.context.map((source) => (
        <span key={source.id} className={s.chip} data-kind={source.kind} title={source.detail}>
          {source.name}
          <button
            type="button"
            className={s.chipX}
            aria-label={`Remove ${source.name} from context`}
            onClick={() => removeContextSource(conversation.id, source.id)}
          >
            <IconClose size={9} />
          </button>
        </span>
      ))}
      <button
        type="button"
        className={s.contextAdd}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        data-context-add
      >
        <IconPlus size={11} />
      </button>

      {open ? (
        <div className={[s.popover, 'glass'].join(' ')} ref={popoverRef} data-context-popover>
          <p className={s.popoverTitle}>Workspace</p>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              className={s.popoverRow}
              onClick={() => setWorkspace(ws.name, ws.id)}
            >
              <span className={s.popoverKind}>WS</span>
              {ws.name}
              {workspaceSource?.name === ws.name ? (
                <span className={s.modelCheck}><IconCheck size={12} /></span>
              ) : null}
            </button>
          ))}

          {currentWs ? (
            <>
              <p className={s.popoverTitle} style={{ paddingTop: 8 }}>Notes · {currentWs.name} + personal</p>
              {listNotes()
                .filter((n) => n.scope === 'personal' || n.wsId === currentWs.id)
                .slice(0, 6)
                .map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    className={s.popoverRow}
                    onClick={() => add({ kind: 'note', name: note.title, detail: 'attached as evidence; retrieval is not implemented in this build' })}
                  >
                    <span className={s.popoverKind}>Note</span>
                    <span className={s.convTitle}>{note.title}</span>
                  </button>
                ))}
              <p className={s.popoverTitle} style={{ paddingTop: 8 }}>Files</p>
              {filesIn(currentWs.id)
                .slice(0, 6)
                .map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    className={s.popoverRow}
                    onClick={() => add({ kind: 'file', name: file.name, detail: 'attached as evidence; retrieval is not implemented in this build' })}
                  >
                    <span className={s.popoverKind}>{file.kind.toUpperCase()}</span>
                    <span className={s.convTitle}>{file.name}</span>
                  </button>
                ))}
              {boardsIn(currentWs.id).length > 0 ? (
                <>
                  <p className={s.popoverTitle} style={{ paddingTop: 8 }}>Whiteboards</p>
                  {boardsIn(currentWs.id).map((board) => (
                    <button
                      key={board.id}
                      type="button"
                      className={s.popoverRow}
                      onClick={() => add({ kind: 'board', name: board.name, detail: 'attached as evidence; retrieval is not implemented in this build' })}
                    >
                      <span className={s.popoverKind}>Board</span>
                      <span className={s.convTitle}>{board.name}</span>
                    </button>
                  ))}
                </>
              ) : null}
            </>
          ) : null}

          <p className={s.popoverTitle} style={{ paddingTop: 8 }}>Connected applications</p>
          {integrationsView().length === 0 ? (
            <p className={s.popoverNote}>Nothing is connected. Connect lives outside Chat.</p>
          ) : (
            integrationsView().map((integration) => (
              <button
                key={integration.id}
                type="button"
                className={s.popoverRow}
                onClick={() =>
                  add({
                    kind: 'integration',
                    name: integration.account,
                    detail: 'connected · retrieval not implemented in this build',
                  })
                }
              >
                <span className={s.popoverKind}>App</span>
                <span className={s.convTitle}>{integration.account}</span>
              </button>
            ))
          )}
          <p className={s.popoverNote}>
            No workspace file is accessed automatically.
          </p>
        </div>
      ) : null}
    </div>
  );
}
