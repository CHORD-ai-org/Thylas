import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import type { Workload, WorkloadState } from '../../data/compute';
import { allWorkloads, resourcesView, setWorkloadState, useCompute } from '../../state/compute';
import { Button, EmptyState } from '../../components/ui';
import { ComputeShell } from './ComputeShell';
import { ProviderMark } from './parts';
import { STATE_WORD } from './workloadWords';
import s from './compute.module.css';

const FILTERS: { id: WorkloadState | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'queued', label: 'Queued' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function ComputeWorkloads() {
  useCompute();

  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const raw = params.get('state');
  const state: WorkloadState | 'all' = FILTERS.some((f) => f.id === raw) ? (raw as WorkloadState) : 'all';
  const all = allWorkloads();
  const resources = resourcesView();
  const rows = state === 'all' ? all : all.filter((w) => w.state === state);

  const count = (id: WorkloadState | 'all') => (id === 'all' ? all.length : all.filter((w) => w.state === id).length);

  const setState = (id: WorkloadState | 'all') => {
    const next = new URLSearchParams(params);
    if (id === 'all') next.delete('state');
    else next.set('state', id);
    setParams(next, { replace: true });
  };

  const target = (w: Workload) => resources.find((r) => r.id === w.resourceId);

  return (
    <ComputeShell sub="Every run Thylas knows about and the machine it was given. State changes here are local to this browser: there is no executor behind them.">
      <div className={s.toolbar}>
        <div className={s.chipRow} role="tablist" aria-label="Filter workloads">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={state === f.id}
              className={[s.chip, state === f.id ? s.chipOn : ''].join(' ')}
              onClick={() => setState(f.id)}
            >
              {f.label}
              <span className={s.chipCount}>{count(f.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={state === 'all' ? 'No workloads' : `No ${state} workload`}
          hint={
            state === 'all'
              ? 'Work assigned in Find compute lands here as queued. Nothing starts on its own.'
              : 'Switch the filter, or assign work from Find compute.'
          }
          action={
            state === 'all' ? (
              <Button onClick={() => navigate(routes.computeFind())}>Find compute</Button>
            ) : (
              <Button variant="ghost" onClick={() => setState('all')}>
                Show all
              </Button>
            )
          }
        />
      ) : (
        <div className={s.table}>
          <div className={[s.tr, s.thead, s.trRun].join(' ')} role="row">
            <span>Workload</span>
            <span>Machine</span>
            <span>State</span>
            <span>Started</span>
            <span>Consumption</span>
            <span className={s.numRight}>Actions</span>
          </div>
          {rows.map((w) => {
            const r = target(w);
            return (
              <div key={w.id} className={[s.tr, s.trRun].join(' ')} role="row" data-state={w.state}>
                <span className={s.tdName}>
                  <span className={[s.tdNameText, s.tdStack].join(' ')}>
                    <Link to={routes.computeWorkload(w.id)} className={s.tdTitle}>
                      {w.name}
                    </Link>
                    <span className={s.tdSub}>{w.kind}</span>
                  </span>
                </span>
                <span className={s.tdMachine}>
                  {r ? (
                    <Link to={routes.computeResource(r.id)} className={s.machineLink}>
                      <ProviderMark providerId={r.providerId} size="sm" />
                      {r.name}
                    </Link>
                  ) : (
                    <span className={s.tdMuted}>unassigned</span>
                  )}
                </span>
                <span className={s.tdState} data-state={w.state}>
                  {STATE_WORD[w.state]}
                </span>
                <span className={s.tdWhen}>
                  {w.startedAt}
                  <span className={s.tdSub}>{w.duration}</span>
                </span>
                <span className={s.tdCost}>
                  {w.state === 'running' || w.state === 'completed' ? (
                    <>
                      CPU {w.cpuPct}% · {w.memoryGb}GB{w.gpuPct === undefined ? '' : ` · GPU ${w.gpuPct}%`}
                    </>
                  ) : (
                    <span className={s.tdMuted}>—</span>
                  )}
                </span>
                <span className={s.rowActions}>
                  {w.state === 'running' ? (
                    <Button size="sm" variant="ghost" onClick={() => setWorkloadState(w.id, 'cancelled')}>
                      Stop
                    </Button>
                  ) : w.state === 'queued' ? (
                    <Button size="sm" variant="ghost" onClick={() => setWorkloadState(w.id, 'cancelled')}>
                      Cancel
                    </Button>
                  ) : (
                    <Link to={routes.computeWorkload(w.id)} className={s.linkArrow}>
                      Open
                    </Link>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className={s.footNote}>
        Stopping a run marks it cancelled in this browser. It does not signal the machine: no WAM
        endpoint is connected in this build, and a stopped run here would keep running there.
      </p>
    </ComputeShell>
  );
}
