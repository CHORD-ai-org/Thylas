import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import { STATE_LABEL, STATE_TONE, getProcess, getWorkspace, processesIn } from '../data/selectors';
import {
  FILTER_EMPTY,
  RUN_FILTERS,
  actionOutcome,
  countFor,
  matchesFilter,
  nextSimulated,
  parseFilter,
  type RunFilter,
} from '../data/runs';
import type { Process, RunAction } from '../data/types';
import { useRegisterTab } from '../state/app';
import { clearRunState, setRunState, useRunOverrides } from '../state/runs';
import { Badge, Button, Chip, EmptyState, Field, StatusDot } from '../components/ui';
import { IconAnswer, IconBoards, IconChevron, IconFile, IconNote, IconPause, IconStop } from '../components/icons';
import { WorkspaceLayout } from '../shell/layouts';
import g from '../styles/grammar.module.css';
import s from './processes.module.css';

/* The filter lives in the URL (?state=running), so a filtered view can be sent
   to someone. `parseFilter` rejects anything else rather than showing an empty
   list with no reason. */

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

export function ProcessesPage() {
  const { wsId = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const overrides = useRunOverrides();
  const [loading, setLoading] = useState(false);

  const ws = getWorkspace(wsId);
  const all = processesIn(wsId);
  const filter = parseFilter(params.get('state'));
  /* `?fail=1` is the only way to see the error band: there is no server to fail.
     It is a query rather than a hidden flag so the state is a link, not a mood. */
  const failing = params.get('fail') === '1';

  const stateOf = (run: Process) => overrides[run.id] ?? run.state;
  const rows = all.filter((run) => matchesFilter(filter, stateOf(run)));

  const setFilter = (id: RunFilter) => {
    const next = new URLSearchParams(params);
    if (id === 'all') next.delete('state');
    else next.set('state', id);
    setParams(next, { replace: true });
  };

  const retry = () => {
    setLoading(true);
    window.setTimeout(() => {
      const next = new URLSearchParams(params);
      next.delete('fail');
      setParams(next, { replace: true });
      setLoading(false);
    }, 700);
  };

  if (!ws) return <EmptyState title="Workspace not found" hint="This workspace is gone." />;

  return (
    <WorkspaceLayout wsId={wsId}>
      <div className={s.page}>
        <div className={s.toolbar}>
          <div className={s.filters} role="tablist" aria-label="Filter processes">
            {RUN_FILTERS.map((f) => {
              const count = countFor(f.id, all, stateOf);
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
          {/* A Start control used to sit here and answer a click with an apology.
              No WAM endpoint exists in this build, so the sentence is permanent
              and there is nothing to press. */}
          <p className={s.toolbarNote}>
            No WAM endpoint is connected in this build.
          </p>
        </div>

        {loading ? (
          <div className={s.skeleton} aria-busy="true" aria-label="Reading runs">
            <i />
            <i />
            <i />
          </div>
        ) : failing ? (
          <div className={s.errorBand}>
            {/* One child on purpose: `grammar.banner` is a flex row for text plus a
                dismiss control, and a second element would be pushed to the far edge. */}
            <p className={g.banner} role="alert">
              <span>
                The run list could not be read. Nothing in this build talks to WAM — this is the
                failure <code className={s.code}>?fail=1</code> asks for.
              </span>
            </p>
            <Button size="sm" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : (
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
              {rows.map((run) => {
                const state = stateOf(run);
                const local = state !== run.state;
                return (
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
                      <StatusDot tone={STATE_TONE[state]} pulse={state === 'running'} />
                      {STATE_LABEL[state]}
                    </span>
                    <span className={[s.colActivity, s.mono].join(' ')}>
                      {local ? 'simulated · local copy' : run.activity}
                    </span>
                    <span className={[s.colCredits, s.mono].join(' ')}>{run.credits || '—'}</span>
                    <span className={[s.colOut, s.mono].join(' ')}>{run.outputs || '—'}</span>
                  </button>
                );
              })}
              {rows.length === 0 ? (
                <EmptyState
                  title={FILTER_EMPTY[filter]}
                  hint="Switch the filter, or show everything."
                  action={
                    filter === 'all' ? undefined : (
                      <Button size="sm" onClick={() => setFilter('all')}>
                        Show all
                      </Button>
                    )
                  }
                />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </WorkspaceLayout>
  );
}

export function RunDetailPage() {
  const { wsId = '', runId = '' } = useParams();
  const navigate = useNavigate();
  const overrides = useRunOverrides();
  const [advancing, setAdvancing] = useState(false);
  const run = getProcess(runId);

  /* The state on screen is the local copy when there is one. `simulated` is
     always drawn next to it: a reader must be able to tell a clicked state from
     a reported one at a glance. */
  const state = run ? (overrides[run.id] ?? run.state) : 'queued';
  const local = run ? state !== run.state : false;
  const next = run ? nextSimulated(state) : null;

  useRegisterTab(
    `ws:${wsId}`,
    run
      ? {
          type: 'run',
          label: run.name,
          path: routes.run(wsId, runId),
          live: state === 'running',
        }
      : null,
  );

  if (!run) {
    return <EmptyState title="Run not found" hint="This build knows only the sample runs." />;
  }

  const simulate = () => {
    if (!next || advancing) return;
    setAdvancing(true);
    /* 700ms, so the change is seen rather than noticed afterwards. */
    window.setTimeout(() => {
      setRunState(run.id, next);
      setAdvancing(false);
    }, 700);
  };

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
            <StatusDot tone={STATE_TONE[state]} pulse={state === 'running'} />
            <span>{STATE_LABEL[state]}</span>
            <Badge>{run.type}</Badge>
            {local ? <Chip tone="idle">simulated</Chip> : null}
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
          </div>

          <div className={s.panelSection}>
            <div className={s.panelHead}>Controls</div>
            <div className={s.controls}>
              {run.capabilities.map((action) => (
                <Button
                  key={action}
                  size="sm"
                  icon={actionIcon(action)}
                  onClick={() => setRunState(run.id, actionOutcome(action))}
                >
                  {ACTION_LABEL[action]}
                </Button>
              ))}
            </div>
            {/* Said before the click, not after it: these buttons change the
                browser's copy of the run and nothing else. */}
            <p className={s.panelQuiet}>Nothing is sent to WAM in this build.</p>
            {local ? (
              <Button size="sm" variant="ghost" onClick={() => clearRunState(run.id)}>
                Restore the sample
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className={s.runScroll} data-scroll-region="run-detail">
        <header className={s.runHead}>
          <div className={s.runKicker}>
            <span className={s.kickerType}>{run.type}</span>
            <Chip tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Chip>
            <span className={s.kickerMeta}>
              credits {run.credits || '—'} · started {run.started}
            </span>
            <span className={s.simulateGroup}>
              <Button
                size="sm"
                variant="ghost"
                onClick={simulate}
                disabled={!next || advancing}
                title={
                  next
                    ? 'Advances a local copy of this run. Nothing is sent to WAM.'
                    : 'This state has nowhere further to go on the simulated path.'
                }
              >
                {advancing ? 'Simulating…' : next ? 'Simulate next state' : 'No further state'}
              </Button>
              <span className={s.simulateLabel}>simulated</span>
            </span>
          </div>
          <h1 className={s.runTitle}>{run.name}</h1>
          <p className={s.runSub}>
            {getWorkspace(wsId)?.name} · #{run.id.replace('run-', '')} · {run.outputs} artifacts ·{' '}
            {run.refs.length} references
          </p>
        </header>

        <section className={s.band}>
          <div className={s.bandHead}>
            <h2>Intent</h2>
            <span className={s.bandMeta}>verbatim · not editable</span>
          </div>
          <blockquote className={s.intent}>{run.intent}</blockquote>
          <div className={s.refChips}>
            {run.refs.map((ref) => (
              <span key={`${ref.kind}-${ref.id}`} className={s.refChip}>
                <span className={s.refChipMark}>
                  {ref.kind === 'file' ? <IconFile size={11} /> : <IconNote size={11} />}
                </span>
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
              {state === 'running' ? (
                <>
                  <StatusDot tone="live" pulse /> live
                </>
              ) : (
                'snapshot'
              )}
            </span>
          </div>
          {run.events.length === 0 && !local ? (
            <p className={s.bandEmpty}>
              Nothing has happened yet. {state === 'queued' ? 'The run is queued.' : ''}
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

                  </span>
                  <span className={s.eventText}>{ev.text}</span>
                  <span className={[s.eventMeta, ev.meta === 'running' ? s.eventLive : ''].join(' ')}>
                    {ev.meta}
                  </span>
                </li>
              ))}
              {local ? (
                <li className={s.eventRow}>
                  <span className={s.eventT}>now</span>
                  <span className={[s.eventMark, s.markState].join(' ')} />
                  <span className={s.eventText}>
                    State set to “{STATE_LABEL[state]}” in this browser. The run itself did not move.
                  </span>
                  <span className={[s.eventMeta, s.eventLive].join(' ')}>simulated</span>
                </li>
              ) : null}
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
                    <span className={s.outMark}>
                      {a.kind === 'file' ? (
                        <IconFile size={11} />
                      ) : a.kind === 'board' ? (
                        <IconBoards size={11} />
                      ) : (
                        <IconNote size={11} />
                      )}
                    </span>
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
