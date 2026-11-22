import { useEffect, useMemo, useRef, useState } from 'react';
import { AI_MAX_PROMPT, selectionLabel, type AiStatusBody } from '../../lib/ai';
import { boardsIn, filesIn } from '../../data/selectors';
import { listNotes } from '../../state/notes';
import { useWorkspaces } from '../../state/workspaces';
import { integrationsView, useConnect } from '../../state/connect';
import { chooseAiModel, useAiSelection, useAiStatus } from '../../state/ai';
import {
  addContextSource,
  removeContextSource,
  type ContextSource,
  type Conversation,
} from '../../state/chat';
import { parseInvokeToken, toContextSource, type InvokeToken } from '../../lib/invoke';
import { InvokePalette, invokeItems, useInvokeItems } from './InvokePalette';
import { IconCheck, IconClose, IconPlus } from '../../components/icons';
import s from './chat.module.css';

/**
 * The Composer: multiline input, context bar, model control, send/stop. The
 * toolbar only exposes what exists — attaching means attaching real workspace
 * materials, and the model list comes from the server's own status answer.
 *
 * `@` (objects) and `/` (actions) open the invocation palette (P0-1/P0-2).
 * Selecting a bindable object inserts a context binding — a chip, never a
 * half-written token; a non-bindable object becomes a plain-text mention. On a
 * draft, bindings wait in a visible chip row and are applied to the conversation
 * the first send creates.
 */

export function Composer({
  conversation,
  streaming,
  onSend,
  onStop,
  draft = false,
}: {
  conversation: Conversation;
  streaming: boolean;
  onSend: (text: string, binds: Omit<ContextSource, 'id'>[]) => void;
  onStop: () => void;
  /** No conversation exists yet: the first send creates one. Bindings made
      while drafting are applied at that moment, not dropped. */
  draft?: boolean;
}) {
  useConnect();

  const [text, setText] = useState('');
  const status: AiStatusBody | null = useAiStatus();
  const selection = useAiSelection();
  const [contextOpen, setContextOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const overLimit = text.trim().length > AI_MAX_PROMPT;
  const canSend = text.trim().length > 0 && !overLimit && !streaming;

  /* ---- invocation (P0-1..P0-3) ---- */
  const [invoke, setInvoke] = useState<{ token: InvokeToken; caret: number } | null>(null);
  const [cursor, setCursor] = useState(0);
  const [pending, setPending] = useState<Omit<ContextSource, 'id'>[]>([]);
  const [usage, setUsage] = useState<string[]>([]);
  const items = useInvokeItems();
  const workspaces = useWorkspaces();

  const scope = useMemo(() => {
    const bound = conversation.context.find((c) => c.kind === 'workspace');
    return workspaces.find((w) => w.name === bound?.name)?.id ?? workspaces[0]?.id ?? 'personal';
  }, [conversation.context, workspaces]);

  const matches = useMemo(
    () =>
      invoke
        ? invokeItems(
            {
              token: invoke.token.query,
              group: invoke.token.trigger === '/' ? 'action' : 'all',
              scope,
            },
            items,
            usage,
          )
        : [],
    [invoke, items, usage, scope],
  );

  const syncInvoke = (el: HTMLTextAreaElement) => {
    const token = parseInvokeToken(el.value, el.selectionStart ?? el.value.length);
    setInvoke(token ? { token, caret: el.selectionStart ?? el.value.length } : null);
    setCursor(0);
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(216, Math.max(24, el.scrollHeight))}px`;
  }, [text, conversation.id]);

  const focusAt = (position: number) => {
    window.requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(position, position);
    });
  };

  const pick = (id: string) => {
    const item = matches.find((m) => `${m.group}:${m.id}` === id) ?? matches[cursor];
    if (!item || !invoke) return;
    const { start, query } = invoke.token;
    const after = text.slice(invoke.caret);
    const src = toContextSource(item);
    setUsage((prev) => [item.id, ...prev.filter((u) => u !== item.id)].slice(0, 20));
    setInvoke(null);
    if (src) {
      /* A finished binding: the token text is consumed, the chip carries the
         reference (the "never leave a half-written token" rule). */
      if (draft) setPending((prev) => [...prev, src]);
      else addContextSource(conversation.id, src);
      const next = text.slice(0, start) + after;
      setText(next);
      focusAt(start);
    } else {
      /* No binding shape for this kind yet (coworker/gsc/action): a plain
         mention in the text, which is exactly what it can be today. */
      const mention = `${invoke.token.trigger}${item.label} `;
      setText(text.slice(0, start) + mention + after);
      focusAt(start + mention.length);
    }
    void query;
  };

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), draft ? pending : []);
    setText('');
    setPending([]);
    setInvoke(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (invoke && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => (c + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => (c - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(`${matches[cursor]!.group}:${matches[cursor]!.id}`);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setInvoke(null);
        return;
      }
    } else if (invoke && e.key === 'Escape') {
      e.preventDefault();
      setInvoke(null);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const providers = status?.providers ?? [];
  const model = selection ? selectionLabel(selection) : (status?.model ?? null);

  return (
    <div className={[s.composer, 'glass'].join(' ')}>
      <div className={s.composerInner}>
        {draft && pending.length > 0 ? (
          <div className={s.contextBar} data-invoke-pending>
            {pending.map((source, index) => (
              <span key={`${source.name}:${index}`} className={s.chip} data-kind={source.kind} title="Binds to the new conversation when you send">
                {source.name}
                <button
                  type="button"
                  className={s.chipX}
                  aria-label={`Remove ${source.name} from context`}
                  onClick={() => setPending((prev) => prev.filter((_, i) => i !== index))}
                >
                  <IconClose size={9} />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {draft ? null : (
          <ContextBar conversation={conversation} open={contextOpen} setOpen={setContextOpen} />
        )}

        <div className={s.inputWrap}>
          {draft ? null : (
            <button
              type="button"
              className={s.composerAdd}
              aria-label="Add context"
              title="Add context"
              onClick={() => setContextOpen(!contextOpen)}
              data-composer-add
              data-context-add
            >
              <IconPlus size={13} />
            </button>
          )}
          <textarea
            ref={inputRef}
            className={s.input}
            aria-label="Message"
            placeholder={streaming ? 'Generating… press Stop to keep the partial answer' : 'Ask about this workspace…  @ to reference'}
            rows={1}
            value={text}
            data-composer-input
            onChange={(e) => {
              setText(e.target.value);
              syncInvoke(e.currentTarget);
            }}
            onSelect={(e) => syncInvoke(e.currentTarget)}
            onKeyUp={(e) => syncInvoke(e.currentTarget)}
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
          {invoke ? (
            <InvokePalette
              items={matches}
              cursor={Math.min(cursor, Math.max(0, matches.length - 1))}
              onPick={(item) => pick(`${item.group}:${item.id}`)}
              onHover={setCursor}
            />
          ) : null}
        </div>

        <div className={s.composerFoot}>
          <span className={s.hint}>
            Enter sends · Shift+Enter for a newline · @ references
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
                  {providers.length === 0 ? (
                    <p className={s.popoverNote}>
                      The endpoint could not be reached to report its providers. Sending still works — a failure would say so.
                    </p>
                  ) : (
                    providers.map((provider) => (
                      <div key={provider.id}>
                        <p className={s.modelGroup}>{provider.label}</p>
                        {provider.models.map((name) => {
                          const picked = selection?.provider === provider.id && selection.model === name;
                          return (
                            <button
                              key={name}
                              type="button"
                              className={s.modelRow}
                              disabled={!provider.configured}
                              title={
                                provider.configured
                                  ? undefined
                                  : `${provider.label} has no key on this server.`
                              }
                              onClick={() => {
                                chooseAiModel({ provider: provider.id, model: name });
                                setModelOpen(false);
                              }}
                            >
                              {name}
                              {picked ? <span className={s.modelCheck}><IconCheck size={12} /></span> : null}
                            </button>
                          );
                        })}
                        {!provider.configured ? (
                          <p className={s.modelNote}>Not configured on this server.</p>
                        ) : null}
                      </div>
                    ))
                  )}
                  <p className={s.popoverNote}>
                    {status === null
                      ? 'The endpoint could not be reached to report its model. Sending still works — a failure would say so.'
                      : 'Keys stay on the server. A provider without a key cannot be selected.'}
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

  /* The bar exists only to hold chips (and to anchor the picker). With no
     context it collapses to zero height: the pill's own "+" is the one add
     control — two of them sat one above the other and looked like a bug. */
  const bare = conversation.context.length === 0;

  return (
    <div className={[s.contextBar, bare ? s.contextBarBare : ''].join(' ')} data-context-bar>
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
