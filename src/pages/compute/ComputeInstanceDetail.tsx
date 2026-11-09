import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { hardwareBrief } from '../../data/compute';
import {
  backendById,
  connectInstance,
  disconnectInstance,
  instanceById,
  terminateInstance,
  useCompute,
  workloadsOn,
} from '../../state/compute';
import { Button, Chip, EmptyState } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import { ComputeShell, Section, StatusPair, Utilization } from './parts';
import s from './compute.module.css';

/**
 * Instance detail: what the machine is, what it can take, what is on it, and
 * the actions this build can honestly perform — connect, disconnect, and for
 * acquired machines, terminate.
 */
export function ComputeInstanceDetail() {
  const { instanceId } = useParams();
  const navigate = useNavigate();
  useCompute();
  const instance = instanceById(instanceId);
  const [confirming, setConfirming] = useState(false);

  if (!instance) {
    return (
      <PlainLayout size="console">
        <ComputeShell title="Instance not found">
          <EmptyState
            title="No such instance"
            hint="It was removed or terminated in this session, or the link is older than the pool."
            action={<Link to={routes.computeInstances()} className={s.linkArrow}>Back to Instances</Link>}
          />
        </ComputeShell>
      </PlainLayout>
    );
  }

  const backend = backendById(instance.backendId);
  const workloads = workloadsOn(instance.id);
  const willFail = instance.name.includes('unreachable');

  return (
    <PlainLayout size="console">
      <ComputeShell
        title={instance.name}
        sub={`${backend?.name ?? instance.backendId} · ${instance.scope === 'org' ? `shared with ${instance.owner}` : 'yours'}`}
        actions={<Link to={routes.computeInstances()} className={s.backLink}>Instances</Link>}
      >
        <header className={s.detailHead}>
          <span className={s.mark} aria-hidden>
            {backend?.name.slice(0, 2).toUpperCase()}
          </span>
          <div className={s.detailIdentity}>
            <span className={s.detailName}>
              {instance.name}
              {instance.declared ? <Chip tone="plain">declared hardware</Chip> : null}
              {instance.acquiredVia ? <Chip tone="plain">acquired</Chip> : null}
            </span>
            <span className={s.detailMeta}>
              {instance.os} · {instance.runtime.join(' · ')}
            </span>
          </div>
          <div className={s.detailStatus}>
            <StatusPair instance={instance} />
            <span className={s.detailSeen}>Last seen {instance.lastSeen}</span>
          </div>
        </header>

        {instance.connection === 'error' || instance.note ? (
          <p className={s.band} role="status">
            {instance.note ?? 'The last connection attempt failed. The instance stays in the pool and shows no utilization until it is repaired.'}
          </p>
        ) : null}

        <div className={s.detailGrid}>
          <div className={s.detailMain}>
            <Section title="Hardware" note={hardwareBrief(instance.hardware)}>
              <div className={s.fields}>
                <Field label="CPU">{instance.hardware.cpu}</Field>
                <Field label="Cores">{instance.hardware.cores}</Field>
                <Field label="GPU">{instance.hardware.gpu ?? 'none'}</Field>
                {instance.hardware.gpuMemoryGb ? <Field label="GPU memory">{instance.hardware.gpuMemoryGb} GB</Field> : null}
                <Field label="System memory">{instance.hardware.memoryGb} GB</Field>
                <Field label="Storage">{instance.hardware.storageGb} GB</Field>
              </div>
            </Section>

            <Section title="Utilization" note="Exists only while the machine can be seen. Absence is the honest state.">
              <Utilization instance={instance} />
            </Section>

            <Section title="Workloads here" aside={<Link to={routes.computeActivity()} className={s.linkArrow}>Activity</Link>}>
              {workloads.length === 0 ? (
                <p className={s.quiet}>Nothing has run on this machine.</p>
              ) : (
                <ul className={s.rows}>
                  {workloads.map((w) => (
                    <li key={w.id}>
                      <Link className={s.row} to={routes.computeWorkload(w.id)}>
                        <span className={s.rowMain}>
                          <span className={s.rowTitle}>{w.name}</span>
                          <span className={s.rowMeta}>
                            {w.kind} · {w.startedAt}
                          </span>
                        </span>
                        <span className={s.rowState} data-state={w.state}>
                          {w.state}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className={s.detailSide}>
            <Section title="Actions">
              <div className={s.sideActions}>
                {instance.connection === 'connected' ? (
                  <Button size="sm" onClick={() => disconnectInstance(instance.id)}>
                    Disconnect
                  </Button>
                ) : instance.connection === 'connecting' ? (
                  <Button size="sm" disabled>
                    Connecting…
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => connectInstance(instance.id, willFail)}>
                    Connect
                  </Button>
                )}
                {instance.acquiredVia ? (
                  confirming ? null : (
                    <Button size="sm" onClick={() => setConfirming(true)} data-instance-terminate>
                      Terminate
                    </Button>
                  )
                ) : null}
              </div>

              {instance.acquiredVia && confirming ? (
                <div className={s.confirm} role="group" aria-label={`Terminate ${instance.name}`} data-instance-confirm>
                  <p className={s.confirmTitle}>Terminate “{instance.name}”?</p>
                  <p className={s.confirmWhat}>
                    It leaves the pool immediately. A managed machine stops billing when terminated — nothing was billed
                    here, because nothing here is real.
                  </p>
                  <div className={s.confirmActions}>
                    <Button size="sm" className={s.danger} onClick={() => { terminateInstance(instance.id); navigate(routes.computeInstances()); }}>
                      Terminate
                    </Button>
                    <Button size="sm" onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}

              {instance.ratePerHour ? (
                <p className={s.sectionNote}>
                  Representative rate ${instance.ratePerHour.toFixed(2)}/h — a Marketplace sample, not a live price.
                </p>
              ) : null}
              <p className={s.sectionNote}>
                Connection attempts are simulated and deterministic. No SSH session is opened, no agent is installed.
              </p>
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
