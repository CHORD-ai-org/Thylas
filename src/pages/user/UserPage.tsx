import { useEffect, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { THEME_LABEL } from '../../lib/theme';
import { RECENT, USER } from '../../data/mock';
import type { Workspace } from '../../data/types';
import { useWorkspaces } from '../../state/workspaces';
import { instancesView, useCompute } from '../../state/compute';
import { displayNameOf, prefsOf, setDisplayName, setPref, useUser, type Landing } from '../../state/user';
import { Button, EmptyState, Field } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import s from './user.module.css';

const SECTIONS = [
  { id: 'identity', label: 'Identity' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'environment', label: 'My environment' },
  { id: 'security', label: 'Security & sessions' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const LANDING_OPTIONS: { value: Landing; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'recently', label: 'Recently' },
  { value: 'notes', label: 'Notes' },
];

export function UserPage() {
  const { section = 'identity' } = useParams();
  const user = useUser();
  const workspaces = useWorkspaces();
  useCompute();
  const resources = instancesView();
  const prefs = prefsOf(user);

  const [notice, setNotice] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  const name = displayNameOf(user, USER.name);

  /* The one preference with a global effect is applied where it is changed:
     the row height is a CSS variable, and this is where the variable is set. */
  useEffect(() => {
    document.documentElement.style.setProperty('--h-row', prefs.density === 'compact' ? '26px' : '32px');
  }, [prefs.density]);

  const current: SectionId = (SECTIONS.some((x) => x.id === section) ? section : 'identity') as SectionId;

  const saveName = () => {
    setDisplayName(draftName);
    setEditingName(false);
    setNotice(
      draftName.trim()
        ? 'Name shown in this app only. The identity provider still holds the account.'
        : 'Name reset to what the identity provider holds.',
    );
  };

  const connectedCount = resources.filter((r) => r.connection === 'connected').length;

  /* Recent environments: the workspaces this person was last in, not the
     objects — the objects belong to Recently. Deleted workspaces are skipped
     by resolving against the live list. */
  const seen = new Set<string>();
  const recentEnv: Workspace[] = [];
  for (const item of RECENT) {
    if (seen.has(item.wsId)) continue;
    const ws = workspaces.find((w) => w.id === item.wsId);
    if (!ws) continue;
    seen.add(item.wsId);
    recentEnv.push(ws);
    if (recentEnv.length === 3) break;
  }

  return (
    <PlainLayout wide>
      <header className={s.head}>
        <h1 className={s.title}>User</h1>
        <div style={{ marginTop: 10 }}>
          <Link className={s.linkArrow} to={routes.profileInit()} data-profile-init>
            Initialize profile from public sources
          </Link>
        </div>
        <p className={s.sub}>
          The person using Thylas: identity, preferences, and a view of their own environment.
          Compute owns machines, Connect owns integrations, and neither is managed here.
        </p>
      </header>

      <div className={s.layout}>
        <nav className={s.nav} aria-label="User sections">
          {SECTIONS.map((item) => (
            <NavLink
              key={item.id}
              to={routes.user(item.id)}
              className={({ isActive }) => [s.navItem, isActive ? s.navOn : ''].join(' ')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={s.content}>
          {notice ? (
            <p className={s.notice} role="status">
              {notice}
            </p>
          ) : null}

          {current === 'identity' ? (
            <section className={s.section} aria-labelledby="user-identity">
              <h2 className={s.sectionTitle} id="user-identity">
                Identity
              </h2>
              <p className={s.sectionSub}>
                Identity comes from the CHORD identity provider; Thylas holds only a session
                and one name you may write over it with.
              </p>

              <div className={s.identity}>
                <span className={s.avatarBig} aria-hidden>
                  {USER.initials.slice(0, 1)}
                </span>
                <div className={s.identityText}>
                  <span className={s.identityName}>{name}</span>
                  <span className={s.identityMeta}>
                    {USER.role} · member since {USER.memberSince}
                  </span>
                </div>
                <div className={s.identityActions}>
                  <Button size="sm" disabled title="No avatar service is connected in this build.">
                    Change avatar
                  </Button>
                  <span className={s.reason}>Avatars would live with the identity provider.</span>
                </div>
              </div>

              {editingName ? (
                <form
                  className={s.nameForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveName();
                  }}
                >
                  <input
                    className={s.nameInput}
                    aria-label="Display name"
                    value={draftName}
                    maxLength={40}
                    onChange={(e) => setDraftName(e.target.value)}
                    autoFocus
                  />
                  <div className={s.nameFormActions}>
                    <Button size="sm" variant="primary" type="submit">
                      Save
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingName(false);
                        setDraftName('');
                      }}
                    >
                      Cancel
                    </Button>
                    <span className={s.reason}>Empty saves the provider name back.</span>
                  </div>
                </form>
              ) : (
                <div className={s.nameFormActions}>
                  <Button
                    size="sm"
                    onClick={() => {
                      setDraftName(name === USER.name ? '' : name);
                      setEditingName(true);
                    }}
                  >
                    Edit display name
                  </Button>
                </div>
              )}

              <div className={s.fields}>
                <Field label="Display name">{name}</Field>
                <Field label="Username">{USER.username}</Field>
                <Field label="Email">{USER.email}</Field>
                <Field label="Account ID">
                  <span style={{ fontFamily: 'var(--mono)' }}>{USER.accountId}</span>
                </Field>
                <Field label="Role">{USER.role}</Field>
                <Field label="Member since">{USER.memberSince}</Field>
              </div>

              <div className={s.planCard}>
                <div>
                  <p className={s.planName}>{USER.plan} plan</p>
                  <p className={s.planMeta}>500 credits / month · 10 GB storage · 2 workspaces</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setNotice('Plan changes happen at the billing provider; no provider is connected in this build.')}
                >
                  Manage plan
                </Button>
              </div>

              <div className={s.meters}>
                {[
                  { label: 'Credits this month', used: 42, total: 500, unit: 'credits', reset: 'Resets 1 Dec' },
                  { label: 'Storage', used: 3.1, total: 10, unit: 'GB', reset: 'No reset' },
                ].map((meter) => (
                  <div key={meter.label} className={s.meter}>
                    <div className={s.meterHead}>
                      <span>{meter.label}</span>
                      <span className={s.meterValue}>
                        {meter.used} / {meter.total} {meter.unit}
                      </span>
                    </div>
                    <div className={s.meterTrack}>
                      <span className={s.meterFill} style={{ width: `${(meter.used / meter.total) * 100}%` }} />
                    </div>
                    <p className={s.meterFoot}>{meter.reset}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {current === 'preferences' ? (
            <section className={s.section} aria-labelledby="user-prefs">
              <h2 className={s.sectionTitle} id="user-prefs">
                Preferences
              </h2>
              <p className={s.sectionSub}>
                Density, theme, landing page, default workspace, and the name above are real and
                apply immediately. Language packs are not shipped.
              </p>

              <div className={s.prefRow} data-pref-theme>
                <div>
                  <p className={s.prefLabel}>Theme</p>
                  <p className={s.prefHint}>Warm paper by default; black and white are the neutral palettes.</p>
                </div>
                <div className={s.prefControl}>
                  <div className={s.segmented} role="group" aria-label="Theme">
                    {(['warm', 'dark', 'light'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={[s.segment, prefs.theme === value ? s.segmentOn : ''].join(' ')}
                        onClick={() => setPref('theme', value)}
                        aria-pressed={prefs.theme === value}
                        data-theme-option={value}
                      >
                        {THEME_LABEL[value]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={s.prefRow}>
                <div>
                  <p className={s.prefLabel}>Language</p>
                  <p className={s.prefHint}>English only in v1; Chinese typography needs its own line heights.</p>
                </div>
                <span className={s.prefValue}>English</span>
              </div>

              <div className={s.prefRow}>
                <div>
                  <p className={s.prefLabel}>Row density</p>
                  <p className={s.prefHint}>Table and list rows. Applies immediately, and stays for the next visit.</p>
                </div>
                <div className={s.prefControl}>
                  <div className={s.segmented} role="group" aria-label="Row density">
                    {(['comfortable', 'compact'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={[s.segment, prefs.density === value ? s.segmentOn : ''].join(' ')}
                        onClick={() => setPref('density', value)}
                        aria-pressed={prefs.density === value}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={s.prefRow}>
                <div>
                  <p className={s.prefLabel}>Landing page</p>
                  <p className={s.prefHint}>Where the app opens. Takes effect the next time you arrive at the root.</p>
                </div>
                <div className={s.prefControl}>
                  <select
                    className={s.select}
                    aria-label="Landing page"
                    value={prefs.landing}
                    onChange={(e) => setPref('landing', e.target.value as Landing)}
                  >
                    {LANDING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={s.prefRow}>
                <div>
                  <p className={s.prefLabel}>Default workspace</p>
                  <p className={s.prefHint}>Shown in My environment and used where a default is asked for. Nothing is auto-opened.</p>
                </div>
                <div className={s.prefControl}>
                  <select
                    className={s.select}
                    aria-label="Default workspace"
                    value={prefs.defaultWorkspace ?? ''}
                    onChange={(e) => setPref('defaultWorkspace', e.target.value || null)}
                  >
                    <option value="">None set</option>
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={s.prefRow}>
                <div>
                  <p className={s.prefLabel}>Notifications</p>
                  <p className={s.prefHint}>A process that needs input would surface here. Prototype — no notification service exists.</p>
                </div>
                <div className={s.prefControl}>
                  <button type="button" className={s.prototypeSwitch} disabled title="No notification service is connected in this build.">
                    Off
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {current === 'environment' ? (
            <section className={s.section} aria-labelledby="user-env">
              <h2 className={s.sectionTitle} id="user-env">
                My environment
              </h2>
              <p className={s.sectionSub}>
                A view, not a manager. Machines are owned by Compute; workspaces are owned by
                themselves. Everything here links out.
              </p>

              <div className={s.envList}>
                {prefs.defaultWorkspace ? (
                  <a className={s.envRow} href={routes.files(prefs.defaultWorkspace)}>
                    <span className={s.envMain}>
                      <span className={s.envTitle}>
                        {workspaces.find((w) => w.id === prefs.defaultWorkspace)?.name ?? 'Workspace no longer exists'}
                      </span>
                      <span className={s.envMeta}>Default workspace · from Preferences</span>
                    </span>
                    <span className={s.envAside}>Files →</span>
                  </a>
                ) : (
                  <div className={s.envRow}>
                    <span className={s.envMain}>
                      <span className={s.envTitle}>No default workspace</span>
                      <span className={s.envMeta}>Set one in Preferences.</span>
                    </span>
                  </div>
                )}

                <a className={s.envRow} href={routes.computeInstances()}>
                  <span className={s.envMain}>
                    <span className={s.envTitle}>Compute pool</span>
                    <span className={s.envMeta}>
                      {resources.length} machine{resources.length === 1 ? '' : 's'} · {connectedCount} connected —
                      the list itself lives in Compute
                    </span>
                  </span>
                  <span className={s.envAside}>Instances →</span>
                </a>

                <a className={s.envRow} href={`${routes.computeInstances()}?scope=personal`}>
                  <span className={s.envMain}>
                    <span className={s.envTitle}>Personal machines</span>
                    <span className={s.envMeta}>The pool filtered to what you own</span>
                  </span>
                  <span className={s.envAside}>Instances →</span>
                </a>

                {recentEnv.map((ws) => (
                  <a key={ws.id} className={s.envRow} href={routes.files(ws.id)}>
                    <span className={s.envMain}>
                      <span className={s.envTitle}>{ws.name}</span>
                      <span className={s.envMeta}>Recent environment · {ws.scope === 'org' ? 'organisation' : 'personal'}</span>
                    </span>
                    <span className={s.envAside}>Files →</span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {current === 'security' ? (
            <section className={s.section} aria-labelledby="user-sec">
              <h2 className={s.sectionTitle} id="user-sec">
                Security & sessions
              </h2>
              <p className={s.sectionSub}>
                What this build actually has: one local profile in one browser. Authentication,
                device management and remote sign-out belong to an identity service that is not
                connected here, so nothing pretends to do them.
              </p>

              <div className={s.sessionRow}>
                <span className={s.sessionText}>
                  <span className={s.sessionTitle}>This browser</span>
                  <span className={s.sessionMeta}>Local profile · preferences and notes are stored on this machine.</span>
                </span>
                <span className={s.prefValue}>Active now</span>
              </div>

              <div className={s.fields}>
                <Field label="Authentication">Identity provider (CHORD) — not connected in this build</Field>
                <Field label="Authorized devices">None recorded</Field>
              </div>

              <div className={s.prefRow}>
                <div>
                  <p className={s.prefLabel}>API keys</p>
                  <p className={s.prefHint}>A key is shown once, at creation, and never again.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setNotice('Key issuance needs the API key service; it is not connected in this build.')}
                >
                  Create key
                </Button>
              </div>

              <div className={s.prefRow}>
                <div>
                  <p className={s.prefLabel}>Sign out</p>
                  <p className={s.prefHint}>There is no session to end: no auth service is connected, so this build holds no credentials.</p>
                </div>
                <Button size="sm" disabled title="No auth service is connected in this build.">
                  Sign out
                </Button>
              </div>

              <EmptyState
                title="No security events"
                hint="Events would come from the identity service. This page does not invent them."
              />
            </section>
          ) : null}

          {!SECTIONS.some((x) => x.id === current) ? (
            <EmptyState title="No such section" hint="User has four sections; this is not one of them." />
          ) : null}
        </div>
      </div>
    </PlainLayout>
  );
}
