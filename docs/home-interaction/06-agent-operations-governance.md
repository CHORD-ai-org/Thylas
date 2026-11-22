# 06 — Agent Operations & User Data Governance

**Status:** [P] governance model. One model for every agent-side act on user-owned
information — GSC entries, Artifacts, User Profile, notes, resources. Grounded in the
shipped profile pipeline (`server/profile/store.ts:142-242`), which already implements
candidate review, idempotent commit, never-silent-overwrite, append-only history.

## 1. Operation vocabulary

| Op | Class | Side effect | Needs commit authority? |
| --- | --- | --- | --- |
| **Read** | query | none | no (read permission only) |
| **Discover** | query | none (creates retrievable state at most) | no |
| **Suggest** | propose | creates a *proposal* record | no |
| **Create** | write | new object | yes |
| **Update** | write | new version of existing object | yes |
| **Organize** | write | membership/tags/grouping | yes (low risk) |
| **Relate** | write | relation between objects | yes (low risk) |
| **Archive** | write | soft state change | yes (low risk) |
| **Delete** | destructive | soft/hard delete | yes (high risk) |

## 2. The mutation model (nine fields)

Every write-intent, from any domain, is a **MutationIntent**:

```
{
  intentId, actor: {kind: user|agent|coworker, id},
  op: 'create'|'update'|'organize'|'relate'|'archive'|'delete',
  target: {kind, id?},            // id absent for create
  before?, after,                 // before/after snapshots (after = proposed state)
  provenance: {sources[], evidence[], reasoning?},
  risk: low|medium|high,
  requiresApproval: boolean,      // derived from risk + authority (§5)
  status: proposed|approved|committed|rejected|undone,
  committedAt?, historyRef        // append-only history id
}
```

## 3. Execution permission ≠ commit authority **[C]**

- **Execution permission** = may the actor *run the operation* (read sources, compute a
  proposal, call a model). Sessions/workspaces grant this.
- **Commit authority** = may the result *become persisted user information*. Held by the
  user (and delegates); **agents hold no authority by default** (Artifacts GOVERNANCE.md,
  GSC Manifesto's "modification authority").
- Worked example (from the brief): an agent may *prepare* a new Profile Entry or *propose* a
  change to an existing Artifact — without any permission to overwrite confirmed information.
- Consequence: most agent "work" ends in `proposed` state; commit is a user act (or an
  explicitly delegated grant — see open questions).

## 4. Lifecycle

```
intent → (authorization check) → execute if allowed
       → proposal artifact (candidate / revision / suggestion)
       → human review (edit / reject / approve)
       → commit (idempotent, versioned, history entry)
       → reversible? (undo/recovery before commit; compensating entry after)
```

Precedent in code: `pending → accepted|rejected|edited` then `/commit` then history
(`store.ts:168-242`); commit keys dedupe (`recordKey`), confirmed records are never
silently overwritten (`store.ts:207-210`).

## 5. Risk-sensitive confirmation

Do not ask for everything. Confirmation is required by **risk and irreversibility**:

| Risk | Examples | Confirmation |
| --- | --- | --- |
| **Low** | suggest, organize, relate, draft create in private scope | none — undo affordance instead |
| **Medium** | create/update user-visible objects (notes, context entries) | single inline confirm showing before→after summary |
| **High** | delete, authority changes, anything that supersedes a canonical artifact, bulk operations | explicit inline approval with diff + scope ("this affects 3 artifacts") |

Rules: confirm *before* commit; show before/after at the decision point (interaction
contract); never a modal (D-047) — inline expansion; reversible ops prefer undo over
prompt.

## 6. History & reversal

- History is append-only per object: `{at, by, action, from, to}` (profile precedent).
- Before commit: undo reverts the proposal; after commit: "reversal" creates a compensating
  version (`supersedes`/`reverts` relation), never a silent delete of history.
- Everything is attributable: `authored by X · applied by Y · under authority Z`.

## 7. Reusability across domains

| Domain | Target kind | Proposal kind | Commit authority |
| --- | --- | --- | --- |
| User Profile | `ProfileRecord` | `ProfileCandidate` (**shipped**) | user (via `/commit`) |
| Artifacts | `Artifact` (canonical) | Candidate / Revision Proposal (04) | maintainers/authority |
| GSC | Context Entry / Knowledge Object | entry candidate / supersede proposal (03) | owner/grant |
| Notes/resources | `Note`, `FileItem` | draft/patch | user |

One shared vocabulary (§2) with per-domain storage. Do **not** build a generic mutation
framework first — extract the shared types once two domains ship.

## 8. Honest limitations (current code)

- Only the profile domain has this model today; artifacts/GSC/notes writes are client-local.
- `/api/ai*` endpoints carry no session check (audit §3) — any agent-op design must add authz before relying on them.
- No delegation/grant mechanism exists (who may commit on behalf of the user is an open question).

## 9. Open questions (→ 09)

- Delegation: can the user grant standing commit authority to a Coworker (scoped, revocable)?
- Batch commit: one confirm for many mutations, or per-mutation?
- Retention/deletion policy for history and proposals (PIPL implications).
