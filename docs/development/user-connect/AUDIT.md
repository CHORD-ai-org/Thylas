# Repository audit — User & Connect

Written 2026-11-09, before any implementation. Every claim below was checked against the code on this date.

## 1. What already exists

**Architecture.** React 19 + Vite + react-router, no state library. Global state is
`useSyncExternalStore` over module-level stores that persist a *versioned envelope* in
localStorage (`thylas:<domain>:v1` — compute, workspaces). Stores hold only session-made
changes; seed data lives in `src/data/*.ts` as pure, authored samples with a provenance
header, and derived facts are functions, never stored twice.

**Global surfaces.** Overview, Recently, Notes, Account, Compute are workspace-independent
and render inside `PlainLayout` (`read` / `wide` 1000px / `console` 1180px). Compute shows
the pattern a multi-screen section follows: one shell component (eyebrow, title, honest
simulation sentence), a tab nav, and one shared CSS module so status words and marks cannot
drift between screens.

**Design system.** `design/tokens.css` (colour, space s1–s12, type ramps) +
`src/styles/tokens.css` (radius scale D-041: r-xs/sm/md/lg/pill; tints; `--w-sheet`).
Icons are one set, 16px, 1.2px stroke, no fills (`components/icons.tsx`). Primitives in
`components/ui.tsx`: Button, IconButton, Chip, StatusDot, Badge, SectionLabel, EmptyState,
Field, TypeGlyph. Confirmation follows the WorkspaceGrid pattern: an inline group with the
consequence stated before the press — this app has no modal dialog component, by decision
(the only dialog is the command palette, D-047).

**The existing Account page.** `/account/:section` (profile / plan / usage / keys /
preferences) already implements part of the User responsibility with the house style of
honesty: read-only identity "from the CHORD identity provider", plan management links out,
key issuance disabled with a reason, three real preferences. Its row-density preference is
session-only. The rail and palette both name it "Account".

**Mock data conventions.** `USER` in `data/mock.ts` holds name, email, initials, plan,
role. Numbers displayed from mock files are demonstrations of layout, never claims about
services; the shell marks provenance in prose.

## 2. Missing infrastructure (and therefore honest-UI obligations)

- No identity provider, no auth service, no session store → Security & Sessions can show
  *this browser's local profile* only; sign-out and avatar changes get disabled states with
  reasons, not pretend flows.
- No OAuth client, no token store, no webhook receiver → Connect must not simulate a
  successful authorization. The Connect button on an available app leads to a detail page
  that says what a connection *would* grant; it never reports success.
- No integration runtime → custom integrations can be *registered* locally and nothing
  more; the status word is "Registered", never "Connected".
- No notification service → notification preferences are a prototype control labelled as
  such, not a toggle that pretends.

## 3. Boundary decisions this audit feeds (see D-049)

1. **User replaces Account.** Two pages owning "the person" would be two doors to
   overlapping rooms. Account's honest copy (plan, usage, keys) moves into the new
   four-section IA rather than being deleted.
2. **Connect is a new global surface** in the Compute shape: shell + tabs
   (Connected / Discover / Custom), one data file, one store, one CSS module.
3. **Compute owns machines.** User's My Environment section reads the compute store for
   counts and links out; it renders no resource rows of its own.
