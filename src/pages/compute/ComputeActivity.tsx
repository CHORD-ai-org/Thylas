import { Link, useSearchParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import type { WorkloadState } from '../../data/compute';
import { backendById, instanceById, useCompute, workloadsView } from '../../state/compute';
import { PlainLayout } from '../../shell/layouts';
import { ComputeShell, Mark } from './parts';
import s from './compute.module.css';

const STATES: WorkloadState[] = ['running', 'queued', 'completed', 'failed', 'cancelled'];

/**
 * Activity: execution history. Every workload has a target — an instance, or
 * an environment that provisions itself — and the row says which.
 */
export function ComputeActivity() {
  useCompute();
  const [params] = useSearchParams();
  const state = (params.get('state') as WorkloadState | null) ?? null;
  const workloads = workloadsView();
  const visible = state ? workloads.filter((w) => w.state === state) : workloads;

  return (
    <PlainLayout size="console">
      <ComputeShell
        title="Activity"
        sub="Chosen targets, no executor."
      >
        <div className={s.toolbarChips} role="group" aria-label="Filter by state">
          <Link to={routes.computeActivity()} className={[s.chip, !state ? s.chipOn : ''].join(' ')}>
            All <span className={s.chipCount}>{workloads.length}</span>
          </Link>
          {STATES.map((st) => (
            <Link
              key={st}
              to={`${routes.computeActivity()}?state=${st}`}
              className={[s.chip, state === st ? s.chipOn : ''].join(' ')}
            >
              {st} <span className={s.chipCount}>{workloads.filter((w) => w.state === st).length}</span>
            </Link>
          ))}
        </div>

        <div className={s.resultLine} style={{ marginTop: 'var(--s4)' }}>
          <span className={s.resultCount}>
            {visible.length} workload{visible.length === 1 ? '' : 's'}
          </span>
          <span className={s.resultNote}>
            {state ? `filtered to ${state}` : 'newest first'}
          </span>
        </div>

        <div className={s.table}>
          <div className={[s.tr, s.thead].join(' ')}>
            <span>Workload</span>
            <span>Kind</span>
            <span>Target</span>
            <span>State</span>
            <span>Started</span>
            <span>Duration</span>
          </div>
          {visible.map((w) => {
            const backend = backendById(w.backendId);
            const instance = instanceById(w.instanceId);
            return (
              <Link key={w.id} className={s.tr} to={routes.computeWorkload(w.id)} data-workload-row={w.id} data-state={w.state}>
                <span className={s.tdName}>
                  <Mark name={backend?.name ?? '?'} size="sm" />
                  <span className={s.tdTitle}>{w.name}</span>
                </span>
                <span className={s.tdProvider}>{w.kind}</span>
                <span className={s.tdProvider}>{instance ? instance.name : (backend?.name ?? w.backendId)}</span>
                <span className={s.tdState} data-state={w.state}>
                  {w.state}
                </span>
                <span className={s.tdProvider}>{w.startedAt}</span>
                <span className={s.tdProvider}>{w.duration}</span>
              </Link>
            );
          })}
          {visible.length === 0 ? (
            <p className={s.sectionNote} style={{ paddingTop: 12 }}>
              Nothing in this state. Work chosen in Run arrives here as queued.
            </p>
          ) : null}
        </div>
      </ComputeShell>
    </PlainLayout>
  );
}
