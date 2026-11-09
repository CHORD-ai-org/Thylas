import { Link, useNavigate } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { hardwareSummary } from '../../data/compute';
import { activeCount, allWorkloads, decisions, resourcesView, useCompute } from '../../state/compute';
import { Badge, Button, EmptyState, StatusDot } from '../../components/ui';
import { IconArrow, IconPlus } from '../../components/icons';
import { ComputeShell } from './ComputeShell';
import { ProviderMark, Section, StatusPair } from './parts';
import s from './compute.module.css';

const DECISION_WORD = {
  reserve: 'Assigned',
  connect: 'Connected',
  disconnect: 'Disconnected',
  add: 'Added',
} as const;

function clock(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'just now';
  const mins = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  if (mins === 0) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

export function ComputeOverview() {
  useCompute();

  const navigate = useNavigate();
  const resources = resourcesView();
  const runs = allWorkloads();
  const running = runs.filter((w) => w.state === 'running');
  const queued = runs.filter((w) => w.state === 'queued');
  const available = resources.filter((r) => r.connection === 'connected' && r.availability === 'available');
  const attention = resources.filter(
    (r) => r.connection === 'error' || r.connection === 'disconnected' || (r.connection === 'connected' && r.availability === 'offline'),
  );
  const log = decisions().slice(0, 4);

  return (
    <ComputeShell>
      <div className={s.stats} role="group" aria-label="Pool summary">
        <div className={s.stat}>
          <span className={s.statValue}>{resources.length}</span>
          <span className={s.statLabel}>Registered</span>
        </div>
        <div className={s.stat}>
          <span className={s.statValue}>{available.length}</span>
          <span className={s.statLabel}>Available now</span>
        </div>
        <div className={s.stat}>
          <span className={s.statValue}>{running.length}</span>
          <span className={s.statLabel}>Active runs</span>
        </div>
        <div className={s.stat} data-warn={attention.length > 0 || undefined}>
          <span className={s.statValue}>{attention.length}</span>
          <span className={s.statLabel}>Need attention</span>
        </div>
      </div>

      {attention.length > 0 ? (
        <section className={s.attention} aria-label="Needs attention">
          <p className={s.attentionLine}>
            <strong>{attention.length} machines cannot be read right now.</strong> Availability is
            unknown for them, not idle.
          </p>
          <ul className={s.attentionList}>
            {attention.map((r) => (
              <li key={r.id}>
                <Link to={routes.computeResource(r.id)} className={s.attentionItem}>
                  <span className={s.attentionName}>{r.name}</span>
                  <span className={s.attentionWhy}>
                    {r.connection === 'error'
                      ? 'Connection failed — token rejected'
                      : r.connection === 'disconnected'
                        ? 'Not connected since 6d ago'
                        : 'Connected, machine asleep'}
                  </span>
                  <span className={s.attentionRing} aria-hidden>
                    <IconArrow size={12} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={s.overviewGrid}>
        <Section
          title="Resource pool"
          note="Every machine Thylas can reach, whatever it belongs to. The badge says who owns it."
          aside={
            <Link to={routes.computeResources()} className={s.linkArrow}>
              All {resources.length} resources
            </Link>
          }
          id="pool"
        >
          {resources.length === 0 ? (
            <EmptyState
              title="No machines yet"
              hint="A pool starts empty. Add a local machine, an SSH server, or a cloud account."
              action={<Button onClick={() => navigate(routes.computeNewResource())}>Add a resource</Button>}
            />
          ) : (
            <ul className={s.rows}>
              {resources.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link to={routes.computeResource(r.id)} className={s.row}>
                    <ProviderMark providerId={r.providerId} />
                    <span className={s.rowMain}>
                      <span className={s.rowTitle}>
                        {r.name}
                        <Badge>{r.scope === 'org' ? `ORG · ${r.owner.toUpperCase()}` : 'PERSONAL'}</Badge>
                      </span>
                      <span className={s.rowMeta}>
                        {hardwareSummary(r.hardware)}
                      </span>
                    </span>
                    <span className={s.rowStatus}>
                      <StatusPair resource={r} />
                      <span className={s.rowRuns}>{activeCount(r.id)} runs</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className={s.side}>
          <Section
            title="Active workloads"
            note={queued.length > 0 ? `${queued.length} queued behind a start signal.` : undefined}
            aside={
              <Link to={routes.computeWorkloads()} className={s.linkArrow}>
                All workloads
              </Link>
            }
            id="active"
          >
            {running.length === 0 ? (
              <p className={s.quiet}>Nothing is running. Queued work waits for an executor that does not exist in this build.</p>
            ) : (
              <ul className={s.rows}>
                {running.slice(0, 4).map((w) => {
                  const target = resources.find((r) => r.id === w.resourceId);
                  return (
                    <li key={w.id}>
                      <Link to={routes.computeWorkload(w.id)} className={s.row}>
                        <span className={s.runDot} aria-hidden>
                          <StatusDot tone="live" />
                        </span>
                        <span className={s.rowMain}>
                          <span className={s.rowTitle}>{w.name}</span>
                          <span className={s.rowMeta}>
                            {target?.name ?? 'unassigned'} · {w.startedAt}
                          </span>
                        </span>
                        <span className={s.rowProgress}>
                          <span className={s.progressTrack}>
                            <span className={s.progressFill} style={{ width: `${w.progress ?? 0}%` }} />
                          </span>
                          <span className={s.progressValue}>{w.progress ?? 0}%</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section
            title="Coordination"
            note="What Thylas did with your choices. It recommends and records; it does not schedule."
            id="coordination"
          >
            {log.length === 0 ? (
              <p className={s.quiet}>
                No decisions this session. Choices you make in Find compute or while connecting a machine
                appear here.
              </p>
            ) : (
              <ul className={s.log}>
                {log.map((d) => (
                  <li key={d.id} className={s.logItem}>
                    <span className={s.logWhen}>{clock(d.at)}</span>
                    <span className={s.logText}>
                      <span className={s.logKind}>{DECISION_WORD[d.kind]}</span> {d.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className={s.coordinationFoot}>
              <Button size="sm" onClick={() => navigate(routes.computeFind())} icon={<IconArrow size={13} />}>
                Find compute for a workload
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate(routes.computeNewResource())} icon={<IconPlus size={13} />}>
                Add a machine
              </Button>
            </div>
          </Section>
        </div>
      </div>

      <p className={s.footNote}>
        Status is read from each connection when the page loads. Utilization comes from the host's own
        sampler; where none exists, the column says so instead of showing zero. Nothing on this page can
        start or move work.
      </p>
    </ComputeShell>
  );
}
