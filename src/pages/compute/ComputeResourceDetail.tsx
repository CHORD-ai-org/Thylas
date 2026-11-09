import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { hardwareSummary, providerOf, statusLine } from '../../data/compute';
import {
  activeCount,
  connectResource,
  disconnectResource,
  removeResource,
  resourceViewOf,
  useCompute,
  workloadsOn,
} from '../../state/compute';
import { Badge, Button, Chip, EmptyState, Field } from '../../components/ui';
import { IconArrow } from '../../components/icons';
import { ComputeShell } from './ComputeShell';
import { ProviderMark, ProviderName, Section, StatusPair, Utilization } from './parts';
import { STATE_WORD } from './workloadWords';
import s from './compute.module.css';

export function ComputeResourceDetail() {
  useCompute();

  const { resourceId = '' } = useParams();
  const navigate = useNavigate();
  const resource = resourceViewOf(resourceId);
  const [busy, setBusy] = useState(false);

  if (!resource) {
    return (
      <ComputeShell title="Resource">
        <EmptyState
          title="No such machine"
          hint="It was removed from the pool, or the link is older than the pool itself."
          action={<Button onClick={() => navigate(routes.computeResources())}>Back to resources</Button>}
        />
      </ComputeShell>
    );
  }

  const provider = providerOf(resource.providerId);
  const runs = workloadsOn(resource.id);
  const connected = resource.connection === 'connected';

  const connect = (willFail = false) => {
    setBusy(true);
    connectResource(resource.id, { willFail });
    window.setTimeout(() => setBusy(false), 1200);
  };

  return (
    <ComputeShell
      title={resource.name}
      sub={`${provider?.name ?? resource.providerId} · ${resource.kind === 'instance' ? 'cloud instance' : resource.kind} · ${resource.os}`}
      actions={
        <div className={s.headButtons}>
          <Link to={routes.computeResources()} className={s.backLink}>
            All resources
          </Link>
          {connected ? (
            <Button variant="ghost" onClick={() => disconnectResource(resource.id)}>
              Disconnect
            </Button>
          ) : (
            <Button onClick={() => connect(false)} disabled={busy || resource.connection === 'connecting'}>
              {resource.connection === 'connecting'
                ? 'Connecting…'
                : resource.connection === 'error'
                  ? 'Retry connection'
                  : 'Connect'}
            </Button>
          )}
        </div>
      }
    >
      <div className={s.detailHead}>
        <ProviderMark providerId={resource.providerId} />
        <div className={s.detailIdentity}>
          <span className={s.detailName}>{resource.name}</span>
          <span className={s.detailMeta}>
            <ProviderName providerId={resource.providerId} />
            <Badge>{resource.scope === 'org' ? `ORG · ${resource.owner.toUpperCase()}` : 'PERSONAL'}</Badge>
            {resource.declared ? <Chip tone="plain">declared hardware</Chip> : null}
          </span>
        </div>
        <div className={s.detailStatus}>
          <StatusPair resource={resource} />
          <span className={s.detailSeen}>Last seen {resource.lastSeen}</span>
        </div>
      </div>

      {resource.connection === 'error' ? (
        <p className={s.band} role="status">
          {resource.note ??
            'The last connection attempt failed. Thylas keeps the machine in the pool and shows no utilization until it can be read again.'}
        </p>
      ) : null}
      {resource.connection === 'connected' && resource.availability === 'offline' ? (
        <p className={s.bandQuiet} role="status">
          {resource.note ?? 'The agent answers but the machine is not accepting work.'}
        </p>
      ) : null}

      <div className={s.detailGrid}>
        <div className={s.detailMain}>
          <Section title="Hardware" aside={<span className={s.monoNote}>{resource.declared ? 'declared in the connect flow' : 'reported by the host'}</span>} id="hardware">
            <div className={s.fields}>
              <Field label="CPU">{resource.hardware.cpu}</Field>
              <Field label="Cores">{resource.hardware.cores}</Field>
              <Field label="GPU">{resource.hardware.gpu ?? 'none'}</Field>
              <Field label="GPU memory">{resource.hardware.gpuMemoryGb ? `${resource.hardware.gpuMemoryGb} GB` : '—'}</Field>
              <Field label="Memory">{resource.hardware.memoryGb} GB</Field>
              <Field label="Storage">{resource.hardware.storageGb} GB</Field>
            </div>
            <p className={s.sectionNoteLoose}>{hardwareSummary(resource.hardware)}</p>
          </Section>

          <Section
            title="Utilization"
            aside={connected ? <span className={s.monoNote}>live sample</span> : <span className={s.monoNote}>no sample</span>}
            id="utilization"
          >
            <Utilization resource={resource} />
            {!connected ? (
              <p className={s.sectionNoteLoose}>
                A machine that cannot be reached has no utilization to report. Nothing here is estimated
                or cached from an earlier poll.
              </p>
            ) : null}
          </Section>

          <Section title="Environment" id="environment">
            <div className={s.fields}>
              <Field label="Operating system">{resource.os}</Field>
              <Field label="Scope">{resource.scope === 'org' ? `Organization · ${resource.owner}` : 'Personal'}</Field>
              {resource.runtime.map((item) => (
                <Field key={item} label="Runtime">
                  {item}
                </Field>
              ))}
            </div>
          </Section>

          <Section
            title="Workloads"
            aside={<Link to={routes.computeWorkloads()} className={s.linkArrow}>{activeCount(resource.id)} active</Link>}
            id="workloads"
          >
            {runs.length === 0 ? (
              <p className={s.quiet}>No run has used this machine. Nothing is scheduled onto it here.</p>
            ) : (
              <ul className={s.rows}>
                {runs.map((w) => (
                  <li key={w.id}>
                    <Link to={routes.computeWorkload(w.id)} className={s.row}>
                      <span className={s.rowMain}>
                        <span className={s.rowTitle}>{w.name}</span>
                        <span className={s.rowMeta}>
                          {w.kind} · {w.startedAt} · {w.duration}
                        </span>
                      </span>
                      <span className={s.rowState} data-state={w.state}>
                        {STATE_WORD[w.state]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className={s.detailSide}>
          <Section title="Connection" id="connection">
            <div className={s.fields}>
              <Field label="Transport">{resource.kind === 'local' ? 'local agent' : resource.kind === 'ssh' ? 'ssh' : 'provider API'}</Field>
              <Field label="Provider">{provider?.name ?? resource.providerId}</Field>
              <Field label="State">{statusLine(resource)}</Field>
              <Field label="Last read">{resource.lastSeen}</Field>
            </div>
            <p className={s.sectionNoteLoose}>
              {provider?.integration === 'prototype'
                ? 'This provider is a prototype flow: the form, the health and the machine list are simulated in this build.'
                : provider?.integration === 'built-in'
                  ? 'Built in. The agent or SSH connection is read locally; nothing is installed on the host.'
                  : 'Planned provider: no connection exists to test.'}
            </p>
            <div className={s.sideActions}>
              {connected ? (
                <Button size="sm" onClick={() => connect(true)} icon={<IconArrow size={12} />}>
                  Simulate a failed read
                </Button>
              ) : (
                <Button size="sm" onClick={() => connect(false)} disabled={busy}>
                  Connect now
                </Button>
              )}
              {resource.declared ? (
                <Button size="sm" variant="ghost" onClick={() => {
                  removeResource(resource.id);
                  navigate(routes.computeResources());
                }}>
                  Remove from pool
                </Button>
              ) : null}
            </div>
          </Section>

          {resource.note ? (
            <Section title="Note" id="note">
              <p className={s.quiet}>{resource.note}</p>
            </Section>
          ) : null}
        </aside>
      </div>
    </ComputeShell>
  );
}
