/**
 * Connect: the catalog of external applications and the connections to them.
 *
 * Two nouns and a rule. A catalog app is something Thylas could integrate with;
 * an integration is a connection a person (or their organisation) has made. The
 * rule is that availability and capability are different facts: an app being in
 * the catalog says nothing about what a connection to it would be allowed to
 * do, and a connection grants only the scopes that were granted — never
 * everything the app can do.
 *
 * Nothing here performs an authorization. The catalog says what each app is
 * (`tier`), and an integration's `capabilities` are exactly what its granted
 * scopes allow — what lies beyond is stated, not hidden, because an omitted
 * limit reads as an oversight rather than a boundary.
 */

export type AppCategory =
  | 'development'
  | 'productivity'
  | 'storage'
  | 'communication'
  | 'design'
  | 'calendar'
  | 'research';

/** How real the entry is. `coming-soon` and `unsupported` have no flow to open. */
export type AppTier = 'available' | 'coming-soon' | 'unsupported';

/** How a connection would prove who it is. An authorization method, not a kind. */
export type AuthMethod = 'oauth' | 'api-key' | 'none';

export type Scope = {
  id: string;
  label: string;
  detail: string;
};

export type Capability = {
  id: string;
  label: string;
  /** The granted scope this capability rides on. */
  via: string;
  note?: string;
};

export type CatalogApp = {
  id: string;
  name: string;
  category: AppCategory;
  blurb: string;
  tier: AppTier;
  auth: AuthMethod;
  /** What a connection *would* grant. A connection grants a subset of these. */
  scopes: Scope[];
  docs?: string;
  /** Why the app has no flow, when the tier is not `available`. */
  tierNote?: string;
};

export type Integration = {
  id: string;
  appId: string;
  /** The account on the other side, as the connection reports it. */
  account: string;
  scope: 'personal' | 'org';
  owner: string;
  connected: string;
  /** Sample data only: no runtime exists to touch these apps in this build. */
  lastAccessed?: string;
  /** Scope ids actually granted — a subset of the app's catalog scopes. */
  granted: string[];
  /** What Thylas can do right now, each riding on a granted scope. */
  capabilities: Capability[];
  /** What it cannot do, and which scope would change that. Stated, not hidden. */
  beyond?: string[];
  /** Only where sample data exists; absence is explained in the detail view. */
  activity?: { when: string; text: string }[];
};

export const APP_CATEGORY_LABEL: Record<AppCategory, string> = {
  development: 'Development',
  productivity: 'Productivity',
  storage: 'Storage',
  communication: 'Communication',
  design: 'Design',
  calendar: 'Calendar',
  research: 'Data & research',
};

export const TIER_LABEL: Record<AppTier, string> = {
  available: 'Available to connect',
  'coming-soon': 'Coming soon',
  unsupported: 'Unsupported',
};

export const AUTH_LABEL: Record<AuthMethod, string> = {
  oauth: 'OAuth',
  'api-key': 'API key',
  none: 'No authorization',
};

/* --------------------------------------------------------------------------
   Catalog
   -------------------------------------------------------------------------- */

export const CATALOG: CatalogApp[] = [
  {
    id: 'app-github',
    name: 'GitHub',
    category: 'development',
    blurb: 'Repositories, issues and pull requests. A connection reads; writing needs a scope this build never requests.',
    tier: 'available',
    auth: 'oauth',
    scopes: [
      { id: 'repo-read', label: 'Read repositories', detail: 'File contents, branches and commit history of repositories the account can read.' },
      { id: 'issues-read', label: 'Read issues and pull requests', detail: 'Titles, bodies, states and comments. No labels, no assignment, no merge.' },
      { id: 'workflow-read', label: 'Read workflow runs', detail: 'Run status and conclusions for repositories the account can read.' },
    ],
    docs: 'https://docs.github.com/rest',
  },
  {
    id: 'app-gitlab',
    name: 'GitLab',
    category: 'development',
    blurb: 'Projects and merge requests on gitlab.com or a self-managed instance.',
    tier: 'available',
    auth: 'oauth',
    scopes: [
      { id: 'read-repo', label: 'Read projects', detail: 'Repository contents and merge request state.' },
    ],
  },
  {
    id: 'app-notion',
    name: 'Notion',
    category: 'productivity',
    blurb: 'Pages and databases the connection is explicitly given access to — Notion grants per page, not per workspace.',
    tier: 'available',
    auth: 'oauth',
    scopes: [
      { id: 'pages-read', label: 'Read shared pages', detail: 'Content of pages and databases the account attaches to the connection.' },
    ],
  },
  {
    id: 'app-linear',
    name: 'Linear',
    category: 'productivity',
    blurb: 'Issues, cycles and projects.',
    tier: 'available',
    auth: 'oauth',
    scopes: [
      { id: 'issues-read', label: 'Read issues', detail: 'Issue titles, states and comments across the teams the account belongs to.' },
    ],
  },
  {
    id: 'app-gdrive',
    name: 'Google Drive',
    category: 'storage',
    blurb: 'Files in one Google account. Read-only; a connection that could edit would be a different decision.',
    tier: 'available',
    auth: 'oauth',
    scopes: [
      { id: 'drive-read', label: 'Read files', detail: 'Metadata and contents of files the account can open. No creation, no move, no delete.' },
    ],
    docs: 'https://developers.google.com/drive',
  },
  {
    id: 'app-dropbox',
    name: 'Dropbox',
    category: 'storage',
    blurb: 'Files and folders in one Dropbox account.',
    tier: 'available',
    auth: 'oauth',
    scopes: [
      { id: 'files-read', label: 'Read files', detail: 'Listing and download of the account\'s files.' },
    ],
  },
  {
    id: 'app-slack',
    name: 'Slack',
    category: 'communication',
    blurb: 'Channel history in one workspace. Posting is a write and is not requested.',
    tier: 'available',
    auth: 'oauth',
    scopes: [
      { id: 'history-read', label: 'Read channel history', detail: 'Messages in public channels the bot is a member of.' },
      { id: 'users-read', label: 'Read member directory', detail: 'Names and profile fields of people in the workspace.' },
    ],
  },
  {
    id: 'app-figma',
    name: 'Figma',
    category: 'design',
    blurb: 'Design files and frames.',
    tier: 'available',
    auth: 'oauth',
    scopes: [
      { id: 'files-read', label: 'Read design files', detail: 'Frame structure and exported images from files the account can open.' },
    ],
  },
  {
    id: 'app-gcal',
    name: 'Google Calendar',
    category: 'calendar',
    blurb: 'Events in the calendars one account can see.',
    tier: 'available',
    auth: 'oauth',
    scopes: [
      { id: 'events-read', label: 'Read events', detail: 'Event times, titles and locations. No creation, no invitation.' },
    ],
  },
  {
    id: 'app-openalex',
    name: 'OpenAlex',
    category: 'research',
    blurb: 'The open catalog of papers, authors and institutions. Public data — no account, no scopes.',
    tier: 'available',
    auth: 'none',
    scopes: [],
  },
  {
    id: 'app-discord',
    name: 'Discord',
    category: 'communication',
    blurb: 'Servers and channels.',
    tier: 'coming-soon',
    auth: 'oauth',
    scopes: [],
    tierNote: 'The connection flow is not written. Listed so the category is honest about what is coming.',
  },
  {
    id: 'app-teams',
    name: 'Microsoft Teams',
    category: 'communication',
    blurb: 'Organisational chat and meetings.',
    tier: 'unsupported',
    auth: 'oauth',
    scopes: [],
    tierNote: 'No integration is planned. Listed so the boundary is a fact on the page rather than an absence.',
  },
];

export function appOf(appId: string | undefined): CatalogApp | undefined {
  return CATALOG.find((a) => a.id === appId);
}

/* --------------------------------------------------------------------------
   Connections (authored samples — the shell says so in one sentence)
   -------------------------------------------------------------------------- */

export const INTEGRATIONS: Integration[] = [
  {
    id: 'int-github',
    appId: 'app-github',
    account: '@ceaserzhao',
    scope: 'personal',
    owner: 'Ceaser Zhao',
    connected: '3w ago',
    lastAccessed: '2h ago',
    granted: ['repo-read', 'issues-read', 'workflow-read'],
    capabilities: [
      { id: 'cap-gh-repos', label: 'Read repositories and their history', via: 'repo-read' },
      { id: 'cap-gh-issues', label: 'Read issues and pull requests', via: 'issues-read' },
      { id: 'cap-gh-runs', label: 'See workflow run status', via: 'workflow-read' },
    ],
    beyond: [
      'Open or merge a pull request — the write scopes were never requested.',
      'Change repository settings or secrets.',
    ],
    activity: [
      { when: '2h ago', text: 'Read 3 files from research/tokenizer-manifest' },
      { when: 'yesterday', text: 'Listed issues in onda/field-map' },
      { when: '4d ago', text: 'Connection re-checked; all scopes still granted' },
    ],
  },
  {
    id: 'int-slack',
    appId: 'app-slack',
    account: 'onda-lab.slack.com',
    scope: 'org',
    owner: 'Onda Lab',
    connected: '2w ago',
    lastAccessed: 'yesterday',
    granted: ['history-read', 'users-read'],
    capabilities: [
      { id: 'cap-slack-history', label: 'Read public channel history', via: 'history-read' },
      { id: 'cap-slack-people', label: 'Look up workspace members', via: 'users-read' },
    ],
    beyond: ['Post a message or start a thread — Thylas never writes to a channel.'],
    activity: [
      { when: 'yesterday', text: 'Read 40 messages from #field-data' },
      { when: '3d ago', text: 'Resolved 6 member names for a run report' },
    ],
  },
  {
    id: 'int-gdrive',
    appId: 'app-gdrive',
    account: 'ceaser@oasis.dev',
    scope: 'personal',
    owner: 'Ceaser Zhao',
    connected: '2w ago',
    lastAccessed: '6h ago',
    granted: ['drive-read'],
    capabilities: [
      { id: 'cap-gd-read', label: 'List and read files', via: 'drive-read' },
    ],
    beyond: ['Upload, move or delete anything — the connection is read-only by decision.'],
  },
  {
    id: 'int-openalex',
    appId: 'app-openalex',
    account: '—',
    scope: 'personal',
    owner: 'Ceaser Zhao',
    connected: '5d ago',
    lastAccessed: '5d ago',
    granted: [],
    capabilities: [
      {
        id: 'cap-oa-search',
        label: 'Search works, authors and institutions',
        via: '—',
        note: 'Public data. There is no account behind this connection, so there is nothing to authorize and nothing to revoke.',
      },
    ],
  },
];

/* --------------------------------------------------------------------------
   Derived views
   -------------------------------------------------------------------------- */

/** The catalog scopes a connection actually holds, in catalog order. */
export function grantedScopes(integration: Integration): Scope[] {
  const app = appOf(integration.appId);
  if (!app) return [];
  return app.scopes.filter((s) => integration.granted.includes(s.id));
}

/** A seed integration with session changes applied: a tombstone is gone. */
export function integrationView(integration: Integration, removed: string[]): Integration | null {
  return removed.includes(integration.id) ? null : integration;
}

export function integrationOf(id: string | undefined, removed: string[] = []): Integration | undefined {
  if (!id) return undefined;
  const found = INTEGRATIONS.find((i) => i.id === id);
  return found && !removed.includes(id) ? found : undefined;
}

export type CatalogFilter = {
  query: string;
  category: AppCategory | 'all';
};

export const EMPTY_CATALOG_FILTER: CatalogFilter = { query: '', category: 'all' };

/** Connected apps do not appear in Discover results: one door per room. */
export function filterCatalog(
  apps: CatalogApp[],
  filter: CatalogFilter,
  connectedAppIds: string[] = [],
): CatalogApp[] {
  const q = filter.query.trim().toLowerCase();
  return apps.filter((a) => {
    if (filter.category !== 'all' && a.category !== filter.category) return false;
    if (connectedAppIds.includes(a.id)) return false;
    if (!q) return true;
    return `${a.name} ${a.blurb} ${APP_CATEGORY_LABEL[a.category]}`.toLowerCase().includes(q);
  });
}

export function catalogByCategory(apps: CatalogApp[]): { category: AppCategory; apps: CatalogApp[] }[] {
  const order: AppCategory[] = ['development', 'productivity', 'storage', 'communication', 'design', 'calendar', 'research'];
  return order
    .map((category) => ({ category, apps: apps.filter((a) => a.category === category) }))
    .filter((g) => g.apps.length > 0);
}
