import { Link } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { BACKEND_CATALOG, BACKEND_TYPE_LABEL, type Backend } from '../../data/compute';
import { backendsView, setDefaultBackend, useCompute } from '../../state/compute';
import { Badge, Button } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import { BackendMark, BackendStatusWord, CapabilityChips, ComputeShell } from './parts';
import s from './compute.module.css';

/**
 * Backends: the execution interfaces Thylas can run work through. The catalog
 * below the configured list is the honest version of "add" — types with a
 * flow open a form; types without one say so on the row.
 */
export function ComputeBackends() {
  useCompute();
  const backends = backendsView();
  const configuredTypes = new Set(backends.map((b) => b.type));

  const groups: { label: string; items: Backend[]; kind: 'configured' | 'catalog' | 'planned' }[] = [
    { label: 'Configured', items: backends, kind: 'configured' },
    {
      label: 'Available to configure',
      items: BACKEND_CATALOG.filter((c) => c.configured && !configuredTypes.has(c.type)),
      kind: 'catalog',
    },
    {
      label: 'Planned — no flow yet',
      items: BACKEND_CATALOG.filter((c) => !c.configured),
      kind: 'planned',
    },
  ];

  return (
    <PlainLayout size="console">
      <ComputeShell
        title="Backends"
        sub="Configuring creates no instance."
        actions={
          <Link to={routes.computeAddBackend()} className={s.linkArrow}>
            Add a backend
          </Link>
        }
      >
        <p className={s.marketNote}>
          Simulated and deterministic: a host whose name contains{' '}
          <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>unreachable</code> never answers, everything else does. No
          backend here has actually been contacted.
        </p>

        {groups.map((group) =>
          group.items.length === 0 ? null : (
            <section key={group.kind} className={s.section} aria-label={group.label}>
              <div className={s.sectionHead}>
                <h2 className={s.sectionTitle}>{group.label}</h2>
                <span className={s.sectionAside}>{group.items.length}</span>
              </div>
              <ul className={s.rows}>
                {group.items.map((entry) => (
                  <li key={entry.id} className={s.listingRow} data-backend-row={entry.id}>
                    <div className={s.listingIdentity}>
                      <BackendMark backend={entry} />
                      <div className={s.listingText}>
                        <span className={s.listingTitle}>
                          {group.kind === 'configured' ? (
                            <Link to={routes.computeBackend(entry.id)} className={s.linkArrow}>
                              {entry.name}
                            </Link>
                          ) : (
                            entry.name
                          )}
                          <Badge>{BACKEND_TYPE_LABEL[entry.type].toUpperCase()}</Badge>
                          {entry.isDefault ? <span className={s.defaultChip}>DEFAULT</span> : null}
                        </span>
                        <span className={s.listingBlurb}>{entry.blurb}</span>
                      </div>
                    </div>

                    <CapabilityChips capabilities={entry.capabilities} />

                    <div className={s.providerState}>
                      {group.kind === 'configured' ? (
                        <BackendStatusWord status={entry.status} />
                      ) : (
                        <span className={s.tierAuth}>{group.kind === 'planned' ? 'not implemented' : 'not configured'}</span>
                      )}
                      <span className={s.tierAuth}>{entry.instances === 'exposed' ? 'exposes instances' : 'no instances'}</span>
                    </div>

                    <div className={s.providerActions}>
                      {group.kind === 'configured' ? (
                        <>
                          <Link to={routes.computeBackend(entry.id)} className={s.linkArrow}>
                            Configure
                          </Link>
                          {!entry.isDefault ? (
                            <Button size="sm" onClick={() => setDefaultBackend(entry.id)}>
                              Set default
                            </Button>
                          ) : null}
                        </>
                      ) : group.kind === 'catalog' ? (
                        <Link to={`${routes.computeAddBackend()}?type=${entry.type}`} className={s.linkArrow}>
                          Set up
                        </Link>
                      ) : (
                        <span className={s.planned}>No flow to open</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ),
        )}

      </ComputeShell>
    </PlainLayout>
  );
}
