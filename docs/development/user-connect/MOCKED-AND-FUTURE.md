# Mocked and future — User & Connect

What is sample data, what is real, and what a backend would have to provide. The
interface already says these things in place; this file is the same list in one row
per fact, so a future reader does not have to rediscover them from the code.

## Mocked in this build

| # | Fact | Where it shows | What is actually true |
| --- | --- | --- | --- |
| M1 | The four sample connections (GitHub, Slack, Google Drive, OpenAlex) | Connected list, detail pages | Authored in `data/connect.ts`. No OAuth client exists; nothing has ever contacted these apps. |
| M2 | `lastAccessed` and Activity entries | Connected rows, detail Activity | Sample data. No runtime calls any app, so no real access log can exist. |
| M3 | Catalog availability tiers | Discover | The tier is a fact about this build's scope, not the app's real-world integrability. |
| M4 | Usage meters and plan | User → Identity | What the metering service would return; the billing provider is not connected. |
| M5 | Compute pool summary numbers | User → My environment | Read live from the compute store — real relative to the compute seeds, which are themselves samples. |

## Real in this build

| # | Fact | Where | What is actually true |
| --- | --- | --- |
| R1 | Display name override | User → Identity, rail footer | Persisted `thylas:user:v1`; empty input restores the provider name. |
| R2 | Row density | User → Preferences | Persisted; sets `--h-row` on change. |
| R3 | Landing page | User → Preferences | Persisted; the router's index redirect reads it. |
| R4 | Default workspace | User → Preferences → My environment | Persisted; resolved against the live workspace list, so a deleted one degrades honestly. |
| R5 | Disconnect a connection | Connect detail | A tombstone in `thylas:connect:v1`, logged; the app leaves Connected and reappears in Discover as available. |
| R6 | Register a custom integration | Connect → Custom | Stored locally with status "Registered · not connected"; nothing calls it. |

## What a backend must provide (future integration points)

1. **OAuth client + token store** — Discover's Authorize becomes a provider redirect;
   Reauthorize refreshes a grant. The four tiers and the detail IA do not change.
2. **Identity service** — sign-out, avatar, sessions/devices replace the disabled rows.
3. **Integration runtime** — real connection state, real activity, sync scheduling;
   `lastAccessed` stops being sample data.
4. **Notification service** — the prototype switch becomes a real preference.
5. **Org policy service** — org-shared integrations (the Slack row) gain policy display;
   the boundary table in the brief stays the source of truth for who may see what.
