# SP-03a · Tab model and reconciliation

**Parent:** [SP-03](SP-03-workspace-core.md) · **Days:** 1.0 · **Status:** Not Started · **Depends:** SP-01

## Objective

Move the tab set from "works in the happy path" to "survives deletion, reload, deep links and two workspaces" — as pure functions with tests, before any surface depends on them.

## Scope

**In:** `src/lib/tabs.ts` (`open`, `close`, `reconcile`, `rotateIntoView`), context keying (`ws:<id>`, `notes`), persistence schema v1 with version field, quota guard, deep-link insertion, duplicate-open focus, close-active → room index.
**Out:** dirty state (SP-05b), scroll restore (SP-03b), panel widths (SP-03b).

## UX

Parent §D, applied to the strip only. New behaviour: a URL to an object that is not in the set adds exactly one tab and becomes active; a URL to an object that no longer exists keeps its tab as a tombstone that the next reconcile does not drop.

## Visual

Parent §E. No new visual state in this unit.

## Technical plan

- Pure functions take `(set, route, resolver)` and return a new set; no React, no storage.
- `state/app.tsx` becomes the adapter: read/write `sessionStorage` under `thylas:tabs:v2`, migrate `v1` by keying on the old shape, drop entries whose context no longer exists.
- `ResizeObserver` limit from SP-01 stays in the strip; `rotateIntoView` moves the active tab into the visible slice.
- Storage failures (quota, private mode) fall back to in-memory and log once.

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Write `lib/tabs.ts` + 8 tests | open/close/reconcile/rotate all pure |
| T2 | Adapter in `state/app.tsx` | `sessionStorage` v2, v1 migrated |
| T3 | Deep-link insertion | Unopened object gets one tab |
| T4 | Tombstone survival | Deleted object's tab is not dropped by reconcile |
| T5 | Quota fallback | Full storage degrades, does not throw |

## Acceptance

1. `lib/tabs.test.ts`: 8 cases green (duplicate open, close inactive, close active, close last, reconcile missing, rotate, cross-context isolation, empty set).
2. Deep link → exactly one tab added; back button returns to the previous tab without adding another.
3. Two contexts with 5 tabs each never mix.
4. `sessionStorage` cleared → app starts with rooms only, no error.
5. `npm run check && lint && test` green.

## Validation

`npm test`, plus a manual reload/deep-link pass at 1280; storage inspected in DevTools after 10 tabs.

## Risks

- Migration from v1 can resurrect stale paths; drop anything that does not resolve rather than keeping it "just in case".
- `sessionStorage` is per browser tab, not per app tab; two windows diverge by design (documented in `tech-stack.md` §6.4).
