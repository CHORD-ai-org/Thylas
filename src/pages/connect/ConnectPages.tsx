import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import {
  APP_CATEGORY_LABEL,
  AUTH_LABEL,
  CATALOG,
  appOf,
  catalogByCategory,
  EMPTY_CATALOG_FILTER,
  filterCatalog,
  grantedScopes,
  type AppCategory,
} from '../../data/connect';
import {
  connectLog,
  customIntegrations,
  disconnectIntegration,
  integrationsView,
  integrationViewById,
  registerCustom,
  useConnect,
  type CustomAuth,
  type CustomKind,
} from '../../state/connect';
import { Badge, Button, Chip, EmptyState, StatusDot } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import { AppMark, ConnectShell, IntegrationStatus, ScopeBadge, TierWord } from './parts';
import s from './connect.module.css';

/* Connect — three views (Connected, Discover, Custom) and two detail shapes,
   one per noun: an integration someone made, and a catalog app someone could.
   No authorize flow reports success; no registration claims to be called. */

/* ---- Connected ----------------------------------------------------------- */

export function ConnectConnected() {
  useConnect();
  const integrations = integrationsView();

  return (
    <PlainLayout wide>
      <ConnectShell>
        <div className={s.resultLine}>
          <span className={s.resultCount}>
            {integrations.length} connection{integrations.length === 1 ? '' : 's'}
          </span>
          <span className={s.resultNote}>Last-accessed times are sample data — no runtime touches these apps.</span>
        </div>

        {integrations.length === 0 ? (
          <EmptyState
            title="No connections"
            hint="Everything connected in the sample has been disconnected in this session. Nothing reconnects here: authorization happens with the provider."
            action={<Link to={routes.connectDiscover()} className={s.linkArrow}>Browse Discover</Link>}
          />
        ) : (
          <ul className={s.rows}>
            {integrations.map((integration) => {
              const app = appOf(integration.appId);
              return (
                <li key={integration.id}>
                  <Link className={s.row} to={routes.connectIntegration(integration.id)} data-integration-row={integration.id}>
                    <AppMark appId={integration.appId} />
                    <span className={s.rowMain}>
                      <span className={s.rowTitle}>
                        {app?.name ?? integration.appId}
                        <Badge>{AUTH_LABEL[app?.auth ?? 'none'].toUpperCase()}</Badge>
                      </span>
                      <span className={s.rowMeta}>
                        {integration.account} · connected {integration.connected}
                      </span>
                    </span>
                    <span className={s.rowAside}>
                      <ScopeBadge integration={integration} />
                      <span className={s.rowWhen}>
                        {integration.lastAccessed ? `accessed ${integration.lastAccessed}` : 'never accessed'}
                      </span>
                    </span>
                    <IntegrationStatus />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className={s.footNote}>
          A connection grants only the scopes that were granted — never everything the app can
          do. What each connection may and may not do is on its detail page.
        </p>
      </ConnectShell>
    </PlainLayout>
  );
}

/* ---- Integration detail -------------------------------------------------- */

export function ConnectIntegrationDetail() {
  const { integrationId } = useParams();
  const navigate = useNavigate();
  const { removed } = useConnect();
  const integration = integrationViewById(integrationId);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!integration) {
    return (
      <PlainLayout wide>
        <ConnectShell title="Connection not found" sub="This connection does not exist, or it was disconnected in this session.">
          <EmptyState
            title="No such connection"
            hint="Disconnected connections do not come back here; authorization happens with the provider."
            action={<Link to={routes.connect()} className={s.linkArrow}>Back to Connected</Link>}
          />
        </ConnectShell>
      </PlainLayout>
    );
  }

  const app = appOf(integration.appId);
  const scopes = grantedScopes(integration);

  const disconnect = () => {
    disconnectIntegration(integration.id);
    navigate(routes.connect());
  };

  return (
    <PlainLayout wide>
      <ConnectShell
        title={app?.name ?? integration.appId}
        sub={`${integration.account} · ${integration.scope === 'org' ? `shared with ${integration.owner}` : 'personal connection'}`}
        actions={<Link to={routes.connect()} className={s.backLink}>Connected</Link>}
      >
        <header className={s.detailHead}>
          <AppMark appId={integration.appId} />
          <div className={s.detailIdentity}>
            <span className={s.detailName}>
              {app?.name ?? integration.appId}
              <ScopeBadge integration={integration} />
            </span>
            <span className={s.detailMeta}>
              {integration.scope === 'org' ? `Organisation · ${integration.owner}` : `Owner · ${integration.owner}`}
            </span>
          </div>
          <div className={s.detailStatus}>
            <IntegrationStatus />
            <span className={s.detailSeen}>
              connected {integration.connected}
              {integration.lastAccessed ? ` · accessed ${integration.lastAccessed}` : ''}
            </span>
          </div>
        </header>

        <div className={s.section}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Permissions</h2>
            <span className={s.sectionAside}>{scopes.length} of {app?.scopes.length ?? 0} catalog scopes granted</span>
          </div>
          {scopes.length === 0 ? (
            <p className={s.sectionNote}>
              No scopes: this connection holds no account — the app serves public data. There is
              nothing to authorize and nothing to revoke.
            </p>
          ) : (
            <>
              <div className={s.scopeList}>
                {scopes.map((scope) => (
                  <div key={scope.id} className={s.scopeRow}>
                    <span className={s.scopeLabel}>{scope.label}</span>
                    <span className={s.scopeDetail}>{scope.detail}</span>
                  </div>
                ))}
              </div>
              <p className={s.sectionNote}>
                Only these scopes apply. The app can do nothing beyond them through Thylas.
              </p>
            </>
          )}
        </div>

        <div className={s.section}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Capabilities</h2>
            <span className={s.sectionAside}>what Thylas can do through this connection</span>
          </div>
          <div className={s.capList}>
            {integration.capabilities.map((cap) => (
              <div key={cap.id} className={s.capItem}>
                <span className={s.capLabel}>
                  {cap.label}
                  <span className={s.capVia}>via {cap.via}</span>
                </span>
                {cap.note ? <span className={s.capNote}>{cap.note}</span> : null}
              </div>
            ))}
          </div>
          {integration.beyond ? (
            <div className={s.beyond}>
              <p className={s.beyondTitle}>Not possible with the granted scopes</p>
              <ul className={s.beyondList}>
                {integration.beyond.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className={s.section}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Activity</h2>
          </div>
          {integration.activity ? (
            <div className={s.log}>
              {integration.activity.map((entry, i) => (
                <div key={i} className={s.logItem}>
                  <span className={s.logWhen}>{entry.when}</span>
                  <span>{entry.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={s.sectionNote}>
              No activity is recorded for this connection. A record would need a runtime that
              actually calls the app; this build has none.
            </p>
          )}
        </div>

        <div className={s.section}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Settings</h2>
          </div>
          {notice ? (
            <p className={s.sectionNote} role="status">
              {notice}
            </p>
          ) : null}
          <div className={s.sideActions}>
            <Button
              size="sm"
              onClick={() =>
                setNotice('Authorization happens with the provider; no provider is connected in this build, so nothing is re-granted.')
              }
            >
              Reauthorize
            </Button>
            {confirming ? null : (
              <Button size="sm" onClick={() => setConfirming(true)} data-connect-disconnect>
                Disconnect
              </Button>
            )}
          </div>

          {confirming ? (
            <div className={s.confirm} role="group" aria-label={`Disconnect ${app?.name ?? integration.appId}`} data-connect-confirm>
              <p className={s.confirmTitle}>Disconnect {integration.account} from {app?.name ?? integration.appId}?</p>
              <p className={s.confirmWhat}>
                Thylas loses the {scopes.length === 0 ? 'access' : `${scopes.length} scope${scopes.length === 1 ? '' : 's'}`} listed
                above, and the activity record stops meaning anything. Making the connection again
                means authorizing with the provider — there is no undo here, because there is no
                backend to undo against.
              </p>
              <div className={s.confirmActions}>
                <Button size="sm" className={s.danger} onClick={disconnect}>
                  Disconnect
                </Button>
                <Button size="sm" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {removed.length > 0 ? (
            <p className={s.sectionNote}>
              {removed.length} connection{removed.length === 1 ? '' : 's'} disconnected in this session.
            </p>
          ) : null}
        </div>
      </ConnectShell>
    </PlainLayout>
  );
}

/* ---- Discover ------------------------------------------------------------ */

const CATEGORIES: (AppCategory | 'all')[] = [
  'all',
  'development',
  'productivity',
  'storage',
  'communication',
  'design',
  'calendar',
  'research',
];

export function ConnectDiscover() {
  useConnect();
  const connected = integrationsView().map((i) => i.appId);
  const [filter, setFilter] = useState(EMPTY_CATALOG_FILTER);
  const visible = filterCatalog(CATALOG, filter, connected);
  const groups = catalogByCategory(visible);

  return (
    <PlainLayout wide>
      <ConnectShell
        title="Discover"
        sub="Applications Thylas could integrate with. Four states exist, and they are stated, not implied: available, connected, coming soon, unsupported."
      >
        <div className={s.toolbar}>
          <div className={s.toolbarMain}>
            <input
              className={s.search}
              type="search"
              aria-label="Search applications"
              placeholder="Search applications"
              value={filter.query}
              onChange={(e) => setFilter({ ...filter, query: e.target.value })}
            />
            <div className={s.chipRow} role="group" aria-label="Filter by category">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={[s.chip, filter.category === category ? s.chipOn : ''].join(' ')}
                  onClick={() => setFilter({ ...filter, category })}
                  aria-pressed={filter.category === category}
                >
                  {category === 'all' ? 'All' : APP_CATEGORY_LABEL[category]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            title="No app matches this search"
            hint="Connected apps do not appear here — they live in Connected. Coming-soon and unsupported entries never disappear, because the boundary is a fact."
            action={
              <Button size="sm" onClick={() => setFilter(EMPTY_CATALOG_FILTER)}>
                Clear search
              </Button>
            }
          />
        ) : (
          groups.map((group) => (
            <section key={group.category} className={s.providerGroup} aria-labelledby={`cat-${group.category}`}>
              <h2 className={s.groupTitle} id={`cat-${group.category}`}>
                {APP_CATEGORY_LABEL[group.category]}
              </h2>
              <ul className={s.providerList}>
                {group.apps.map((app) => (
                  <li key={app.id} className={s.providerRow} data-app-row={app.id} data-tier={app.tier}>
                    <div className={s.providerIdentity}>
                      <AppMark appId={app.id} />
                      <div className={s.providerText}>
                        <span className={s.providerTitle}>
                          {app.name}
                          <Badge>{AUTH_LABEL[app.auth].toUpperCase()}</Badge>
                        </span>
                        <span className={s.providerBlurb}>{app.blurb}</span>
                      {app.tierNote ? <span className={s.planned}>{app.tierNote}</span> : null}
                      </div>
                    </div>

                    <div className={s.providerSide}>
                      {app.tier === 'available' ? (
                        <Link to={routes.connectApp(app.id)} className={s.linkArrow} data-app-open={app.id}>
                          Set up
                        </Link>
                      ) : app.tier === 'unsupported' ? (
                        <span className={s.planned}>No flow to open</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </ConnectShell>
    </PlainLayout>
  );
}

/* ---- App detail ---------------------------------------------------------- */

export function ConnectAppDetail() {
  const { appId } = useParams();
  const app = appOf(appId);
  const [notice, setNotice] = useState<string | null>(null);

  if (!app) {
    return (
      <PlainLayout wide>
        <ConnectShell title="Application not found">
          <EmptyState
            title="No such application"
            hint="The catalog holds a fixed set of entries; this is not one of them."
            action={<Link to={routes.connectDiscover()} className={s.linkArrow}>Back to Discover</Link>}
          />
        </ConnectShell>
      </PlainLayout>
    );
  }

  return (
    <PlainLayout wide>
      <ConnectShell
        title={app.name}
        sub={app.blurb}
        actions={<Link to={routes.connectDiscover()} className={s.backLink}>Discover</Link>}
      >
        <header className={s.detailHead}>
          <AppMark appId={app.id} />
          <div className={s.detailIdentity}>
            <span className={s.detailName}>
              {app.name}
              <Badge>{APP_CATEGORY_LABEL[app.category].toUpperCase()}</Badge>
            </span>
            <span className={s.detailMeta}>Authorization · {AUTH_LABEL[app.auth]}</span>
          </div>
          <div className={s.detailStatus}>
            <TierWord app={app} />
          </div>
        </header>

        <div className={s.section}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>What a connection would grant</h2>
            <span className={s.sectionAside}>{app.scopes.length} scopes</span>
          </div>
          {app.scopes.length === 0 ? (
            <p className={s.sectionNote}>
              No scopes: {AUTH_LABEL[app.auth].toLowerCase()} — the app serves public data, and a
              connection holds no account.
            </p>
          ) : (
            <div className={s.scopeList}>
              {app.scopes.map((scope) => (
                <div key={scope.id} className={s.scopeRow}>
                  <span className={s.scopeLabel}>{scope.label}</span>
                  <span className={s.scopeDetail}>{scope.detail}</span>
                </div>
              ))}
            </div>
          )}
          <p className={s.sectionNote}>
            A connection grants a subset of these, chosen at authorization. It never grants
            everything the app can do.
          </p>
        </div>

        <div className={s.section}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Connection</h2>
          </div>
          {notice ? (
            <p className={s.sectionNote} role="status">
              {notice}
            </p>
          ) : null}
          {app.tier === 'available' ? (
            <div className={s.sideActions}>
              <Button
                size="sm"
                variant="primary"
                onClick={() =>
                  setNotice(
                    'Authorize would hand you to the provider. No OAuth client is connected in this build, so nothing is granted and nothing is connected.',
                  )
                }
                data-connect-authorize
              >
                Authorize
              </Button>
              {app.docs ? (
                <a className={s.linkArrow} href={app.docs} target="_blank" rel="noreferrer">
                  Provider documentation
                </a>
              ) : null}
            </div>
          ) : (
            <p className={s.sectionNote}>{app.tierNote}</p>
          )}
        </div>
      </ConnectShell>
    </PlainLayout>
  );
}

/* ---- Custom integrations ------------------------------------------------- */

const KINDS: { id: CustomKind; label: string; blurb: string }[] = [
  {
    id: 'custom-api',
    label: 'Custom API',
    blurb: 'An external service Thylas would call. What it is: a service integration.',
  },
  {
    id: 'mcp-server',
    label: 'MCP server',
    blurb: 'A tool and context protocol to talk to. What it is: a communication protocol, not an identity.',
  },
  {
    id: 'webhook',
    label: 'Webhook',
    blurb: 'Somewhere events can be delivered. What it is: an event delivery mechanism, not a service to call.',
  },
];

const AUTHS: { id: CustomAuth; label: string; blurb: string }[] = [
  { id: 'oauth', label: 'OAuth', blurb: 'The provider authenticates the user and grants scopes.' },
  { id: 'api-key', label: 'API key', blurb: 'A secret held by the host; never stored in the page.' },
  { id: 'none', label: 'None', blurb: 'Public data, or an event sink that authenticates nobody.' },
];

export function ConnectCustom() {
  useConnect();
  const custom = customIntegrations();
  const log = connectLog();
  const [kind, setKind] = useState<CustomKind>('custom-api');
  const [auth, setAuth] = useState<CustomAuth>('oauth');
  const [label, setLabel] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<string | null>(null);

  const submit = () => {
    if (!label.trim()) {
      setError('A registration needs a name.');
      return;
    }
    if (!endpoint.trim()) {
      setError(kind === 'webhook' ? 'A webhook needs a URL to deliver to.' : 'A registration needs an endpoint.');
      return;
    }
    registerCustom({ label: label.trim(), kind, endpoint: endpoint.trim(), auth, note: note.trim() || undefined });
    setRegistered(`Registered ${label.trim()}. Nothing calls it in this build.`);
    setError(null);
    setLabel('');
    setEndpoint('');
    setNote('');
  };

  return (
    <PlainLayout wide>
      <ConnectShell
        title="Custom integrations"
        sub="An entry point for connections the catalog does not hold. Registration is local and honest: a record of intent, not a working call."
      >
        <div className={s.section}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Four things that are not the same thing</h2>
          </div>
          <p className={s.quiet}>
            A kind says what the integration <em>is</em>. An authorization method says how it
            proves who it is. The three kinds below can each use any of the three methods —
            which is why they are chosen separately.
          </p>
          <div className={s.kindGrid}>
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className={[s.kindCard, kind === k.id ? s.kindOn : ''].join(' ')}
                onClick={() => setKind(k.id)}
                aria-pressed={kind === k.id}
              >
                <span className={s.kindLabel}>{k.label}</span>
                <span className={s.kindBlurb}>{k.blurb}</span>
              </button>
            ))}
          </div>
          <p className={s.sectionNote}>
            OAuth and API key are not here on purpose: they are methods, chosen below the kinds.
            Treating them as kinds is how an MCP server ends up configured like a Google account.
          </p>
        </div>

        <div className={s.section}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Register</h2>
          </div>
          {error ? (
            <p className={s.sectionNote} role="alert">
              {error}
            </p>
          ) : null}
          {registered ? (
            <p className={s.sectionNote} role="status">
              {registered}
            </p>
          ) : null}
          <div className={s.form}>
            <div className={s.formRow}>
              <span className={s.formLabel}>Name</span>
              <input
                className={s.input}
                aria-label="Integration name"
                value={label}
                maxLength={60}
                placeholder="Lab corpus API"
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className={s.formRow}>
              <span className={s.formLabel}>Endpoint</span>
              <input
                className={s.input}
                aria-label="Endpoint"
                value={endpoint}
                placeholder="https:// or stdio://"
                onChange={(e) => setEndpoint(e.target.value)}
              />
              <span className={s.formHint}>Recorded, never called. Nothing in this build opens a connection.</span>
            </div>
            <div className={s.formRow}>
              <span className={s.formLabel}>Kind</span>
              <div className={s.radioRow} role="group" aria-label="Kind">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    className={[s.radio, kind === k.id ? s.radioOn : ''].join(' ')}
                    onClick={() => setKind(k.id)}
                    aria-pressed={kind === k.id}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.formRow}>
              <span className={s.formLabel}>Authorization method</span>
              <div className={s.radioRow} role="group" aria-label="Authorization method">
                {AUTHS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={[s.radio, auth === a.id ? s.radioOn : ''].join(' ')}
                    onClick={() => setAuth(a.id)}
                    aria-pressed={auth === a.id}
                    title={a.blurb}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.formRow}>
              <span className={s.formLabel}>Notes</span>
              <input
                className={s.input}
                aria-label="Notes"
                value={note}
                maxLength={120}
                placeholder="What this integration is for"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className={s.formActions}>
              <Button size="sm" variant="primary" onClick={submit}>
                Register
              </Button>
              <span className={s.formHint}>Kept in this browser for this session of the demo.</span>
            </div>
          </div>

          {custom.length > 0 ? (
            <>
              <div className={s.sectionHead} style={{ marginTop: 'var(--s6)' }}>
                <h2 className={s.sectionTitle}>Registered in this session</h2>
                <span className={s.sectionAside}>{custom.length}</span>
              </div>
              <div className={s.registeredList}>
                {custom.map((entry) => (
                  <div key={entry.id} className={s.registeredRow} data-custom-row={entry.id}>
                    <span className={s.registeredMain}>
                      <span className={s.registeredTitle}>
                        {entry.label}
                        <Badge>{entry.kind.toUpperCase()}</Badge>
                      </span>
                      <span className={s.registeredMeta}>
                        {entry.endpoint} · {AUTH_LABEL[entry.auth]}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </span>
                    </span>
                    <Chip tone="plain">
                      <StatusDot tone="idle" /> Registered · not connected
                    </Chip>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {log.length > 0 ? (
            <div className={s.log} style={{ marginTop: 'var(--s6)', maxWidth: 720 }}>
              {log.slice(0, 5).map((d) => (
                <div key={d.id} className={s.logItem}>
                  <span className={s.logWhen}>{d.at.slice(11, 19)}</span>
                  <span>{d.text}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </ConnectShell>
    </PlainLayout>
  );
}
