import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routes } from '../lib/routes';
import {
  STATE_LABEL,
  STATE_TONE,
  getFile,
  getWorkspace,
  needsInput,
  pendingLede,
  recent,
  workspaces,
} from '../data/selectors';
import type { Process, RecentItem, RecentKind } from '../data/types';
import { USER } from '../data/mock';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  NoteGlyph,
  ProcessGlyph,
  SectionLabel,
  StatusDot,
  TypeGlyph,
} from '../components/ui';
import { IconAnswer, IconBoards } from '../components/icons';
import { PlainLayout } from '../shell/layouts';
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

export function Overview() {
  const navigate = useNavigate();
  const [intent, setIntent] = useState('');

  const pending = needsInput();
  const continuing = recent().slice(0, 3);
  const lede = pendingLede(pending.length);

  return (
    <PlainLayout wide>
      <header className={s.head}>
        <h1 className={s.greeting}>Welcome back, {USER.name.split(' ')[0]}.</h1>
        <p className={s.lede}>{lede}</p>
      </header>

      <div className={s.intentForm}>
        <div className={s.intentBox}>
          <span className={s.intentTick} aria-hidden="true" />
          <input
            className={s.intentInput}
            placeholder="Describe what you want to work on…"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            aria-label="Describe what you want to work on"
            aria-describedby="intent-reason"
          />
          <Button
            variant="primary"
            className={s.startBtn}
            disabled
            title="Needs the WAM service — not connected in this build. Your text stays in this field."
            aria-describedby="intent-reason"
          >
            Start
          </Button>
        </div>
        <div className={s.intentFoot}>
          <p id="intent-reason" className={s.intentReason}>
            Submission needs the WAM service — not connected in this build. Nothing is sent.
          </p>
          <span className={s.intentMeta}>
            <kbd className={s.kbdInline}>⌘K</kbd> for everything else
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
              <p className={s.quiet}>
                Nothing else is waiting. The other runs are working on their own.
              </p>
            </>
          )}
        </section>
      </div>

      <section className={s.block}>
        <SectionLabel aside={String(workspaces().length)}>Workspaces</SectionLabel>
        <div className={s.wsGrid}>
          {workspaces().map((ws) => (
            <button
              key={ws.id}
              type="button"
              className={s.wsCard}
              onClick={() => navigate(routes.files(ws.id))}
            >
              <span className={s.wsCardTop}>
                <span className={s.wsCardName}>{ws.name}</span>
                <Badge>{ws.scope === 'org' ? 'ORG' : 'PERSONAL'}</Badge>
              </span>
              <span className={s.wsCardMeta}>
                {ws.counts.files} files · {ws.counts.boards} boards · {ws.counts.processes} processes
              </span>
              <span className={s.wsCardFoot}>
                {ws.scope === 'org'
                  ? `${ws.members} members · you are a member`
                  : 'only you'}
              </span>
            </button>
          ))}
        </div>
        <p className={s.footNote}>
          Workspaces come from the workspace service. Creating one is not available in this build.
        </p>
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
