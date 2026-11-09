import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { Chip, StatusDot } from '../../components/ui';
import type { Availability, Resource } from '../../data/compute';
import { availabilityOf, providerOf } from '../../data/compute';
import type { Tone } from '../../lib/tone';
import s from './compute.module.css';

/* The pieces every Compute screen shares. Kept in one file so a status word, a
   provider mark or a utilization bar cannot drift between six pages. */

export const CONNECTION_TONE: Record<Resource['connection'], Tone> = {
  connected: 'ok',
  connecting: 'live',
  disconnected: 'idle',
  error: 'error',
};

export const CONNECTION_WORD: Record<Resource['connection'], string> = {
  connected: 'Connected',
  connecting: 'Connecting',
  disconnected: 'Disconnected',
  error: 'Connection error',
};

export const AVAILABILITY_WORD: Record<Availability, string> = {
  available: 'Available',
  busy: 'Busy',
  offline: 'Offline',
  unknown: 'Availability unknown',
};

/**
 * Connection and availability, side by side and never merged. A reader has to
 * be able to see "Connected · Busy" (fine, it is running something) and
 * "Connection error · Availability unknown" (not fine, we cannot see it).
 */
export function StatusPair({ resource }: { resource: Resource }) {
  const avail = availabilityOf(resource);
  return (
    <span className={s.status} data-unknown={avail === 'unknown' || undefined}>
      <span className={s.statusConn}>
        <StatusDot tone={CONNECTION_TONE[resource.connection]} pulse={resource.connection === 'connecting'} />
        {CONNECTION_WORD[resource.connection]}
      </span>
      <span className={s.statusSep} aria-hidden>
        ·
      </span>
      <span className={s.statusAvail}>{AVAILABILITY_WORD[avail]}</span>
    </span>
  );
}

export function AvailabilityChip({ availability }: { availability: Availability }) {
  const tone: Tone | 'plain' =
    availability === 'available' ? 'ok' : availability === 'busy' ? 'warn' : 'plain';
  return <Chip tone={tone}>{AVAILABILITY_WORD[availability]}</Chip>;
}

/**
 * A provider is a name, not a logo. Two letters in a hairline square — the
 * same construction as the file type tiles, so a provider never becomes the
 * loudest colour on the page.
 */
export function ProviderMark({ providerId, size = 'md' }: { providerId: string; size?: 'sm' | 'md' }) {
  const provider = providerOf(providerId);
  const letters = (provider?.name ?? '?')
    .split(/[\s-]+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={s.providerMark} data-size={size} aria-hidden title={provider?.name}>
      {letters}
    </span>
  );
}

export function ProviderName({ providerId }: { providerId: string }) {
  const provider = providerOf(providerId);
  return <span className={s.providerName}>{provider?.name ?? providerId}</span>;
}

/** A utilization bar exists only when the number does. No bar, no guess. */
export function UtilBar({ value, label }: { value: number; label: string }) {
  return (
    <span className={s.util} title={`${label} ${value}%`}>
      <span className={s.utilLabel}>{label}</span>
      <span className={s.utilTrack}>
        <span className={s.utilFill} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} data-high={value >= 85 || undefined} />
      </span>
      <span className={s.utilValue}>{value}%</span>
    </span>
  );
}

/**
 * Tables get one line per machine, not three stacked bars: a 40px row that grows
 * to 68px because a cell contains a chart stops being a table.
 */
export function UtilizationInline({ resource }: { resource: Resource }) {
  const util = resource.connection === 'connected' ? resource.utilization : undefined;
  if (!util) return <span className={s.utilNone}>—</span>;
  const hot = (v: number) => v >= 85;
  return (
    <span className={s.utilInline}>
      <span data-hot={hot(util.cpu) || undefined}>CPU {util.cpu}</span>
      {util.gpu === undefined ? null : <span data-hot={hot(util.gpu) || undefined}>GPU {util.gpu}</span>}
      <span data-hot={hot(util.memory) || undefined}>MEM {util.memory}</span>
    </span>
  );
}

export function Utilization({ resource }: { resource: Resource }) {
  const util = resource.connection === 'connected' ? resource.utilization : undefined;
  if (!util) {
    return (
      <span className={s.utilNone}>
        {resource.connection === 'connected' ? 'No sampler on this host' : 'Not measurable while unreachable'}
      </span>
    );
  }
  return (
    <span className={s.utilGroup}>
      <UtilBar label="CPU" value={util.cpu} />
      {util.gpu === undefined ? null : <UtilBar label="GPU" value={util.gpu} />}
      <UtilBar label="MEM" value={util.memory} />
    </span>
  );
}

export function Section({
  title,
  note,
  aside,
  children,
  id,
}: {
  title: string;
  note?: string;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className={s.section} aria-labelledby={id}>
      <header className={s.sectionHead}>
        <h2 className={s.sectionTitle} id={id}>
          {title}
        </h2>
        {aside ? <span className={s.sectionAside}>{aside}</span> : null}
      </header>
      {note ? <p className={s.sectionNote}>{note}</p> : null}
      {children}
    </section>
  );
}

const TABS = [
  { id: 'overview', label: 'Overview', href: routes.compute() },
  { id: 'resources', label: 'Resources', href: routes.computeResources() },
  { id: 'providers', label: 'Providers', href: routes.computeProviders() },
  { id: 'workloads', label: 'Workloads', href: routes.computeWorkloads() },
  { id: 'find', label: 'Find compute', href: routes.computeFind() },
];

/** Two counts, because only two of these five tabs have something to count. */
export function ComputeTabs({ resourceCount, runningCount }: { resourceCount: number; runningCount: number }) {
  return (
    <nav className={s.tabs} aria-label="Compute sections">
      {TABS.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.href}
          end={tab.id === 'overview'}
          className={({ isActive }) => [s.tab, isActive ? s.tabOn : ''].join(' ')}
        >
          {tab.label}
          {tab.id === 'resources' ? <span className={s.tabCount}>{resourceCount}</span> : null}
          {tab.id === 'workloads' ? <span className={s.tabCount}>{runningCount}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}
