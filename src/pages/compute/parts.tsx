import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { Chip, StatusDot } from '../../components/ui';
import {
  BACKEND_STATUS_WORD,
  BACKEND_TYPE_LABEL,
  availabilityOf,
  type Availability,
  type Backend,
  type ExecCapability,
  type Instance,
} from '../../data/compute';
import { backendsView, instancesView, useCompute, workloadsView } from '../../state/compute';
import type { Tone } from '../../lib/tone';
import s from './compute.module.css';

/* The pieces every Compute screen shares. One file, so a status word, a type
   mark or a utilization bar cannot drift between six screens. */

export const CONNECTION_TONE: Record<Instance['connection'], Tone> = {
  connected: 'ok',
  connecting: 'live',
  disconnected: 'idle',
  error: 'error',
};

export const CONNECTION_WORD: Record<Instance['connection'], string> = {
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

export const WORKLOAD_STATE_WORD: Record<string, string> = {
  running: 'running',
  queued: 'queued',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
};

/**
 * Connection and availability, side by side and never merged (D-048, kept in
 * v2): a reader has to see "Connected · Busy" and
 * "Connection error · Availability unknown" as different situations.
 */
export function StatusPair({ instance }: { instance: Instance }) {
  const avail = availabilityOf(instance);
  return (
    <span className={s.status} data-unknown={avail === 'unknown' || undefined}>
      <span className={s.statusConn}>
        <StatusDot tone={CONNECTION_TONE[instance.connection]} pulse={instance.connection === 'connecting'} />
        {CONNECTION_WORD[instance.connection]}
      </span>
      <span className={s.statusSep} aria-hidden>
        ·
      </span>
      <span className={s.statusAvail}>{AVAILABILITY_WORD[avail]}</span>
    </span>
  );
}

/** A backend's reachability, one word with its own tone. */
export function BackendStatusWord({ status, pulse }: { status: Backend['status']; pulse?: boolean }) {
  const tone: Tone =
    status === 'ready' ? 'ok' : status === 'unverified' ? 'warn' : status === 'error' || status === 'unreachable' ? 'error' : 'idle';
  return (
    <span className={s.statusWord} data-status={status}>
      <StatusDot tone={tone} pulse={pulse} />
      {BACKEND_STATUS_WORD[status]}
    </span>
  );
}

/**
 * A backend or provider is a name, not a logo: two letters in a hairline
 * square, the same construction as the file type tiles.
 */
export function Mark({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const letters = name
    .split(/[\s-]+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={s.mark} data-size={size} aria-hidden title={name}>
      {letters}
    </span>
  );
}

export function BackendMark({ backend, size = 'md' }: { backend: Backend; size?: 'sm' | 'md' }) {
  return <Mark name={BACKEND_TYPE_LABEL[backend.type]} size={size} />;
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

export function Utilization({ instance }: { instance: Instance }) {
  const util = instance.connection === 'connected' ? instance.utilization : undefined;
  if (!util) {
    return (
      <span className={s.utilNone}>
        {instance.connection === 'connected' ? 'No sampler on this host' : 'Not measurable while unreachable'}
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

export function CapabilityChips({ capabilities }: { capabilities: ExecCapability[] }) {
  if (capabilities.length === 0) return <span className={s.capNone}>no capabilities declared</span>;
  return (
    <span className={s.caps}>
      {capabilities.map((cap) => (
        <Chip key={cap} tone="plain">
          {cap}
        </Chip>
      ))}
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
  { id: 'backends', label: 'Backends', href: routes.computeBackends() },
  { id: 'run', label: 'Run', href: routes.computeRun() },
  { id: 'instances', label: 'Instances', href: routes.computeInstances() },
  { id: 'activity', label: 'Activity', href: routes.computeActivity() },
  { id: 'marketplace', label: 'Marketplace', href: routes.computeMarketplace() },
];

/** Only three of these six tabs have something to count. */
export function ComputeTabs() {
  useCompute();
  const backends = backendsView().length;
  const instances = instancesView().length;
  const running = workloadsView().filter((w) => w.state === 'running').length;

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
          {tab.id === 'backends' ? <span className={s.tabCount}>{backends}</span> : null}
          {tab.id === 'instances' ? <span className={s.tabCount}>{instances}</span> : null}
          {tab.id === 'activity' ? <span className={s.tabCount}>{running}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * The frame every Compute screen sits in: what the section is, the six
 * screens, and one sentence about what is simulated. The sentence is not
 * decoration — this pool has no executor behind it, and a reader who finds
 * that out by pressing something has been lied to.
 */
export function ComputeShell({
  children,
  title,
  sub,
  actions,
}: {
  children: ReactNode;
  title?: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <>
      <header className={s.head}>
        <div className={s.headText}>
          <p className={s.eyebrow}>CHORD · Compute</p>
          <h1 className={s.title}>{title ?? 'Compute'}</h1>
          <p className={s.sub}>
            {sub ??
              'Execution environments for computational work: local machines, SSH servers, clusters and managed services. Configuration, selection and history in one place — nothing starts, provisions or bills in this build.'}
          </p>
        </div>
        {actions ? <div className={s.headActions}>{actions}</div> : null}
      </header>

      <ComputeTabs />

      <div className={s.body}>{children}</div>
    </>
  );
}
