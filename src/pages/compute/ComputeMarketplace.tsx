import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import {
  EMPTY_LISTING_FILTER,
  LISTINGS,
  BACKEND_TYPE_LABEL,
  filterListings,
  hardwareBrief,
  type Hardware,
} from '../../data/compute';
import { useCompute } from '../../state/compute';
import { Badge, Button, Chip, EmptyState } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import { ComputeShell, Mark, Section } from './parts';
import s from './compute.module.css';

/**
 * Marketplace: discovering capacity to acquire. Rates and availability are
 * representative samples — the banner says so before anything else does, and
 * acquiring explains what would happen instead of doing it.
 */
export function ComputeMarketplace() {
  useCompute();
  const [filter, setFilter] = useState(EMPTY_LISTING_FILTER);
  const visible = filterListings(LISTINGS, filter);

  const providers = [...new Set(LISTINGS.map((l) => l.provider))];
  const regions = [...new Set(LISTINGS.map((l) => l.region))];

  const set = <K extends keyof typeof filter>(key: K, value: (typeof filter)[K]) =>
    setFilter((f) => ({ ...f, [key]: value }));

  return (
    <PlainLayout size="console">
      <ComputeShell
        title="Marketplace"
        sub="Where more capacity comes from. Acquiring is a separate act from executing: a machine obtained here is used through a backend — SSH today, Kubernetes when one is attached."
      >
        <p className={s.marketNote} data-market-banner>
          Prices and availability below are <strong>representative samples</strong>, not live data. No billing, no
          provisioning, no provider contact exists in this build.
        </p>

        <div className={s.toolbar} style={{ marginTop: 'var(--s4)' }}>
          <div className={s.toolbarMain}>
            <div className={s.selectWrap}>
              <span className={s.selectLabel}>Provider</span>
              <select className={s.select} aria-label="Filter by provider" value={filter.provider} onChange={(e) => set('provider', e.target.value)}>
                <option value="all">All</option>
                {providers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className={s.selectWrap}>
              <span className={s.selectLabel}>GPU class</span>
              <select className={s.select} aria-label="Filter by GPU class" value={filter.gpuClass} onChange={(e) => set('gpuClass', (e.target.value || 'all') as Hardware['gpuClass'] | 'all')}>
                <option value="all">All</option>
                <option value="datacenter">Datacenter</option>
                <option value="workstation">Workstation</option>
                <option value="consumer">Consumer</option>
              </select>
            </div>
            <div className={s.selectWrap}>
              <span className={s.selectLabel}>Min GPU memory</span>
              <input
                className={s.input}
                style={{ width: 72 }}
                aria-label="Minimum GPU memory in GB"
                inputMode="numeric"
                value={filter.minGpuMemoryGb ?? ''}
                onChange={(e) => set('minGpuMemoryGb', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
              />
            </div>
            <div className={s.selectWrap}>
              <span className={s.selectLabel}>Region</span>
              <select className={s.select} aria-label="Filter by region" value={filter.region} onChange={(e) => set('region', e.target.value)}>
                <option value="all">All</option>
                {regions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className={s.selectWrap}>
              <span className={s.selectLabel}>Max rate</span>
              <input
                className={s.input}
                style={{ width: 72 }}
                aria-label="Maximum hourly rate in dollars"
                inputMode="decimal"
                value={filter.maxRate ?? ''}
                onChange={(e) => set('maxRate', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
              />
            </div>
            <div className={s.selectWrap}>
              <span className={s.selectLabel}>Usable via</span>
              <select className={s.select} aria-label="Filter by backend type" value={filter.useVia} onChange={(e) => set('useVia', (e.target.value || 'all') as typeof filter.useVia)}>
                <option value="all">Any</option>
                <option value="ssh">SSH</option>
                <option value="kubernetes">Kubernetes</option>
              </select>
            </div>
            {filter !== EMPTY_LISTING_FILTER ? (
              <button type="button" className={s.clear} onClick={() => setFilter(EMPTY_LISTING_FILTER)}>
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className={s.resultLine}>
          <span className={s.resultCount}>
            {visible.length} listing{visible.length === 1 ? '' : 's'}
          </span>
          <span className={s.resultNote}>sorted by nothing — filter for what matters</span>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Nothing matches these filters"
            hint="The catalog holds six representative configurations. Loosen one, or check back when real provider data is connected."
          />
        ) : (
          <ul className={s.rows}>
            {visible.map((l) => (
              <li key={l.id} className={s.listingRow} data-listing-row={l.id}>
                <div className={s.listingIdentity}>
                  <Mark name={l.provider} />
                  <div className={s.listingText}>
                    <span className={s.listingTitle}>
                      <Link to={routes.computeListing(l.id)} className={s.linkArrow}>
                        {l.provider} · {l.name}
                      </Link>
                      {l.availability === 'waitlist' ? <span className={s.waitlist}>waitlist</span> : null}
                    </span>
                    <span className={s.listingBlurb}>{l.blurb}</span>
                  </div>
                </div>

                <span className={s.listingHardware}>
                  {hardwareBrief(l.hardware)}
                  <br />
                  {l.region}
                </span>

                <div className={s.listingRate}>
                  <span className={s.rateValue}>${l.ratePerHour.toFixed(2)}/h</span>
                  <span className={s.rateNote}>sample rate</span>
                </div>

                <span className={s.caps}>
                  {l.useVia.map((t) => (
                    <Chip key={t} tone="plain">
                      via {BACKEND_TYPE_LABEL[t]}
                    </Chip>
                  ))}
                </span>

                <div className={s.listingActions}>
                  <Link to={routes.computeListing(l.id)} className={s.linkArrow}>
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ComputeShell>
    </PlainLayout>
  );
}

/**
 * Listing detail: the spec, what the rate does not include, and how the
 * capacity would be used. Acquire explains; it never provisions.
 */
export function ComputeListingDetail() {
  const { listingId } = useParams();
  useCompute();
  const listing = LISTINGS.find((l) => l.id === listingId);
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);

  if (!listing) {
    return (
      <PlainLayout size="console">
        <ComputeShell title="Listing not found">
          <EmptyState
            title="No such listing"
            hint="The catalog holds a fixed set of representative configurations."
            action={<Link to={routes.computeMarketplace()} className={s.linkArrow}>Back to Marketplace</Link>}
          />
        </ComputeShell>
      </PlainLayout>
    );
  }

  return (
    <PlainLayout size="console">
      <ComputeShell
        title={`${listing.provider} · ${listing.name}`}
        sub={listing.blurb}
        actions={<Link to={routes.computeMarketplace()} className={s.backLink}>Marketplace</Link>}
      >
        <header className={s.detailHead}>
          <Mark name={listing.provider} />
          <div className={s.detailIdentity}>
            <span className={s.detailName}>
              {listing.name}
              <Badge>{listing.region.toUpperCase()}</Badge>
              {listing.availability === 'waitlist' ? <span className={s.waitlist}>waitlist</span> : null}
            </span>
            <span className={s.detailMeta}>{listing.provider}</span>
          </div>
          <div className={s.detailStatus}>
            <span className={s.rateValue}>${listing.ratePerHour.toFixed(2)}/h</span>
            <span className={s.rateNote}>representative rate</span>
          </div>
        </header>

        {notice ? (
          <p className={s.band} role="status" data-acquire-notice>
            {notice}
          </p>
        ) : null}

        <div className={s.detailGrid}>
          <div className={s.detailMain}>
            <Section title="Specification" note={hardwareBrief(listing.hardware)}>
              <div className={s.fields}>
                <SpecField label="CPU">{listing.hardware.cpu}</SpecField>
                <SpecField label="Cores">{listing.hardware.cores}</SpecField>
                <SpecField label="GPU">{listing.hardware.gpu ?? 'none'}</SpecField>
                {listing.hardware.gpuMemoryGb ? <SpecField label="GPU memory">{listing.hardware.gpuMemoryGb} GB</SpecField> : null}
                <SpecField label="Memory">{listing.hardware.memoryGb} GB</SpecField>
                <SpecField label="Storage">{listing.hardware.storageGb} GB</SpecField>
                <SpecField label="Region">{listing.region}</SpecField>
              </div>
            </Section>

            <Section title="How you would use it" note="Capacity is only useful through an execution backend. This listing works with:">
              <ul className={s.rows}>
                {listing.useVia.map((t) => (
                  <li key={t} className={s.row}>
                    <span className={s.rowMain}>
                      <span className={s.rowTitle}>{BACKEND_TYPE_LABEL[t]}</span>
                      <span className={s.rowMeta}>
                        {t === 'ssh'
                          ? 'Attach the host to an SSH backend; the machine appears in Instances.'
                          : 'Attach the cluster to a Kubernetes backend; jobs land in its namespace.'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className={s.sectionNote}>
                The rate covers the machine only. Egress, storage beyond the sample, and whatever the provider bills
                separately are not represented here.
              </p>
            </Section>
          </div>

          <div className={s.detailSide}>
            <Section title="Acquire">
              <div className={s.sideActions}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    setNotice(
                      'Acquiring would create the machine at the provider and return a host to attach to a backend. No billing or provisioning exists in this build — nothing happens.',
                    )
                  }
                  data-market-acquire
                >
                  Acquire
                </Button>
              </div>
              <p className={s.sectionNote}>
                Sample rate ${listing.ratePerHour.toFixed(2)}/h. Availability{' '}
                {listing.availability === 'waitlist' ? 'is a waitlist in the sample' : 'is representative'}.
              </p>
              <p className={s.sectionNote}>
                <button type="button" className={s.clear} onClick={() => navigate(routes.computeRun())}>
                  Check whether the current pool already fits →
                </button>
              </p>
            </Section>
          </div>
        </div>
      </ComputeShell>
    </PlainLayout>
  );
}

function SpecField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={s.selectLabel}>{label}</span>
      <p className={s.quiet} style={{ marginTop: 2 }}>
        {children}
      </p>
    </div>
  );
}
