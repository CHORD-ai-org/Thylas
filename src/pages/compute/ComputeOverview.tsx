import { Link } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { BACKEND_TYPE_LABEL } from '../../data/compute';
import { availabilityOf } from '../../data/compute';
import { backendsView, instancesView, useCompute, workloadsView } from '../../state/compute';
import { PlainLayout } from '../../shell/layouts';
import { BackendMark, BackendStatusWord, ComputeShell, Section, StatusPair } from './parts';
import s from './compute.module.css';

/**
 * Overview answers "what can I use right now" and "what needs me". It is the
 * entry to the journey, not a dashboard: the primary action is Run, and every
 * number here leads somewhere or says why it cannot.
 */
export function ComputeOverview() {
  useCompute();
  const backends = backendsView();
  const instances = instancesView();
  const workloads = workloadsView();

  const readyBackends = backends.filter((b) => b.enabled && b.status === 'ready');
  const connected = instances.filter((i) => i.connection === 'connected');
  const usable = instances.filter((i) => availabilityOf(i) === 'available');
  const running = workloads.filter((w) => w.state === 'running');

  const attention: { name: string; why: string; to: string }[] = [];
  for (const b of backends) {
    if (b.status === 'unverified') attention.push({ name: b.name, why: 'configuration saved, never tested', to: routes.computeBackend(b.id) });
    if (b.status === 'unreachable' || b.status === 'error') attention.push({ name: b.name, why: 'the last test got no answer', to: routes.computeBackend(b.id) });
  }
  for (const i of instances) {
    if (i.connection === 'error') attention.push({ name: i.name, why: 'connection error — no numbers until it is repaired', to: routes.computeInstance(i.id) });
  }

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
        <div className={s.stats}>
          <div className={s.stat}>
            <span className={s.statValue}>
              {readyBackends.length}/{backends.length}
            </span>
            <span className={s.statLabel}>Backends ready</span>
          </div>
          <div className={s.stat}>
            <span className={s.statValue}>{connected.length}</span>
            <span className={s.statLabel}>Instances connected</span>
          </div>
          <div className={s.stat} data-warn={usable.length === 0 || undefined}>
            <span className={s.statValue}>{usable.length}</span>
            <span className={s.statLabel}>Usable now</span>
          </div>
          <div className={s.stat}>
            <span className={s.statValue}>{running.length}</span>
            <span className={s.statLabel}>Running</span>
          </div>
        </div>

        {attention.length > 0 ? (
          <div className={s.attention}>
            <p className={s.attentionLine}>Needs attention</p>
            <div className={s.attentionList}>
              {attention.map((item) => (
                <Link key={item.name + item.why} to={item.to} className={s.attentionItem}>
                  <span className={s.attentionRing} aria-hidden>
                    ›
                  </span>
                  <span className={s.attentionName}>{item.name}</span>
                  <span className={s.attentionWhy}>{item.why}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className={s.overviewGrid}>
          <div className={s.detailMain}>
            <Section
              title="Execution environments"
              aside={<Link to={routes.computeBackends()} className={s.linkArrow}>Backends</Link>}
              note="Connecting creates no instance."
            >
              <ul className={s.rows}>
                {backends.map((b) => (
                  <li key={b.id}>
                    <Link className={s.row} to={routes.computeBackend(b.id)}>
                      <BackendMark backend={b} />
                      <span className={s.rowMain}>
                        <span className={s.rowTitle}>
                          {b.name}
                          {b.isDefault ? <span className={s.defaultChip}>· default</span> : null}
                          {b.instances === 'none' ? <span className={s.defaultChip}>· no instances</span> : null}
                        </span>
                        <span className={s.rowMeta}>{b.blurb}</span>
                      </span>
                      <span className={s.rowAside}>
                        <BackendStatusWord status={b.status} />
                        <span className={s.rowState}>{BACKEND_TYPE_LABEL[b.type]}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Running now" aside={<Link to={routes.computeActivity()} className={s.linkArrow}>Activity</Link>}>
              {running.length === 0 ? (
                <p className={s.quiet}>Nothing is running.</p>
              ) : (
                <ul className={s.rows}>
                  {running.map((w) => {
                    const instance = instances.find((i) => i.id === w.instanceId);
                    return (
                      <li key={w.id}>
                        <Link className={s.row} to={routes.computeWorkload(w.id)}>
                          <span className={s.rowMain}>
                            <span className={s.rowTitle}>{w.name}</span>
                            <span className={s.rowMeta}>{instance ? `on ${instance.name}` : 'targeting the environment'}</span>
                          </span>
                          {w.progress !== undefined ? (
                            <span className={s.rowProgress}>
                              <span className={s.progressTrack}>
                                <span className={s.progressFill} style={{ width: `${w.progress}%` }} />
                              </span>
                              <span className={s.progressValue}>{w.progress}%</span>
                            </span>
                          ) : null}
                          <span className={s.rowState}>{w.duration}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          </div>

          <div className={s.side}>
            <Section
              title="Usable immediately"
              aside={<Link to={routes.computeInstances()} className={s.linkArrow}>Instances</Link>}
              note="Idle machines a run could take right now."
            >
              {usable.length === 0 ? (
                <p className={s.quiet}>No connected idle machine. Slurm takes work anyway.</p>
              ) : (
                <ul className={s.rows}>
                  {usable.map((i) => (
                    <li key={i.id}>
                      <Link className={s.row} to={routes.computeInstance(i.id)}>
                        <span className={s.rowMain}>
                          <span className={s.rowTitle}>{i.name}</span>
                          <span className={s.rowMeta}>
                            {i.scope === 'org' ? `shared · ${i.owner}` : 'yours'}
                          </span>
                        </span>
                        <span className={s.rowAside}>
                          <StatusPair instance={i} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <div className={s.marketTeaser}>
              <p className={s.marketTeaserText}>
                More GPU capacity at sample rates in the Marketplace.
              </p>
              <Link to={routes.computeMarketplace()} className={s.linkArrow}>
                Marketplace
              </Link>
            </div>

            <Section title="This session's decisions" aside={<span>{''}</span>}>
              <SessionLog />
            </Section>
          </div>
        </div>
      </ComputeShell>
    </PlainLayout>
  );
}

function SessionLog() {
  const { log } = useCompute();
  const entries = log.slice(0, 5);
  if (entries.length === 0) {
    return <p className={s.quiet}>Nothing decided yet.</p>;
  }
  return (
    <div className={s.log}>
      {entries.map((d) => (
        <div key={d.id} className={s.logItem}>
          <span className={s.logWhen}>{d.at.slice(11, 19)}</span>
          <span>{d.text}</span>
        </div>
      ))}
    </div>
  );
}
