# Coworker page — audit + implementation plan

Written 2026-11-12, before code. Product model: `docs/product/coworkers/` (D-054).

## 1. Audit summary

- **No Coworker code exists.** The only shipped Coworker-flavoured interaction is the
  artifact detail's **Coworker action → chat dock** (`src/pages/artifacts/`), with the
  artifact declared as context.
- **Reusable patterns** (verified): Artifact page (library/detail/new trio, store v1
  envelope, inline confirm, row grammar), ChatCore (conversation surface with header,
  stream, composer — shipped and e2e-covered), workspaces store (`useWorkspaces`) for
  membership selects, artifacts store for the artifact section.
- **Rail**: global nav (Overview, Recently, Compute, Connect, Chat) + library nav
  (Artifacts, Notes, User). Coworkers joins the library group before Artifacts — it is
  an entity library, not a dashboard.
- **Honesty constraints** from the product docs: no runtime status (WAM not
  connected), no fake Current Work items, no fake activity, conversation is the only
  live surface (real chat), config changes are logged.

## 2. Information architecture (final)

```
Rail: Coworkers (library group, before Artifacts)
/coworkers              Directory — list-first: mark, name, brief, status, workspaces
/coworkers/new          Creation  — name + responsibilities + optional workspace
/coworkers/:id          Working interface — conversation (ChatCore) primary;
                        side column: Current Work · Artifacts · Activity
/coworkers/:id/config   Configuration — identity / responsibilities / workspace
                        access / context & artifacts / toolsets / behavior note
```

Working interface composition: the entity head (identity strip + Configure link) above
**ChatCore as the conversation surface** — the shipped chat experience, bound to the
active conversation, with the Coworker declared as a context source on entry (the same
declared-context pattern the artifact detail ships). Side column sections stacked;
Current Work shows its honest empty state until real signals exist.

## 3. Data model (prototype)

```ts
membership: { wsId, role }
coworker: { id, name, description, responsibilities: {for,notFor,output},
            status: 'active'|'paused'|'archived', createdAt, memberships }
store v1 (thylas:coworkers:v1): seeds + created + removed + responsibility overrides
            + membership add/remove + status overrides + log; validated read, caps.
```

Three seeds: Protocol Reviewer (Research), Boundary Table Scribe (Research + Onda Lab),
one archived example? — no: archiving is a user action; two active seeds suffice.

## 4. Honesty rules

Conversation is the real chat (no fake agent replies); Current Work renders its empty
state until real signals exist; Activity is the store log only; toolsets render as
declared grants with a "runtime not connected" note; no WAM status anywhere.
