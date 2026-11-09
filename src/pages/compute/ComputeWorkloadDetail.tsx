import { Link, useNavigate, useParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { providerOf } from '../../data/compute';
import { resourceViewOf, setWorkloadState, useCompute, workloadOf, workloadsOn } from '../../state/compute';
import { Button, EmptyState, Field } from '../../components/ui';
import { ComputeShell } from './ComputeShell';
import { ProviderMark, Section } from './parts';
import { STATE_WORD } from './workloadWords';
import s from './compute.module.css';

export function ComputeWorkloadDetail() {
  useCompute();

  const { workloadId = '' } = useParams();
  const navigate = useNavigate();
  const workload = workloadOf(workloadId);

  if (!workload) {
    return (
      <ComputeShell title="Workload">
        <EmptyState
          title="No such workload"
          hint="It is not in this browser's records. Work assigned elsewhere does not appear here."
          action={<Button onClick={() => navigate(routes.computeWorkloads())}>Back to workloads</Button>}
        />
      </ComputeShell>
    );
  }

  const resource = resourceViewOf(workload.resourceId);
  const provider = resource ? providerOf(resource.providerId) : undefined;
  const siblings = resource ? workloadsOn(resource.id).filter((w) => w.id !== workload.id) : [];

  return (
    <ComputeShell
      title={workload.name}
      sub={`${workload.kind} · ${STATE_WORD[workload.state]} · ${workload.startedAt}`}
      actions={
        <Link to={routes.computeWorkloads()} className={s.backLink}>
          All workloads
        </Link>
      }
    >
      <div className={s.detailGrid}>
        <div className={s.detailMain}>
          <Section title="Target" id="target">
            {resource ? (
              <Link to={routes.computeResource(resource.id)} className={s.targetCard}>
                <ProviderMark providerId={resource.providerId} />
                <span className={s.targetText}>
                  <span className={s.targetName}>{resource.name}</span>
                  <span className={s.targetMeta}>
                    {provider?.name} · {resource.os} · {resource.scope === 'org' ? `shared with ${resource.owner}` : 'yours'}
                  </span>
                </span>
              </Link>
            ) : (
              <p className={s.quiet}>No machine is assigned to this run.</p>
            )}
            {workload.note ? <p className={s.sectionNoteLoose}>{workload.note}</p> : null}
          </Section>

          <Section title="Consumption" id="consumption">
            <div className={s.fields}>
              <Field label="CPU">{workload.cpuPct}%</Field>
              <Field label="GPU">{workload.gpuPct === undefined ? '—' : `${workload.gpuPct}%`}</Field>
              <Field label="Memory">{workload.memoryGb} GB</Field>
              <Field label="Duration">{workload.duration}</Field>
            </div>
            {workload.state === 'queued' ? (
              <p className={s.sectionNoteLoose}>
                A queued run has not touched the machine, so its consumption is zero rather than
                unknown.
              </p>
            ) : null}
          </Section>

          {siblings.length > 0 ? (
            <Section title="Also on this machine" id="siblings">
              <ul className={s.rows}>
                {siblings.map((w) => (
                  <li key={w.id}>
                    <Link to={routes.computeWorkload(w.id)} className={s.row}>
                      <span className={s.rowMain}>
                        <span className={s.rowTitle}>{w.name}</span>
                        <span className={s.rowMeta}>{w.startedAt}</span>
                      </span>
                      <span className={s.rowState} data-state={w.state}>
                        {STATE_WORD[w.state]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        <aside className={s.detailSide}>
          <Section title="Actions" id="actions">
            <p className={s.quiet}>
              {workload.state === 'running'
                ? 'Stopping marks the run cancelled in this browser only. No signal reaches the machine.'
                : workload.state === 'queued'
                  ? 'Cancelling drops the assignment here. Nothing was ever started.'
                  : 'Finished runs are read-only in this build.'}
            </p>
            <div className={s.sideActions}>
              {workload.state === 'running' || workload.state === 'queued' ? (
                <Button size="sm" onClick={() => setWorkloadState(workload.id, 'cancelled')}>
                  {workload.state === 'running' ? 'Stop (local)' : 'Cancel (local)'}
                </Button>
              ) : null}
              {resource ? (
                <Link to={routes.computeResource(resource.id)} className={s.linkArrow}>
                  Open the machine
                </Link>
              ) : null}
            </div>
          </Section>
        </aside>
      </div>
    </ComputeShell>
  );
}
