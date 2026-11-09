import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { BACKEND_TYPE_LABEL, CAPABILITY_LABEL } from '../../data/compute';
import {
  backendById,
  instancesOf,
  removeBackend,
  setBackendEnabled,
  setDefaultBackend,
  testBackend,
  useCompute,
} from '../../state/compute';
import { Badge, Button, Chip, EmptyState } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import { BackendMark, BackendStatusWord, ComputeShell, Section, StatusPair } from './parts';
import { BackendConfigForm } from './ComputeAddBackend';
import s from './compute.module.css';

/**
 * Backend detail: configuration, its test, what it can do, and the instances
 * it exposes — or the honest sentence when it exposes none.
 */
export function ComputeBackendDetail() {
  const { backendId } = useParams();
  const navigate = useNavigate();
  useCompute();
  const backend = backendById(backendId);
  const [confirming, setConfirming] = useState(false);

  if (!backend) {
    return (
      <PlainLayout size="console">
        <ComputeShell title="Backend not found">
          <EmptyState
            title="No such backend"
            hint="It was removed in this session, or the link is older than the pool."
            action={<Link to={routes.computeBackends()} className={s.linkArrow}>Back to Backends</Link>}
          />
        </ComputeShell>
      </PlainLayout>
    );
  }

  const instances = instancesOf(backend.id);

  const disable = () => setBackendEnabled(backend.id, !backend.enabled);

  return (
    <PlainLayout size="console">
      <ComputeShell
        title={backend.name}
        sub={`${BACKEND_TYPE_LABEL[backend.type]} · ${backend.instances === 'exposed' ? 'exposes instances' : 'work targets the environment directly'}`}
        actions={<Link to={routes.computeBackends()} className={s.backLink}>Backends</Link>}
      >
        <header className={s.detailHead}>
          <BackendMark backend={backend} />
          <div className={s.detailIdentity}>
            <span className={s.detailName}>
              {backend.name}
              {backend.isDefault ? <Badge>DEFAULT</Badge> : null}
              {!backend.enabled ? <Chip tone="warn">disabled</Chip> : null}
            </span>
            <span className={s.detailMeta}>
              {backend.blurb.length > 0 ? <span className={s.capNone}>{backend.blurb}</span> : null}
            </span>
          </div>
          <div className={s.detailStatus}>
            <BackendStatusWord status={backend.status} />
            {backend.status === 'unverified' ? (
              <span className={s.detailSeen}>configuration saved; a test has never run</span>
            ) : null}
          </div>
        </header>

        <div className={s.detailGrid}>
          <div className={s.detailMain}>
            <Section
              title="Configuration"
              note={backend.fields.some((f) => f.kind === 'secret') ? 'Secrets are held by the host and never displayed back.' : undefined}
            >
              <BackendConfigForm
                source={backend}
                existing={backend}
                onDone={() => {
                  /* staying on the page is the point: the form above updates
                     in place, so no navigation happens here */
                }}
              />
              <div className={s.sideActions}>
                <Button
                  size="sm"
                  disabled={backend.status === 'unreachable'}
                  title={backend.status === 'unreachable' ? 'Repair the configuration first; the last test got no answer.' : undefined}
                  onClick={() => testBackend(backend.id, Object.values(backend.config ?? {}).some((v) => v.toLowerCase().includes('unreachable')))}
                >
                  Test connection
                </Button>
              </div>
              <p className={s.sectionNote}>
                The test is simulated and deterministic: it reaches <em>ready</em> unless a saved value names an unreachable
                host. Nothing leaves this page.
              </p>
            </Section>

            <Section title={backend.instances === 'exposed' ? `Instances (${instances.length})` : 'Instances'}>
              {backend.instances === 'exposed' ? (
                instances.length === 0 ? (
                  <p className={s.quiet}>No machines are attached yet. An SSH backend lists machines; it does not create them.</p>
                ) : (
                  <ul className={s.rows}>
                    {instances.map((i) => (
                      <li key={i.id}>
                        <Link className={s.row} to={routes.computeInstance(i.id)}>
                          <span className={s.rowMain}>
                            <span className={s.rowTitle}>{i.name}</span>
                            <span className={s.rowMeta}>{i.os}</span>
                          </span>
                          <span className={s.rowAside}>
                            <StatusPair instance={i} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <p className={s.quiet}>
                  Work submitted to {backend.name} targets the environment, and the cluster or platform decides where it
                  lands. There is no machine here to list — that is what "no instances" means, not an empty pool.
                </p>
              )}
            </Section>
          </div>

          <div className={s.detailSide}>
            <Section title="Capabilities" aside={<span>{backend.capabilities.length}</span>}>
              <ul className={s.rows}>
                {backend.capabilities.map((cap) => (
                  <li key={cap} className={s.row}>
                    <span className={s.rowMain}>
                      <span className={s.rowTitle}>{CAPABILITY_LABEL[cap]}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {backend.docs ? (
                <p className={s.sectionNote}>
                  <a className={s.linkArrow} href={backend.docs} target="_blank" rel="noreferrer">
                    Provider documentation
                  </a>
                </p>
              ) : null}
            </Section>

            <Section title="Settings">
              <div className={s.sideActions}>
                {!backend.isDefault ? (
                  <Button size="sm" onClick={() => setDefaultBackend(backend.id)}>
                    Set as default
                  </Button>
                ) : (
                  <span className={s.capNone}>This is the default environment for new work.</span>
                )}
                <Button size="sm" onClick={disable}>
                  {backend.enabled ? 'Disable' : 'Enable'}
                </Button>
                {confirming ? null : (
                  <Button size="sm" onClick={() => setConfirming(true)} data-backend-remove>
                    Remove
                  </Button>
                )}
              </div>

              {confirming ? (
                <div className={s.confirm} role="group" aria-label={`Remove ${backend.name}`} data-backend-confirm>
                  <p className={s.confirmTitle}>Remove “{backend.name}”?</p>
                  <p className={s.confirmWhat}>
                    Its {instances.length} instance{instances.length === 1 ? '' : 's'} leave the pool with it, and targets
                    in Run lose this environment. Nothing outside this session changes: the configuration was local.
                  </p>
                  <div className={s.confirmActions}>
                    <Button size="sm" className={s.danger} onClick={() => { removeBackend(backend.id); navigate(routes.computeBackends()); }}>
                      Remove
                    </Button>
                    <Button size="sm" onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </Section>
          </div>
        </div>
      </ComputeShell>
    </PlainLayout>
  );
}
