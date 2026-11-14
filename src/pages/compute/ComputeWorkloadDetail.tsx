import { Link, useParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { backendById, instanceById, setWorkloadState, useCompute, workloadById } from '../../state/compute';
import { Button, Chip, EmptyState } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import { ComputeShell, Mark, Section } from './parts';
import s from './compute.module.css';

/**
 * Workload detail: what ran, on what target, and what this build can honestly
 * do about it — local state changes only, each labelled as such.
 */
export function ComputeWorkloadDetail() {
  const { workloadId } = useParams();
  useCompute();
  const workload = workloadById(workloadId);

  if (!workload) {
    return (
      <PlainLayout size="console">
        <ComputeShell title="Workload not found">
          <EmptyState
            title="No such workload"
            hint="The link is older than the session's history."
            action={<Link to={routes.computeActivity()} className={s.linkArrow}>Back to Activity</Link>}
          />
        </ComputeShell>
      </PlainLayout>
    );
  }

  /* Plain reads, not hooks: the subscription is useCompute() above. */
  const targetBackend = backendById(workload.backendId);
  const instance = workload.instanceId ? instanceById(workload.instanceId) : undefined;

  return (
    <PlainLayout size="console">
      <ComputeShell
        title={workload.name}
        sub={`${workload.kind} · ${instance ? `on ${instance.name}` : `targeting ${targetBackend?.name ?? workload.backendId}`}`}
        actions={<Link to={routes.computeActivity()} className={s.backLink}>Activity</Link>}
      >
        <header className={s.detailHead}>
          <Mark name={targetBackend?.name ?? '?'} />
          <div className={s.detailIdentity}>
            <span className={s.detailName}>
              {workload.name}
              <Chip tone={workload.state === 'failed' ? 'error' : workload.state === 'running' ? 'live' : 'plain'}>
                {workload.state}
              </Chip>
            </span>
            <span className={s.detailMeta}>
              {workload.startedAt} · {workload.duration}
            </span>
          </div>
          {workload.progress !== undefined ? (
            <div className={s.detailStatus}>
              <span className={s.rowProgress}>
                <span className={s.progressTrack}>
                  <span className={s.progressFill} style={{ width: `${workload.progress}%` }} />
                </span>
                <span className={s.progressValue}>{workload.progress}%</span>
              </span>
            </div>
          ) : null}
        </header>

        {workload.note ? <p className={s.bandQuiet}>{workload.note}</p> : null}

        <div className={s.detailGrid}>
          <div className={s.detailMain}>
            <Section title="Execution target">
              <div className={s.fields}>
                <Field label="Backend">{targetBackend?.name ?? workload.backendId}</Field>
                <Field label="Instance">
                  {instance ? (
                    <Link to={routes.computeInstance(instance.id)} className={s.linkArrow}>
                      {instance.name}
                    </Link>
                  ) : (
                    '— the environment takes the work directly'
                  )}
                </Field>
                {workload.intent ? <Field label="Intent">{workload.intent}</Field> : null}
              </div>
            </Section>

            {workload.events && workload.events.length > 0 ? (
              <Section title="Events">
                <div className={s.log}>
                  {workload.events.map((e, i) => (
                    <div key={i} className={s.logItem}>
                      <span className={s.logWhen}>{e.t}</span>
                      <span>{e.text}</span>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}
          </div>

          <div className={s.detailSide}>
            <Section title="Allocation">
              <div className={s.fields}>
                <Field label="CPU">{workload.cpuPct}%</Field>
                <Field label="Memory">{workload.memoryGb} GB</Field>
                {workload.gpuPct !== undefined ? <Field label="GPU">{workload.gpuPct}%</Field> : null}
              </div>
            </Section>

            <Section title="Actions" note="Local state only; no executor.">
              <div className={s.sideActions}>
                {workload.state === 'running' ? (
                  <Button size="sm" onClick={() => setWorkloadState(workload.id, 'cancelled')}>
                    Stop
                  </Button>
                ) : null}
                {workload.state === 'queued' ? (
                  <Button size="sm" onClick={() => setWorkloadState(workload.id, 'cancelled')}>
                    Cancel
                  </Button>
                ) : null}
                {workload.state === 'failed' || workload.state === 'cancelled' || workload.state === 'completed' ? (
                  <Button size="sm" onClick={() => setWorkloadState(workload.id, 'queued')}>
                    Re-queue
                  </Button>
                ) : null}
              </div>
            </Section>
          </div>
        </div>
      </ComputeShell>
    </PlainLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={s.selectLabel}>{label}</span>
      <p className={s.quiet} style={{ marginTop: 2 }}>
        {children}
      </p>
    </div>
  );
}
