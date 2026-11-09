import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { appOf, type CatalogApp, type Integration } from '../../data/connect';
import { customIntegrations, integrationsView } from '../../state/connect';
import { StatusDot } from '../../components/ui';
import s from './connect.module.css';

/* The pieces every Connect screen shares, in one file so a mark, a status word
   or a scope badge cannot drift between five screens. */

export function AppMark({ appId, size = 'md' }: { appId: string; size?: 'sm' | 'md' }) {
  const app = appOf(appId);
  const letters = (app?.name ?? '?')
    .split(/[\s-]+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={s.appMark} data-size={size} aria-hidden title={app?.name}>
      {letters}
    </span>
  );
}

export function ScopeBadge({ integration }: { integration: Integration }) {
  return (
    <span className={s.scopeBadge}>
      {integration.scope === 'org' ? `ORG · ${integration.owner.toUpperCase()}` : 'PERSONAL'}
    </span>
  );
}

/** One status word. A connection is connected; nothing else is a connection. */
export function IntegrationStatus() {
  return (
    <span className={s.tierWord} data-tier="connected" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <StatusDot tone="ok" />
      Connected
    </span>
  );
}

export const TIER_WORD: Record<CatalogApp['tier'], string> = {
  available: 'Available to connect',
  'coming-soon': 'Coming soon',
  unsupported: 'Unsupported',
};

export function TierWord({ app }: { app: CatalogApp }) {
  return (
    <span className={s.tierWord} data-tier={app.tier}>
      {TIER_WORD[app.tier]}
    </span>
  );
}

const TABS = [
  { id: 'connected', label: 'Connected', href: routes.connect() },
  { id: 'discover', label: 'Discover', href: routes.connectDiscover() },
  { id: 'custom', label: 'Custom integrations', href: routes.connectCustom() },
];

export function ConnectTabs() {
  const count = integrationsView().length;
  const customCount = customIntegrations().length;

  return (
    <nav className={s.tabs} aria-label="Connect sections">
      {TABS.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.href}
          end={tab.id === 'connected'}
          className={({ isActive }) => [s.tab, isActive ? s.tabOn : ''].join(' ')}
        >
          {tab.label}
          {tab.id === 'connected' ? <span className={s.tabCount}>{count}</span> : null}
          {tab.id === 'custom' && customCount > 0 ? <span className={s.tabCount}>{customCount}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * The frame every Connect screen sits in. The subsentence is the provenance
 * mark: connections shown here are authored samples, and no authorization
 * happens anywhere in this build. A reader who finds that out by pressing
 * something has been lied to — so the sentence comes first.
 */
export function ConnectShell({
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
          <p className={s.eyebrow}>CHORD · Connect</p>
          <h1 className={s.title}>{title ?? 'Connect'}</h1>
          <p className={s.sub}>
            {sub ??
              'External applications and what Thylas may do through them. Connections shown here are authored samples; no authorization happens in this build.'}
          </p>
        </div>
        {actions ? <div className={s.headActions}>{actions}</div> : null}
      </header>

      <ConnectTabs />

      <div className={s.body}>{children}</div>
    </>
  );
}
