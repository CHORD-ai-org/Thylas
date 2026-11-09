> **Superseded 2026-11-09** by Compute v2 (D-050): the IA described here is replaced. See `docs/development/compute-v2/`. Kept as history.

# Compute — repository audit

**Date:** 2026-11-09. **Scope:** the Thylas app as it stands before Compute was added.
**Method:** read `AGENT.md`, `docs/development/ui-mvp/{DECISIONS,PROGRESS,QUALITY-BAR}.md`, `docs/design/*`, and the source of the shell, the five surfaces and the stores. No behaviour was changed during the audit.

## 1. What the application is

A local-first workspace: React 19 + Vite, react-router, no client state library. Every surface is a route under a fixed shell (rail left, tab strip top, optional context panel right). Data is mock (`src/data/mock.ts`) except notes, run overrides and workspaces, which have real stores in `src/state/` persisted to `localStorage`.

| Area | Files | What it establishes |
| --- | --- | --- |
| Shell | `src/shell/{AppShell,Rail,TabStrip,layouts,ContextPanel}` | 240px rail, tab strip, `PlainLayout` / `WorkspaceLayout`, per-context panel widths |
| Routing | `src/app/routerChildren.tsx`, `src/lib/routes.ts` | one route module; every link is built, none concatenated by hand |
| Primitives | `src/components/ui.tsx`, `icons.tsx` | Button (3 variants × 2 sizes), IconButton, Chip (5 tones), Badge, Kbd, StatusDot, SectionLabel, EmptyState, Field, file TypeGlyph |
| Grammar | `src/styles/{tokens,typography,grammar,base}.css` | radius scale 4/8/12/16/pill, 5-step type ramp (11/13/16/20/32), four states, inset row state, focus ring recipe |
| Surfaces | `src/pages/*` | Overview, Recently, Files, Boards (canvas), Processes, Notes (CodeMirror), Account |
| Stores | `src/state/{app,notes,runs,workspaces}.ts` | `useSyncExternalStore` + versioned `localStorage` keys; reads guarded so unit tests run without `localStorage` |

## 2. Conventions that constrain a new surface

1. **No dialogs.** The only overlay is the command palette. Flows happen in place or on their own route.
2. **Hairlines, not cards.** Lists are 40px rows separated by 1px `--line`; cards are used only for objects you open (boards, workspaces).
3. **No invented capability.** Where a capability is missing the surface says so in a sentence and offers nothing to press (`Runs start in WAM`), rather than a button that apologises after the click.
4. **State words are lowercase**, column heads uppercase, buttons verb + object.
5. **URL is state** for filters (`?state=needs_input`), so a filtered view is a link.
6. **Numbers are mono and tabular**; `font-size` appears only in `typography.css`.
7. **One accent**, and only for state.
8. **Gates:** `tsc`, `eslint`, `vitest`, `npm run e2e` (245+ assertions, real Chrome over CDP), `build`.

## 3. What exists that Compute can reuse

- `PlainLayout` (a main column; `wide` = 1000px) — **too narrow** for six columns, so Compute adds `size="console"` (1180px).
- `StatusDot` + `Chip` tones cover connection/availability once a mapping exists.
- `EmptyState`, `Field`, `Section`-style headers, filter chips (`grammar.filter`), `focusInside`, the 40px row.
- Store pattern: `useSyncExternalStore`, versioned key, hand-edited payload rejected entry by entry, `__readForTest`.
- The e2e harness can force `:hover/:active/:focus-visible` via CDP — useful for asserting states rather than photographing them.

## 4. Gaps this surface exposes

| # | Gap | Consequence for Compute |
| --- | --- | --- |
| G1 | The rail has no mobile pattern (fixed 240px, no drawer) | 390px is not a supported width for the app; Compute is verified at 1440 and 1024 only |
| G2 | No global toast/dialog primitive | connection results are inline bands, not modal confirmations |
| G3 | Mock data has no provider concept | Compute needs its own model (`src/data/compute.ts`), not a shape borrowed from `Workspace` |
| G4 | No pricing data anywhere | cost is absent, with a sentence saying why, instead of a fabricated rate |
| G5 | Bundles are one chunk except the editor | Compute pages ship in the main bundle (+24 KB gzip); lazy-loading them is a follow-up, not a correctness issue |

## 5. Constraints accepted

- No new dependencies.
- No real SSH/cloud calls, no credential storage, no scheduler.
- Do not restyle other surfaces; `PlainLayout` gained one optional value, nothing else moved.
