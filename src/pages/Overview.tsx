import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import {
  STATE_LABEL,
  STATE_TONE,
  getFile,
  getWorkspace,
  needsInput,
  pendingLede,
  recent,
} from '../data/selectors';
import type { Process, RecentItem, RecentKind } from '../data/types';
import { USER } from '../data/mock';
import { AI_MAX_PROMPT, type AiErr, type AiStatusBody } from '../lib/ai';
import { ask, probe } from '../services/ai/client';
import type { Answer } from '../services/ai/types';
import { useApp } from '../state/app';
import { useWorkspaces } from '../state/workspaces';
import { WorkspaceGrid } from './workspaces/WorkspaceGrid';
import {
  Button,
  Chip,
  EmptyState,
  NoteGlyph,
  ProcessGlyph,
  SectionLabel,
  StatusDot,
  TypeGlyph,
} from '../components/ui';
import { IconAnswer, IconArrow, IconBoards } from '../components/icons';
import { PlainLayout } from '../shell/layouts';
import g from '../styles/grammar.module.css';
import s from './overview.module.css';

const KIND_LABEL: Record<RecentKind, string> = {
  file: 'File',
  note: 'Note',
  board: 'Whiteboard',
  process: 'Process',
};

/** The question that put a run into needs_input, not the last tool log line. */
function question(run: Process): string {
  const state = [...run.events].reverse().find((e) => e.kind === 'state');
  const text = (state ?? run.events[run.events.length - 1])?.text ?? '';
  return text.split(' · ')[1] ?? text ?? 'asked a question';
}

function glyph(item: RecentItem) {
  if (item.kind === 'file') return <TypeGlyph kind={getFile(item.id)?.kind ?? 'txt'} />;
  if (item.kind === 'note') return <NoteGlyph />;
  if (item.kind === 'process') return <ProcessGlyph />;
  return <IconBoards size={13} />;
}

type AskState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'done'; answer: Answer }
  | { status: 'error'; error: AiErr };

/**
 * What the reader can do about each kind, kept apart from the server's
 * `message`: the server says what happened, this says what to do next. It is
 * the only place that knows a retry cannot help `unauthorized`.
 */
const NEXT_STEP: Record<AiErr['kind'], string> = {
  not_configured: 'Set the key, restart the dev server, then ask again.',
  unauthorized: 'Fix the key; this answer will not change until you do.',
  rate_limited: 'Wait for the window to pass, then ask again.',
  timeout: 'The model did not answer in time. Asking again is reasonable.',
  network: 'Check that the machine is online.',
  upstream: 'The model returned an error. Asking once more is reasonable.',
  contract: 'Nothing to retry — the reply did not match the agreed shape.',
};

/** Prose and fenced code, nothing else: no markdown engine, no HTML injection. */
function AnswerText({ text }: { text: string }) {
  return (
    <>
      {text.split('```').map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i} className={s.codeBlock}>
            {part.replace(/^[\w-]*\n/, '').replace(/\s+$/, '')}
          </pre>
        ) : part.trim() ? (
          <p key={i} className={s.answerPara}>
            {part.trim()}
          </p>
        ) : null,
      )}
    </>
  );
}

function AiPanel({
  state,
  canRetry,
  onStop,
  onRetry,
}: {
  state: AskState;
  canRetry: boolean;
  onStop: () => void;
  onRetry: () => void;
}) {
  if (state.status === 'idle') {
    return (
      <div className={s.askIdle}>
        <p className={s.askLede}>Answers one question with DeepSeek. It does not start a process.</p>
      </div>
    );
  }

  if (state.status === 'sending') {
    return (
      <div className={s.askSending} aria-busy="true">
        <div className={s.askBars} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <p className={s.askNote}>Waiting for one answer…</p>
        <Button size="sm" onClick={onStop}>
          Stop
        </Button>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={s.askError}>
        <p className={g.banner} role="alert">
          {state.error.message}
        </p>
        <p className={s.askNote}>{NEXT_STEP[state.error.kind]}</p>
        {state.error.retryable && canRetry ? (
          <Button size="sm" onClick={onRetry}>
            Ask again
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={s.askAnswer}>
      <div className={s.answerBody} aria-live="polite">
        <AnswerText text={state.answer.text} />
      </div>
      <p className={s.answerFoot}>
        {state.answer.model} · dev endpoint · {state.answer.ms} ms
      </p>
    </div>
  );
}

export function Overview() {
  const navigate = useNavigate();
  const { panelOpen, togglePanel } = useApp();
  const list = useWorkspaces();
  const [params] = useSearchParams();
  const [intent, setIntent] = useState('');
  const [engaged, setEngaged] = useState(false);
  const [ai, setAi] = useState<AiStatusBody | null>(null);
  const [answer, setAnswer] = useState<AskState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  /* One probe on mount, so the send control is disabled before the click rather
     than after it. A failed probe leaves the control enabled — see `probe()`. */
  useEffect(() => {
    let alive = true;
    void probe().then((status) => {
      if (alive) setAi(status);
    });
    return () => {
      alive = false;
    };
  }, []);

  const pending = needsInput();
  const continuing = recent().slice(0, 3);
  const lede = pendingLede(pending.length);

  const text = intent.trim();
  const overLimit = text.length > AI_MAX_PROMPT;
  const unconfigured = ai !== null && !ai.configured;
  const sending = answer.status === 'sending';
  const canAsk = text.length > 0 && !overLimit && !sending && !unconfigured;

  const run = useCallback(
    async (prompt: string) => {
      if (!panelOpen) togglePanel();
      setEngaged(true);
      setAnswer({ status: 'sending' });
      const controller = new AbortController();
      abortRef.current = controller;
      const result = await ask(prompt, controller.signal);
      /* An aborted request is not a failure: `stop()` already put the panel back
         to idle, and this late return must not overwrite that. */
      if (controller.signal.aborted) return;
      abortRef.current = null;
      setAnswer(
        result.ok
          ? { status: 'done', answer: result.answer }
          : { status: 'error', error: result.error },
      );
    },
    [panelOpen, togglePanel],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAnswer({ status: 'idle' });
  }, []);

  const submit = () => {
    if (canAsk) void run(text);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (sending) stop();
      setIntent('');
    }
  };

  const reason = unconfigured
    ? 'No model key on the server. Put DEEPSEEK_API_KEY in .env.local and restart the dev server.'
    : overLimit
      ? `The question is ${text.length} characters; the limit is ${AI_MAX_PROMPT}.`
      : 'Answers one question. Nothing is started.';

  /* Typing is also a signal: a paste or an autofill can put text in the field
     without a focus event ever reaching React. */
  const showsPanel = engaged || text.length > 0 || answer.status !== 'idle';

  return (
    <PlainLayout
      wide
      panelTitle="Ask"
      panelMeta={ai?.model}
      panel={
        showsPanel ? (
          <AiPanel state={answer} canRetry={canAsk} onStop={stop} onRetry={submit} />
        ) : undefined
      }
    >
      <header className={s.head}>
        <h1 className={s.greeting}>Welcome back, {USER.name.split(' ')[0]}.</h1>
        <p className={s.lede}>{lede}</p>
      </header>

      <div className={s.intentForm}>
        <div className={s.intentBox} data-over={overLimit || undefined}>
          <span className={s.intentTick} aria-hidden="true" />
          <input
            className={s.intentInput}
            placeholder="Ask one question…"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onFocus={() => setEngaged(true)}
            onKeyDown={onKeyDown}
            disabled={sending}
            aria-label="Ask one question"
            aria-describedby="intent-reason"
          />
          <Button
            variant="primary"
            className={s.sendBtn}
            onClick={submit}
            disabled={!canAsk}
            aria-describedby="intent-reason"
            aria-label="Send"
            title="Send (⌘↵)"
            icon={<IconArrow size={14} />}
          />
        </div>
        <div className={s.intentFoot}>
          <p id="intent-reason" className={s.intentReason}>
            {reason}
          </p>
          <span className={s.intentMeta}>
            <kbd className={s.kbdInline}>⌘↵</kbd> to send · <kbd className={s.kbdInline}>esc</kbd>{' '}
            clears
          </span>
        </div>
      </div>

      <div className={s.split}>
        <section className={s.col}>
          <SectionLabel aside={String(continuing.length)}>Continue</SectionLabel>
          <ul className={s.rows}>
            {continuing.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <button type="button" className={s.row} onClick={() => navigate(item.route)}>
                  <span className={s.rowGlyph}>{glyph(item)}</span>
                  <span className={s.rowMain}>
                    <span className={s.rowTitle}>{item.label}</span>
                    <span className={s.rowMeta}>
                      {KIND_LABEL[item.kind]} · {getWorkspace(item.wsId)?.name ?? 'Workspace'} ·{' '}
                      {item.when}
                    </span>
                  </span>
                  <span className={s.rowState}>
                    {item.state === 'running' ? (
                      <>
                        <StatusDot tone={STATE_TONE[item.state]} pulse />
                        live
                      </>
                    ) : item.state ? (
                      STATE_LABEL[item.state]
                    ) : (
                      'open'
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={s.col}>
          <SectionLabel aside={String(pending.length)}>Needs you</SectionLabel>
          {pending.length === 0 ? (
            <EmptyState
              title="Nothing needs you right now"
              hint="Runs that ask for a decision will appear here."
            />
          ) : (
            <>
              <ul className={s.rows}>
                {pending.map((run) => (
                  <li key={run.id}>
                    <button
                      type="button"
                      className={s.row}
                      onClick={() => navigate(routes.run(run.wsId, run.id))}
                    >
                      <span className={s.rowGlyph}>
                        <IconAnswer size={13} />
                      </span>
                      <span className={s.rowMain}>
                        <span className={s.rowTitle}>{question(run)}</span>
                        <span className={s.needMeta}>
                          <span className={s.rowMeta}>
                            {run.name} · {getWorkspace(run.wsId)?.name} · {run.started}
                          </span>
                          <Chip tone="warn">
                            {run.capabilities.includes('answer') ? 'answer' : 'review'}
                          </Chip>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className={s.block}>
        <SectionLabel aside={String(list.length)}>Workspaces</SectionLabel>
        <WorkspaceGrid autoCreate={params.get('new') === '1'} />
      </section>

      <section className={s.block}>
        <SectionLabel aside={String(recent().length)}>Recently</SectionLabel>
        <ul className={s.rows}>
          {recent()
            .slice(0, 4)
            .map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  type="button"
                  className={[s.row, s.rowTight].join(' ')}
                  onClick={() => navigate(item.route)}
                >
                  <span className={s.rowGlyph}>{glyph(item)}</span>
                  <span className={s.rowTitle}>{item.label}</span>
                  <span className={s.rowInlineMeta}>
                    {KIND_LABEL[item.kind]} · {getWorkspace(item.wsId)?.name}
                  </span>
                  <span className={s.rowTime}>{item.when}</span>
                </button>
              </li>
            ))}
        </ul>
      </section>
    </PlainLayout>
  );
}
