# Plan — User & Connect

Status: accepted in force (D-049). Companion to `AUDIT.md`. Scope: two global surfaces,
their data model, and their navigation. Nothing here touches WAM, workspaces or compute
management.

## 1. Navigation

- Rail, global nav: Overview · Recently · Compute · **Connect** (new, after Compute).
- Rail, library nav: Notes · **User** (renamed from Account, same slot).
- Palette "Go" group gains Connect and User.
- Routes: `/user`, `/user/:section`; `/connect`, `/connect/discover`, `/connect/custom`,
  `/connect/i/:integrationId`, `/connect/apps/:appId`. `/account` becomes a redirect to
  `/user` (no page keeps the old name).

## 2. User — information architecture

Shell: `PlainLayout wide`, left section nav (the Account layout survives: 176px nav,
sticky). Four sections, one route parameter.

### A. Identity (`/user/identity`, default)
- Avatar (initials mark) + "Change avatar" → disabled with reason (no avatar service).
- **Display name**: editable inline — the one field a person may own here. Persisted in
  the user store; the rail footer and the header follow it.
- Read-only, stated as such: username, email, account ID (mono), member since, role.
  Copy keeps the existing sentence: identity comes from the CHORD identity provider.
- Plan & usage move here as a compact block (existing honest copy preserved: billing
  happens at the provider; meters are what the metering service returns).

### B. Preferences (`/user/preferences`)
Rows, max width `--w-sheet`:
| Row | Control | Honesty |
| --- | --- | --- |
| Theme | fixed value "Paper" | a second palette does not exist (existing copy) |
| Language | fixed value "English" | existing copy |
| Row density | segmented comfortable/compact | **real**, now persisted (was session-only) |
| Landing page | select Overview/Recently/Notes | **real** — the index route reads it |
| Default workspace | select of live workspaces | real preference; applied where a default workspace is asked for (My Environment); not auto-navigation |
| Notifications | prototype toggle, disabled | no notification service in this build |

### C. My environment (`/user/environment`)
Reads other stores; renders no management UI of its own:
- Default workspace (from prefs) → link into it.
- Compute pool summary from the compute store: N machines · M connected → link to
  `/compute/resources`; personal machines → `/compute/resources?scope=personal`.
- Recent environments: the top personal entries of `RECENT` with their routes.

### D. Security & sessions (`/user/security`)
- Session: "This browser · local profile" — the only session that exists.
- Authentication methods: the identity-provider sentence; no methods claimed.
- API keys: the existing EmptyState and its honest button.
- Sign out: disabled button with reason (no auth service to sign out of).

**State.** `src/state/user.ts`, key `thylas:user:v1`: `{ displayName?: string, prefs }`.
Preferences are validated on read (enum checks, like compute's connection overrides);
a hand-edited payload loses the entry, not the library. `resetUser()` for tests.

## 3. Connect — information architecture

Shell: `PlainLayout wide`, Compute-shell shape. Eyebrow "CHORD · Connect". The shell's
subsentence carries the provenance: connections shown are authored samples and no
authorization happens in this build.

### A. Connected (`/connect`)
Row list (not a table): app mark, name + connected account, scope badge (PERSONAL /
`ORG · ONDA LAB`), connection status, last accessed. Row click → detail.

Detail (`/connect/i/:id`), sections:
- **Overview**: app, account, status, connection scope, connected-at.
- **Permissions**: granted scopes, each with what it lets Thylas read; a closing line
  states that only granted scopes apply.
- **Capabilities**: what Thylas can actually do through the connection; each capability
  names the scope it rides on. Un-granted abilities are listed as "not possible with the
  granted scopes" rather than omitted — absence would look like an oversight, not a limit.
- **Activity**: only where sample data exists (GitHub, Slack); others show why not.
- **Settings**: Reauthorize (button → honest notice), Disconnect (inline confirm, stating
  what the app loses access to; no undo because there is no backend to undo against).

### B. Discover (`/connect/discover`)
Search + category chips (Development, Productivity, Storage, Communication, Design,
Calendar, Data & Research). Cards grouped by category with four honest tiers:
`available` · `connected` · `coming soon` (no flow, disabled, reason in title) ·
`unsupported` (listed to mark the boundary, "No flow to open" — the Compute planned
pattern). App detail (`/connect/apps/:id`): what the app is, what a connection would
grant, and an Authorize button that explains OAuth is not wired here — it never
reports success.

### C. Custom (`/connect/custom`)
An explainer that keeps the concepts apart (this distinction is the page's point):

| Kind | What it is |
| --- | --- |
| Custom API | an external service to integrate |
| MCP server | a tool/context protocol to talk to |
| Webhook | an event delivery mechanism |
| OAuth / API key | **authorization methods**, chosen per integration — not kinds |

Register form: label, kind, endpoint, authorization method, notes → adds to
"Registered in this session" with status **Registered · not connected** and a note that
nothing calls it. No backend is pretended.

## 4. Data model (`src/data/connect.ts`)

```ts
type AppCategory = 'development' | 'productivity' | 'storage' | 'communication'
                 | 'design' | 'calendar' | 'research';
type AppTier = 'available' | 'coming-soon' | 'unsupported';
type AuthMethod = 'oauth' | 'api-key' | 'none';
type CatalogApp = { id, name, category, blurb, tier, auth, scopes: Scope[], docs? };
type Scope = { id, label, detail };
type Capability = { id, label, via: string, note? };
type Integration = {
  id, appId, account, scope: 'personal' | 'org', owner,
  connected: string, lastAccessed?: string,
  granted: string[],            // scope ids
  capabilities: Capability[],   // what Thylas can do now
  beyond?: string[],            // what it cannot, and which scope would change that
  activity?: { when: string, text: string }[],
};
```

Pure helpers: `appOf`, `integrationView` (tombstones applied), `filterCatalog(query,
category)`, `catalogByCategory`, `capabilityOf`. Store (`src/state/connect.ts`, key
`thylas:connect:v1`): `{ removed: string[], custom: RegisteredCustom[], log: Decision[] }`.
Disconnect is a tombstone on the seed (the compute pattern) and is logged; registering a
custom integration is logged too.

## 5. Component reuse

Reused: Button, IconButton, Chip, StatusDot, Badge, EmptyState, Field, PlainLayout,
grammar `focusInside` composes, ProviderMark's two-letter-mark construction (re-made as
`AppMark` in `connect/parts.tsx` because the compute one reads compute's registry).
New, single-purpose: `ConnectShell`, `ConnectTabs`, `AppMark`, `ScopeBadge`,
`IntegrationStatus` — all in `pages/connect/parts.tsx` + `connect.module.css`.
User page reuses the Account layout CSS as `user.module.css` (renamed copy, so Account
can be deleted without a dead import).

## 6. Implementation sequence

1. Data + state + unit tests (`connect.test.ts`, store validation).
2. Routes, rail, palette, `/account` redirect.
3. User page (four sections) + user store wiring (landing redirect).
4. Connect pages (list, discover, custom, two detail routes).
5. e2e block in `ui-checks.mjs`; vitest + tsc + build + screenshots; PROGRESS.md.

## 7. Known limitations / future integration points

- No OAuth client: Authorize never succeeds; Reauthorize never refreshes.
- No integration runtime: custom registrations are inert; no sync ever runs, so
  `lastAccessed` is sample data only.
- No notification service; no avatar service; no auth service (sign-out disabled).
- Organization-shared integrations are represented by the Slack row's ORG badge; org
  policy enforcement has no UI here because there is no policy service to enforce.
- When a real integration backend lands: catalog entries gain `docs` links, the store
  gains real connection state, and Discover's Authorize becomes a redirect — the IA and
  the four tiers do not change.
