import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import {
  PROVIDERS,
  availabilityOf,
  filterResources,
  hardwareBrief,
  hardwareSummary,
  type Availability,
  type Resource,
  type ResourceFilter,
  type ResourceKind,
} from '../../data/compute';
import { activeCount, resourcesView, useCompute } from '../../state/compute';
import { Badge, Button, EmptyState } from '../../components/ui';
import { IconPlus } from '../../components/icons';
import { ComputeShell } from './ComputeShell';
import { AVAILABILITY_WORD, ProviderMark, ProviderName, StatusPair, UtilizationInline } from './parts';
import s from './compute.module.css';

const KINDS: { id: ResourceKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'local', label: 'Local' },
  { id: 'ssh', label: 'SSH' },
  { id: 'instance', label: 'Instance' },
];

const AVAILABILITY: { id: Availability | 'all'; label: string }[] = [
  { id: 'all', label: 'Any state' },
  { id: 'available', label: 'Available' },
  { id: 'busy', label: 'Busy' },
  { id: 'offline', label: 'Offline' },
  { id: 'unknown', label: 'Unknown' },
];

/** The filter lives in the URL, like the process filter: a filtered pool is a link. */
function parse(params: URLSearchParams): ResourceFilter {
  const kind = params.get('kind');
  const availability = params.get('availability');
  const scope = params.get('scope');
  return {
    query: params.get('q') ?? '',
    providerId: PROVIDERS.some((p) => p.id === params.get('provider')) ? (params.get('provider') as string) : 'all',
    kind: KINDS.some((k) => k.id === kind) ? (kind as ResourceKind) : 'all',
    availability: AVAILABILITY.some((a) => a.id === availability) ? (availability as Availability) : 'all',
    scope: scope === 'personal' || scope === 'org' ? scope : 'all',
  };
}

export function ComputeResources() {
  useCompute();

  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const filter = parse(params);
  const view = params.get('view') === 'grid' ? 'grid' : 'list';
  const all = resourcesView();
  const rows = filterResources(all, filter);

  const set = (patch: Partial<ResourceFilter> & { view?: 'list' | 'grid' }) => {
    const next = new URLSearchParams(params);
    const write = (key: string, value: string | undefined, fallback: string) => {
      if (!value || value === fallback) next.delete(key);
      else next.set(key, value);
    };
    if ('query' in patch) write('q', patch.query?.trim() || undefined, '');
    if ('providerId' in patch) write('provider', patch.providerId === 'all' ? undefined : patch.providerId!, 'all');
    if ('kind' in patch) write('kind', patch.kind === 'all' ? undefined : patch.kind!, 'all');
    if ('availability' in patch) write('availability', patch.availability === 'all' ? undefined : patch.availability!, 'all');
    if ('scope' in patch) write('scope', patch.scope === 'all' ? undefined : patch.scope!, 'all');
    if (patch.view) write('view', patch.view === 'list' ? undefined : 'grid', 'list');
    setParams(next, { replace: true });
  };

  const filtered = params.toString().length > 0;

  return (
    <ComputeShell
      actions={
        <Button icon={<IconPlus size={13} />} onClick={() => navigate(routes.computeNewResource())}>
          Add resource
        </Button>
      }
    >
      <div className={s.toolbar}>
        <div className={s.toolbarMain}>
        <input
          className={s.search}
          type="search"
          value={filter.query}
          placeholder="Search name, hardware, OS, provider"
          aria-label="Search resources"
          onChange={(e) => set({ query: e.target.value })}
        />
        <label className={s.selectWrap}>
          <span className={s.selectLabel}>Provider</span>
          <select
            className={s.select}
            value={filter.providerId}
            onChange={(e) => set({ providerId: e.target.value as ResourceFilter['providerId'] })}
            aria-label="Filter by provider"
          >
            <option value="all">All providers</option>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className={s.toolbarEnd}>
          <div className={s.segmented} role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'list'} className={s.segBtn} onClick={() => set({ view: 'list' })}>
              List
            </button>
            <button type="button" aria-pressed={view === 'grid'} className={s.segBtn} onClick={() => set({ view: 'grid' })}>
              Grid
            </button>
          </div>
        </div>
        </div>

        <div className={s.toolbarChips}>
        <div className={s.chipRow} role="group" aria-label="Filter by resource type">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={[s.chip, filter.kind === k.id ? s.chipOn : ''].join(' ')}
              aria-pressed={filter.kind === k.id}
              onClick={() => set({ kind: k.id })}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className={s.chipRow} role="group" aria-label="Filter by availability">
          {AVAILABILITY.map((a) => (
            <button
              key={a.id}
              type="button"
              className={[s.chip, filter.availability === a.id ? s.chipOn : ''].join(' ')}
              aria-pressed={filter.availability === a.id}
              onClick={() => set({ availability: a.id })}
            >
              {a.label}
            </button>
          ))}
        </div>
        </div>
      </div>

      <div className={s.resultLine}>
        <span className={s.resultCount}>
          {rows.length} of {all.length} resources
        </span>
        {filtered ? (
          <button type="button" className={s.clear} onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Clear filters
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? 'The pool is empty' : 'No machine matches these filters'}
          hint={
            all.length === 0
              ? 'Add a local machine, an SSH server, or a cloud account to give Thylas something to read.'
              : 'Loosen one filter. A machine that is unreachable counts as unknown, not available.'
          }
          action={
            all.length === 0 ? (
              <Button onClick={() => navigate(routes.computeNewResource())}>Add a resource</Button>
            ) : (
              <Button variant="ghost" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                Clear filters
              </Button>
            )
          }
        />
      ) : view === 'grid' ? (
        <ul className={s.grid}>
          {rows.map((r) => (
            <li key={r.id}>
              <ResourceCard resource={r} />
            </li>
          ))}
        </ul>
      ) : (
        <div className={s.table}>
          <div className={[s.tr, s.thead].join(' ')} role="row">
            <span>Name</span>
            <span>Provider</span>
            <span>Hardware</span>
            <span>Status</span>
            <span>Utilization</span>
            <span className={s.num}>Runs</span>
          </div>
          {rows.map((r) => (
            <Link key={r.id} to={routes.computeResource(r.id)} className={s.tr} role="row">
              <span className={s.tdName}>
                <ProviderMark providerId={r.providerId} size="sm" />
                <span className={s.tdNameText}>
                  <span className={s.tdTitle}>{r.name}</span>
                  <Badge>{r.scope === 'org' ? `ORG · ${r.owner.toUpperCase()}` : 'PERSONAL'}</Badge>
                </span>
              </span>
              <span className={s.tdProvider}>
                <ProviderName providerId={r.providerId} />
              </span>
              <span className={s.tdHardware}>{hardwareBrief(r.hardware)}</span>
              <span>
                <StatusPair resource={r} />
              </span>
              <span>
                <UtilizationInline resource={r} />
              </span>
              <span className={s.num}>{activeCount(r.id)}</span>
            </Link>
          ))}
        </div>
      )}
    </ComputeShell>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  const avail = availabilityOf(resource);
  return (
    <Link to={routes.computeResource(resource.id)} className={s.card}>
      <span className={s.cardTop}>
        <ProviderMark providerId={resource.providerId} />
        <span className={s.cardName}>{resource.name}</span>
        <Badge>{resource.scope === 'org' ? 'ORG' : 'PERSONAL'}</Badge>
      </span>
      <span className={s.cardProvider}>
        <ProviderName providerId={resource.providerId} /> · {resource.kind === 'instance' ? 'instance' : resource.kind}
      </span>
      <span className={s.cardHardware}>{hardwareSummary(resource.hardware)}</span>
      <span className={s.cardStatus}>
        <StatusPair resource={resource} />
      </span>
      <span className={s.cardFoot}>
        <span className={s.cardAvail} data-state={avail}>
          {AVAILABILITY_WORD[avail]}
        </span>
        <span className={s.cardRuns}>{activeCount(resource.id)} runs</span>
      </span>
    </Link>
  );
}
