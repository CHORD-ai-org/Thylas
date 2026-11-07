import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import {
  STATE_LABEL,
  STATE_TONE,
  getProcess,
  getWorkspace,
  processesIn,
} from '../data/selectors';
import type { Process, RunAction } from '../data/types';
import { useRegisterTab } from '../state/app';
import { Badge, Button, Chip, EmptyState, Field, StatusDot } from '../components/ui';
import { IconAnswer, IconPause, IconStop, IconChevron } from '../components/icons';
import { WorkspaceLayout } from '../shell/layouts';
import s from './processes.module.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'needs_input', label: 'Needs input' },
  { id: 'done', label: 'Done' },
] as const;

function matches(filter: string, run: Process): boolean {
  if (filter === 'all') return true;
  if (filter === 'running') return run.state === 'running' || run.state === 'queued';
  if (filter === 'needs_input') return run.state === 'needs_input';
  return run.state === 'succeeded' || run.state === 'failed' || run.state === 'stopped';
}

export function ProcessesPage() {
  const { wsId = '' } = useParams();
  const navigate = useNavigate();
  const ws = getWorkspace(wsId);
  const all = processesIn(wsId);
  const [filter, setFilter] = useState<string>('all');
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo(() => all.filter((r) => matches(filter, r)), [all, filter]);

  if (!ws) return <EmptyState title="Workspace not found" hint="Recently lists what you can still reach." />;

  return (
    <WorkspaceLayout wsId={wsId}>
      <div className={s.page}>
        <div className={s.toolbar}>
          <div className={s.filters} role="tablist" aria-label="Filter processes">
            {FILTERS.map((f) => {
              const count = all.filter((r) => matches(f.id, r)).length;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  className={[s.filter, filter === f.id ? s.filterOn : ''].join(' ')}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                  <span className={s.filterCount}>{count}</span>
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            onClick={() =>
              setNotice(
                'Starting a process submits an intent to WAM. No WAM endpoint is connected in this build, so nothing is sent.',
              )
            }
          >
            Start a process
          </Button>
        </div>

        {notice ? (
          <div className={s.notice} role="status">
            {notice}
            <button type="button" className={s.noticeClose} aria-label="Dismiss" onClick={() => setNotice(null)}>
              ×
            </button>
          </div>
        ) : null}

        <div className={s.tableWrap} data-scroll-region="processes-table">
          <div className={s.thead}>
            <span className={s.colName}>Process</span>
            <span className={s.colType}>Type</span>
            <span className={s.colState}>State</span>
            <span className={s.colActivity}>Activity</span>
            <span className={s.colCredits}>Credits</span>
            <span className={s.colOut}>Out</span>
          </div>
          <div>
            {rows.map((run) => (
              <button
                key={run.id}
                type="button"
                className={s.trow}
                onClick={() => navigate(routes.run(wsId, run.id))}
              >
                <span className={s.colName}>
                  <IconChevron size={11} />
                  <span className={s.runName}>{run.name}</span>
                </span>
                <span className={[s.colType, s.monoDim].join(' ')}>{run.type}</span>
                <span className={s.colState}>
                  <StatusDot tone={STATE_TONE[run.state]} pulse={run.state === 'running'} />
                  {STATE_LABEL[run.state]}
                </span>
                <span className={[s.colActivity, s.mono].join(' ')}>{run.activity}</span>
                <span className={[s.colCredits, s.mono].join(' ')}>{run.credits || '—'}</span>
                <span className={[s.colOut, s.mono].join(' ')}>{run.outputs || '—'}</span>
              </button>
            ))}
            {rows.length === 0 ? (
              <EmptyState
                title="Nothing in this state"
                hint="Every process in this workspace is in another state. Switch the filter."
              />
            ) : null}
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

const ACTION_LABEL: Record<RunAction, string> = {
  pause: 'Pause',
  resume: 'Resume',
  stop: 'Stop',
  answer: 'Answer',
  approve: 'Approve',
  rerun: 'Re-run',
};

function actionIcon(action: RunAction) {
  if (action === 'stop') return <IconStop size={12} />;
  if (action === 'pause') return <IconPause size={12} />;
  if (action === 'answer') return <IconAnswer size={12} />;
  return null;
}

export function RunDetailPage() {
  const { wsId = '', runId = '' } = useParams();
  const navigate = useNavigate();
  const run = getProcess(runId);
  const [notice, setNotice] = useState<string | null>(null);

  useRegisterTab(
    `ws:${wsId}`,
    run
      ? {
          type: 'run',
          label: run.name,
          path: routes.run(wsId, runId),
          live: run.state === 'running',
        }
      : null,
  );

  if (!run) {
    return <EmptyState title="Run not found" hint="WAM owns run history. This build only knows the sample runs." />;
  }

  const artifactRoute = (a: Process['artifacts'][number]): string | null => {
    if (!a.id) return null;
    if (a.kind === 'file') return routes.file(wsId, a.id);
    if (a.kind === 'board') return routes.board(wsId, a.id);
    if (a.kind === 'note') return routes.note(a.id);
    return null;
  };

  return (
    <WorkspaceLayout
      wsId={wsId}
      panelTitle="Run"
      panel={
        <div className={s.panelInner}>
          <div className={s.panelState}>
            <StatusDot tone={STATE_TONE[run.state]} pulse={run.state === 'running'} />
            <span>{STATE_LABEL[run.state]}</span>
            <Badge>{run.type}</Badge>
          </div>
          <div className={s.panelFields}>
            <Field label="Started">{run.started}</Field>
            <Field label="Credits">{run.credits || '—'}</Field>
            <Field label="Outputs">{run.outputs || '—'}</Field>
            <Field label="Workspace">{getWorkspace(wsId)?.name}</Field>
          </div>

          <div className={s.panelSection}>
            <div className={s.panelHead}>Given to WAM</div>
            <ul className={s.givenList}>
              {run.refs.length === 0 ? <li className={s.panelQuiet}>No context was attached.</li> : null}
              {run.refs.map((ref) => (
                <li key={`${ref.kind}-${ref.id}`} className={s.givenRow}>
                  <span className={s.givenMark}>{ref.kind === 'file' ? '·' : 'N'}</span>
                  {ref.label}
                </li>
              ))}
            </ul>
            <p className={s.panelQuiet}>
              WAM reads these. Thylas passes identity, not credentials, and keeps no copy of the
              reasoning that used them.
            </p>
          </div>

          <div className={s.panelSection}>
            <div className={s.panelHead}>Controls</div>
            <div className={s.controls}>
              {run.capabilities.map((action) => (
                <Button
                  key={action}
                  size="sm"
                  icon={actionIcon(action)}
                  onClick={() =>
                    setNotice(
                      `“${ACTION_LABEL[action]}” is mirrored from the run's capability list. No WAM connection exists in this build, so the action was not sent.`,
                    )
                  }
                >
                  {ACTION_LABEL[action]}
                </Button>
              ))}
            </div>
            <p className={s.panelQuiet}>
              Only capabilities this run exposes are drawn. A missing capability is an absent button,
              never a disabled one.
            </p>
          </div>
        </div>
      }
    >
      <div className={s.runScroll} data-scroll-region="run-detail">
        <header className={s.runHead}>
          <div className={s.runKicker}>
            <span className={s.kickerType}>{run.type}</span>
            <Chip tone={STATE_TONE[run.state]}>{STATE_LABEL[run.state]}</Chip>
            <span className={s.kickerMeta}>
              credits {run.credits || '—'} · started {run.started}
            </span>
          </div>
          <h1 className={s.runTitle}>{run.name}</h1>
          <p className={s.runSub}>
            {getWorkspace(wsId)?.name} · #{run.id.replace('run-', '')} · {run.outputs} artifacts ·{' '}
            {run.refs.length} references
          </p>
        </header>

        {notice ? (
          <div className={s.notice} role="status">
            {notice}
            <button type="button" className={s.noticeClose} aria-label="Dismiss" onClick={() => setNotice(null)}>
              ×
            </button>
          </div>
        ) : null}

        <section className={s.band}>
          <div className={s.bandHead}>
            <h2>Intent</h2>
            <span className={s.bandMeta}>verbatim · not editable</span>
          </div>
          <blockquote className={s.intent}>{run.intent}</blockquote>
          <div className={s.refChips}>
            {run.refs.map((ref) => (
              <span key={`${ref.kind}-${ref.id}`} className={s.refChip}>
                <span className={s.refChipMark}>{ref.kind === 'file' ? '▤' : 'N'}</span>
                {ref.label}
              </span>
            ))}
          </div>
        </section>

        {run.plan.length > 0 ? (
          <section className={s.band}>
            <div className={s.bandHead}>
              <h2>Plan</h2>
              <span className={s.bandMeta}>rev 2 · 1 change</span>
            </div>
            <ol className={s.planList}>
              {run.plan.map((step) => (
                <li key={step.n} className={s.planRow}>
                  <span className={s.planN}>{step.n}</span>
                  <span className={s.planText}>{step.text}</span>
                  <span className={[s.planNote, step.changed ? s.planChanged : ''].join(' ')}>
                    {step.changed ? `rev 2 · ${step.note ?? 'changed'}` : (step.note ?? 'unchanged')}
                  </span>
                </li>
              ))}
            </ol>
            {run.planNote ? <p className={s.bandNote}>{run.planNote}</p> : null}
          </section>
        ) : null}

        <section className={s.band}>
          <div className={s.bandHead}>
            <h2>Activity</h2>
            <span className={s.bandMeta}>
              {run.state === 'running' ? (
                <>
                  <StatusDot tone="live" pulse /> live
                </>
              ) : (
                'snapshot'
              )}
            </span>
          </div>
          {run.events.length === 0 ? (
            <p className={s.bandEmpty}>
              Nothing has happened yet. {run.state === 'queued' ? 'The run is queued.' : ''}
            </p>
          ) : (
            <ol className={s.events}>
              {run.events.map((ev, i) => (
                <li key={`${ev.t}-${i}`} className={s.eventRow}>
                  <span className={s.eventT}>{ev.t}</span>
                  <span
                    className={[
                      s.eventMark,
                      ev.kind === 'artifact' ? s.markArtifact : '',
                      ev.kind === 'state' ? s.markState : '',
                    ].join(' ')}
                  >
                    {ev.kind === 'artifact' ? '□' : ev.kind === 'checkpoint' ? '·' : '•'}
                  </span>
                  <span className={s.eventText}>{ev.text}</span>
                  <span className={[s.eventMeta, ev.meta === 'running' ? s.eventLive : ''].join(' ')}>
                    {ev.meta}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={s.band}>
          <div className={s.bandHead}>
            <h2>Output</h2>
            <span className={s.bandMeta}>
              {run.artifacts.length} artifacts · {run.credits || 0} credits
            </span>
          </div>
          {run.artifacts.length === 0 ? (
            <p className={s.bandEmpty}>No artifact yet. Output appears here as it lands in the workspace.</p>
          ) : (
            <ul className={s.outList}>
              {run.artifacts.map((a, i) => {
                const to = artifactRoute(a);
                return (
                  <li key={`${a.label}-${i}`} className={s.outRow}>
                    <span className={s.outMark}>{a.kind === 'file' ? '▤' : a.kind === 'board' ? '▦' : 'N'}</span>
                    <span className={s.outLabel}>{a.label}</span>
                    <span className={s.outMeta}>{a.meta}</span>
                    {to ? (
                      <Button size="sm" variant="ghost" onClick={() => navigate(to)}>
                        Open
                      </Button>
                    ) : (
                      <span className={s.outNone} title="This artifact was never delivered to a workspace">
                        not stored
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </WorkspaceLayout>
  );
}
