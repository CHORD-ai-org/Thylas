import { Link } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { BACKEND_CATALOG, BACKEND_TYPE_LABEL } from '../../data/compute';
import {
  backendsView,
  defaultBackendId,
  instancesView,
  setDefaultBackend,
  useCompute,
  workloadsView,
} from '../../state/compute';
import { PlainLayout } from '../../shell/layouts';
import { Button } from '../../components/ui';
import { BackendMark, ComputeShell, Section } from './parts';
import s from './compute.module.css';

/**
 * Compute home: what is running, where runs go by default, what is configured,
 * and what else can be added. Every control here is real — the default select
 * writes to the store, "View history" opens Activity, "Set up" opens the flow
 * that exists for that type. Nothing claims to start work.
 */
export function ComputeOverview() {
  useCompute();
  const backends = backendsView();
  const instances = instancesView();
  const workloads = workloadsView();
  const running = workloads.filter((w) => w.state === 'running');
  const configuredTypes = new Set(backends.map((b) => b.type));
  const options = BACKEND_CATALOG.filter((c) => !configuredTypes.has(c.type));
  const currentDefault = defaultBackendId() ?? backends[0]?.id ?? '';

  return (
    <PlainLayout size="console">
      <ComputeShell
        sub="Execution environments. Nothing here starts or provisions."
        actions={
          <Link to={routes.computeRun()} className={s.linkArrow}>
            Run something
          </Link>
        }
      >
        <Section
          title="Running instances"
          aside={
            <span className={s.sectionActions}>
              <Button size="sm" onClick={() => window.location.reload()} data-compute-refresh>
                Refresh
              </Button>
              <Link to={routes.computeActivity()} className={s.linkArrow}>
                View history
              </Link>
            </span>
          }
        >
          {running.length === 0 ? (
            <div className={s.runningCard} data-compute-running-empty>Nothing running right now.</div>
          ) : (
            <div className={s.runningCard}>
            <ul className={s.rows} data-compute-running>
              {running.map((w) => {
                const instance = instances.find((i) => i.id === w.instanceId);
                return (
                  <li key={w.id}>
                    <Link className={s.row} to={routes.computeWorkload(w.id)}>
                      <span className={s.rowMain}>
                        <span className={s.rowTitle}>{w.name}</span>
                        <span className={s.rowMeta}>{instance ? `on ${instance.name}` : 'targeting the environment'}</span>
                      </span>
                      <span className={s.rowState}>{w.duration}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            </div>
          )}
        </Section>

        <Section title="Default destination">
          <select
            className={s.destinationSelect}
            aria-label="Default destination"
            value={currentDefault}
            onChange={(e) => setDefaultBackend(e.target.value)}
            data-compute-default
          >
            {backends.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <p className={s.sectionNote}>New runs use this destination unless another backend is specified.</p>
        </Section>

        <Section title="Configured">
          <div className={s.tileGrid} data-compute-configured>
            {backends.map((b) => (
              <Link key={b.id} className={s.tile} to={routes.computeBackend(b.id)} data-configured-card={b.id}>
                <span className={s.tileMark}><BackendMark backend={b} size="sm" /></span>
                <span className={s.tileName}>{b.name}</span>
                <span className={s.tileBlurb}>{b.blurb}</span>
                <span className={s.tileMeta}>{BACKEND_TYPE_LABEL[b.type]} · {b.status}</span>
                {b.isDefault ? <span className={s.tileFoot}>Default</span> : null}
              </Link>
            ))}
          </div>
        </Section>

        <Section title="More compute options">
          <div className={s.tileGrid} data-compute-options>
            {options.map((c) => (
              <div key={c.id} className={s.tile} data-option-card={c.id}>
                <span className={s.tileMark}><BackendMark backend={c} size="sm" /></span>
                <span className={s.tileName}>{c.name}</span>
                <span className={s.tileBlurb}>{c.blurb}</span>
                <span className={s.tileMeta}>{c.configured ? 'Configuration saved' : 'No flow to open'}</span>
                {c.configured ? (
                  <Link className={s.tileAction} to={`${routes.computeAddBackend()}?type=${c.type}`}>
                    Set up <span aria-hidden>→</span>
                  </Link>
                ) : (
                  <span className={s.tileActionMuted}>No flow to open</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      </ComputeShell>
    </PlainLayout>
  );
}
