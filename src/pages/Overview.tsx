import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routes } from '../lib/routes';
import { getWorkspace, processesIn, recent, workspaces } from '../data/selectors';
import type { Process, RecentKind } from '../data/types';
import { USER } from '../data/mock';
import { useApp } from '../state/app';
import { Badge, Button, Chip, SectionLabel, StatusDot, TypeGlyph, NoteGlyph, ProcessGlyph } from '../components/ui';
import { IconAnswer, IconChevron, IconPlus, IconSearch } from '../components/icons';
import { PlainLayout } from '../shell/layouts';
import s from './overview.module.css';

const CONTINUE: Array<{ kind: RecentKind; id: string; label: string; meta: string; route: string }> = [
  { kind: 'board', id: 'b-lit', label: 'lit-review', meta: 'Whiteboard · Research · moved 2h ago', route: '/w/ws-research/boards/b-lit' },
  { kind: 'note', id: 'n-method', label: 'Method — how we measure comparability', meta: 'Note · Research · edited yesterday', route: '/notes/n-method' },
  { kind: 'process', id: 'run-baseline', label: 'baseline-sweep', meta: 'Process · Research · running 12m', route: '/w/ws-research/processes/run-baseline' },
];

function glyph(kind: RecentKind) {
  if (kind === 'file') return <TypeGlyph kind="pdf" />;
  if (kind === 'note') return <NoteGlyph />;
  if (kind === 'process') return <ProcessGlyph />;
  return <span className={s.boardGlyph}>▦</span>;
}

export function Overview() {
  const navigate = useNavigate();
  const { openPalette } = useApp();
  const [intent, setIntent] = useState('');
  const [sent, setSent] = useState(false);

  const pending: Process[] = workspaces().flatMap((w) =>
    processesIn(w.id).filter((p) => p.state === 'needs_input'),
  );

  return (
    <PlainLayout wide>
      <header className={s.head}>
        <h1 className={s.greeting}>Welcome back, {USER.name.split(' ')[0]}.</h1>
        <p className={s.lede}>
          Two processes need a decision. Pick up the thread you dropped, or describe something new.
        </p>
      </header>

      <form
        className={s.intentForm}
        onSubmit={(e) => {
          e.preventDefault();
          if (!intent.trim()) return;
          setSent(true);
        }}
      >
        <div className={s.intentBox}>
          <IconSearch size={14} />
          <input
            className={s.intentInput}
            placeholder="Describe what you want to work on…"
            value={intent}
            onChange={(e) => {
              setIntent(e.target.value);
              setSent(false);
            }}
            aria-label="Describe what you want to work on"
          />
          <Button variant="primary" type="submit" disabled={!intent.trim()} className={s.startBtn}>
            Start
          </Button>
        </div>
        <div className={s.intentMeta}>
          <span>
            Runs in <strong>Research</strong>
            <IconChevron dir="down" size={11} />
            <span className={s.metaHint}> · workspace and context can be changed before it starts</span>
          </span>
          <span className={s.metaRight}>
            <kbd className={s.kbdInline}>⌘K</kbd> for everything else
          </span>
        </div>
        {sent ? (
          <p className={s.notice} role="status">
            Nothing was sent. WAM is not connected in this build, so the intent stays here — the
            handoff screen is specified but not wired.
          </p>
        ) : null}
      </form>

      <div className={s.split}>
        <section className={s.col}>
          <SectionLabel aside={String(CONTINUE.length)}>Continue</SectionLabel>
          <ul className={s.rows}>
            {CONTINUE.map((item) => (
              <li key={item.id}>
                <button type="button" className={s.row} onClick={() => navigate(item.route)}>
                  <span className={s.rowGlyph}>{glyph(item.kind)}</span>
                  <span className={s.rowMain}>
                    <span className={s.rowTitle}>{item.label}</span>
                    <span className={s.rowMeta}>{item.meta}</span>
                  </span>
                  <span className={s.rowState}>
                    {item.id === 'run-baseline' ? (
                      <>
                        <StatusDot tone="live" pulse />
                        live
                      </>
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
                    <span className={s.rowTitle}>{run.name}</span>
                    <span className={s.rowMeta}>
                      {run.events[run.events.length - 1]?.text.split(' · ')[1] ?? 'asked a question'} ·{' '}
                      {run.activity}
                    </span>
                  </span>
                  <Chip tone="warn">{run.capabilities.includes('answer') ? 'answer' : 'review'}</Chip>
                </button>
              </li>
            ))}
          </ul>
          <p className={s.quiet}>Nothing else is waiting. The other runs are working on their own.</p>
        </section>
      </div>

      <section className={s.block}>
        <SectionLabel aside={String(workspaces().length)}>Workspaces</SectionLabel>
        <div className={s.wsGrid}>
          {workspaces().map((ws) => (
            <button key={ws.id} type="button" className={s.wsCard} onClick={() => navigate(routes.files(ws.id))}>
              <span className={s.wsCardTop}>
                <span className={s.wsCardName}>{ws.name}</span>
                <Badge>{ws.scope === 'org' ? 'ORG' : 'PERSONAL'}</Badge>
              </span>
              <span className={s.wsCardMeta}>
                {ws.counts.files} files · {ws.counts.boards} boards · {ws.counts.processes} processes
              </span>
              <span className={s.wsCardFoot}>
                {ws.scope === 'org' ? `${ws.members} members` : 'only you'}
                {ws.scope === 'org' ? ' · you are a member' : ''}
              </span>
            </button>
          ))}
          <button
            type="button"
            className={s.wsNew}
            onClick={openPalette}
            title="Workspace creation needs the workspace service. This build opens the command palette instead."
          >
            <IconPlus size={13} />
            New workspace
            <span className={s.wsNewHint}>needs workspace service</span>
          </button>
        </div>
      </section>

      <section className={s.block}>
        <SectionLabel aside={String(recent().length)}>Recently</SectionLabel>
        <ul className={s.rows}>
          {recent()
            .slice(0, 4)
            .map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <button type="button" className={[s.row, s.rowTight].join(' ')} onClick={() => navigate(item.route)}>
                  <span className={s.rowGlyph}>{glyph(item.kind)}</span>
                  <span className={s.rowTitle}>{item.label}</span>
                  <span className={s.rowInlineMeta}>
                    {item.kind} · {getWorkspace(item.wsId)?.name}
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
