# Coworker page — implementation notes

**Date:** 2026-11-12 · Product model: `docs/product/coworkers/` (D-054) · Plan: [`PLAN.md`](PLAN.md)

## What shipped

| Stage | Delivered |
| --- | --- |
| Navigation | Rail item **Coworkers** (library group, before Artifacts) + palette "Go"; routes `/coworkers`, `/coworkers/new`, `/coworkers/:id`, `/coworkers/:id/config` |
| Directory | `/coworkers` — list-first rows (mark, name, brief, status chip, workspace count), search, All/Active/Archived chips, honest empty states |
| Working interface | `/coworkers/:id` — identity strip (status, Pause/Resume, Configure) above **the real ChatCore conversation**; side column: Current work (honest empty state — no invented progress), Artifacts (pinned references → detail), Workspaces (memberships), Activity (store log) |
| Creation | `/coworkers/new` — name + description + three-part brief + optional initial workspace; created as active |
| Configuration | `/coworkers/:id/config` — responsibilities (three editable blocks + save), workspace access (add/remove with role), context & artifacts note, toolsets and behaviour as **honest placeholders** (runtime not connected), status + delete with inline confirm |

## Files

```
src/data/coworkers.ts            3 seeds (reviewer / scribe / paused archivist) with briefs + memberships
src/state/coworkers.ts           v1 store: create, responsibility overrides, status, membership add/remove, tombstones
src/pages/coworkers/             Directory · Detail (working interface) · New · Config + coworker.module.css
docs/development/coworkers/      PLAN.md · IMPLEMENTATION.md
```

## Honesty rules applied

- Conversation = the real chat (model endpoint); the page says so — no agent runtime claimed.
- Current work renders its empty state until real signals exist — no fake items, ever.
- Toolsets/behaviour config: recorded grants + "runtime not connected" notes — no dead dropdowns.
- Membership removal states that the work record stays; artifact attribution survives deletion.

## Verification

tsc clean · vitest 309/309 (9 new store tests) · build ok · e2e **302/302** (11 new
assertions: directory, search, working interface composition, real conversation,
responsibility edit → activity log, membership add/remove, pause semantics, creation,
directory reflection). Screenshots: `.workbuddy/shots/coworkers-*.png`.

## Debug notes (for future e2e work)

- React mount races: a `goto` followed immediately by `fillAria`/`click` can act before
  hydration — insert a short `js('await sleep…')` when a check fails with "control
  missing" while the screenshot shows it present.
- Object assertions fail on extra keys; `textarea.value` is not in `innerText`.
- Each e2e block must reset its own localStorage key at block start — runs share
  profile state (the pause check failed on a leftover override from the prior run).
