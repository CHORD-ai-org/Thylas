import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import {
  EMPTY_INSTANCE_FILTER,
  filterInstances,
  hardwareBrief,
  type Availability,
} from '../../data/compute';
import { backendById, backendsView, instancesView, useCompute } from '../../state/compute';
import { PlainLayout } from '../../shell/layouts';
import { AVAILABILITY_WORD, ComputeShell, Mark, StatusPair } from './parts';
import s from './compute.module.css';

/**
 * Instances: machines an exposed backend can reach. Operations, not product
   identity — backends without instance semantics never appear here, by rule.
 */
export function ComputeInstances() {
  useCompute();
  const [params] = useSearchParams();
  const backends = backendsView();

  const [filter, setFilter] = useState(() => ({
    ...EMPTY_INSTANCE_FILTER,
    backendId: params.get('backend') ?? 'all',
    scope: (params.get('scope') as 'personal' | 'org' | 'all' | null) ?? 'all',
    availability: (params.get('availability') as Availability | null) ?? ('all' as const),
  }));

  const instances = instancesView();
  const visible = filterInstances(instances, filter, backends);

  return (
    <PlainLayout size="console">
      <ComputeShell
        title="Instances"
        sub="The concrete machines behind exposed backends — local, SSH, acquired. Environments that provision their own capacity (Slurm, serverless) are not listed here; they are targeted directly in Run."
      >
        <div className={s.toolbar}>
          <div className={s.toolbarMain}>
            <input
              className={s.search}
              type="search"
              aria-label="Search instances"
              placeholder="Search name, OS, hardware"
              value={filter.query}
              onChange={(e) => setFilter({ ...filter, query: e.target.value })}
            />
            <div className={s.selectWrap}>
              <span className={s.selectLabel}>Backend</span>
              <select
                className={s.select}
                aria-label="Filter by backend"
                value={filter.backendId}
                onChange={(e) => setFilter({ ...filter, backendId: e.target.value })}
              >
                <option value="all">All</option>
                {backends.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={s.selectWrap}>
              <span className={s.selectLabel}>Availability</span>
              <select
                className={s.select}
                aria-label="Filter by availability"
                value={filter.availability}
                onChange={(e) => setFilter({ ...filter, availability: e.target.value as Availability | 'all' })}
              >
                {(['all', 'available', 'busy', 'offline', 'unknown'] as const).map((a) => (
                  <option key={a} value={a}>
                    {a === 'all' ? 'All' : AVAILABILITY_WORD[a]}
                  </option>
                ))}
              </select>
            </div>
            <div className={s.selectWrap}>
              <span className={s.selectLabel}>Scope</span>
              <select
                className={s.select}
                aria-label="Filter by scope"
                value={filter.scope}
                onChange={(e) => setFilter({ ...filter, scope: e.target.value as 'personal' | 'org' | 'all' })}
              >
                <option value="all">All</option>
                <option value="personal">Personal</option>
                <option value="org">Organisation</option>
              </select>
            </div>
          </div>
        </div>

        <div className={s.resultLine}>
          <span className={s.resultCount}>
            {visible.length} instance{visible.length === 1 ? '' : 's'}
          </span>
          <span className={s.resultNote}>
            Unreachable machines report availability unknown — and no utilization, ever.
          </span>
        </div>

        <div className={s.table}>
          <div className={[s.tr, s.thead].join(' ')}>
            <span>Instance</span>
            <span>Backend</span>
            <span>Hardware</span>
            <span>Connection · availability</span>
            <span className={s.num}>Work</span>
            <span>Seen</span>
          </div>
          {visible.map((instance) => {
            const backend = backendById(instance.backendId);
            return (
              <Link key={instance.id} className={s.tr} to={routes.computeInstance(instance.id)} data-instance-row={instance.id}>
                <span className={s.tdName}>
                  <Mark name={backend?.name ?? '?'} size="sm" />
                  <span className={s.tdTitle}>{instance.name}</span>
                </span>
                <span className={s.tdProvider}>{backend?.name ?? instance.backendId}</span>
                <span className={s.tdHardware}>{hardwareBrief(instance.hardware)}</span>
                <span>
                  <StatusPair instance={instance} />
                </span>
                <span className={s.num}>{instance.workloads}</span>
                <span className={s.tdProvider}>{instance.lastSeen}</span>
              </Link>
            );
          })}
          {visible.length === 0 ? (
            <p className={s.sectionNote} style={{ paddingTop: 12 }}>
              Nothing matches these filters.
            </p>
          ) : null}
        </div>
      </ComputeShell>
    </PlainLayout>
  );
}
