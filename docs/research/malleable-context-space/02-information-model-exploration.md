# 02 — Information Model Exploration

What persistent information exists? Exploration only — not a schema proposal. Rule of
record: **do not turn every concept into a database entity** (Thylas quality bar; GSC
discipline). Everything marked [ours] is interpretation.

## 1. The object inventory as actually shipped (Thylas)

| Object | Identity | Provenance | Versioning | Governance | Where |
|---|---|---|---|---|---|
| **Artifact** | canonical id | `source: native \| ExternalSource`, `relations`, evidence links | `versions[]` append-only, `authored by X · applied by Y · under authority Z` | authority + proposals (CANONICAL-REUSE) | `src/data/artifacts.ts:36-56`, product docs |
| **Note** | id | (none today) | `version` optimistic-concurrency counter + local DB | user-owned | `src/state/notes.ts`, `services/notes/localDb.ts` |
| **FileItem** | id | `Source: uploaded\|imported\|produced(runId)` | none | workspace membership | `src/data/types.ts:52-64` |
| **Conversation/Message** | id | `meta{model,ms}`, `error` | `syncVersion` (optimistic lock) | workspace membership | `server/persistence/schema.ts:26-61` |
| **ProfileRecord** | `recordKey(category,content)` | `informationType: explicit\|inferred`, `confidence`, evidence | append-only `history[]` | candidate→review→commit, never silent overwrite | `server/profile/store.ts`, `src/lib/profile.ts` |
| **Reference** | `{kind:file\|note\|board\|process, id, label}` | — | — | inherits target | `src/data/types.ts:38-43` |
| **ContextSource** | `{kind:workspace\|file\|note\|board\|integration, id, name, detail}` | `detail` free text ("attached as evidence; retrieval is not implemented") | — | conversation-scoped | `src/lib/chat.ts:18-24` |
| **Board + cards/edges** | ids | none today | undo history only (session) | user-owned | `src/data/types.ts:159-208`, `src/pages/boards/` |

**[ours] The gaps are provenance gaps, not object gaps.** Notes, boards and conversations
carry identity + lifecycle but almost no provenance; every research direction says this is
where mutual awareness breaks.

## 2. Classification: multidimensional, not a tree

Explore **dimensions** rather than one inheritance hierarchy. From the papers: D
("representational roles develop in use") argues fixed taxonomies ossify too early; E
shows users classify by *what a thing is doing for the task*, not what it is.

| Dimension | Values (examples) | Nature [ours] |
|---|---|---|
| Object type | Artifact-kind (7), note, file, message, profile record | controlled vocabulary (exists) |
| Semantic role | claim, decision, question, method, evidence, example | **emergent** — proposal-gated introduction (see 08-Q-B) |
| Provenance | original / machine / confirmed / alert (GSC SemTag pattern) | shared vocabulary candidate |
| Lifecycle | draft → active → superseded → archived | controlled (exists for artifacts) |
| Scope | personal / workspace / cross-workspace | controlled |
| Domain | project / course / research thread | user free values |

Two binding rules:
1. **Dimensions are metadata first, entities later.** A semantic role is a tag with
   governance, not a table (aligns with GSC's "controlled dimension × free value × scope").
2. **No universal ontology.** Lemma's concept/skill/problem-type (`knowledge.py
   ITEM_KINDS`) and Thylas's ArtifactKind stay domain-local; only the *mechanism*
   (typed dimension + proposal-gated extension) is shared (07 §3).

## 3. Relations

Relations are first-class in Thylas Artifacts already (`ArtifactRelation` with named,
typed, provenance-carrying verbs: `validates/contradicts/instantiates/governs/part-of/
references`, TAXONOMY §2). **[ours] This is ahead of GSC's current model and should be
offered as a shared primitive**, with two research-driven additions:
- **selection relations** (E×D): "X was selected for task T" — belongs as *membership
  metadata*, not a new relation table.
- **structural-move events** (A×D): grouping/regrouping is an event on relations, not a
  relation type.

## 4. Provenance & evidence

Canonical shape (shared definition candidate, aligned with GSC glossary):
`origin (user/agent/import) · source attribution · transformation history · confirmation
state`. Thylas's `MutationIntent.provenance {sources, evidence, reasoning}` (`src/lib/
mutation.ts`) already matches this shape.

Evidence: **divergent term** — GSC `raw.evidence` (locator-bearing raw data), Lemma
mastery-qualifying evidence, Thylas artifact evidence links. Cross-project rule: always
qualify ("artifact evidence", "learning evidence", "raw evidence").

## 5. Ownership, scope, permissions

- Ownership = authority (Artifacts) / user (notes, profile) / workspace membership (files,
  conversations). Session → membership → write is the only authz path; the client never
  computes access (`src/lib/session.ts`).
- **[ours]** Cross-workspace objects need an explicit scope story before any shared
  representation format exists — permissions cannot be "overlaid" later (GSC open Q26
  agrees). Delegation of commit authority (home-interaction Q4) is the same problem.

## 6. Versions

**Conflict C1 (do not merge silently):** Thylas Artifacts version immutably (every
version pinned, authority reviews applications); GSC uses `superseded_by` chains without
immutable pinned versions. Two change-control philosophies. Lemma's knowledge items use
append-only evidence with **no time travel** ("no time travel" ruling). A shared
representation exchange format must be able to express *both* (mapping table, not a
merged model) — see 07 §10-C.

## 7. What must NOT become an information object

Views (04), temporary selections, tool calls, chat drafts, spatial coordinates (they are
metadata on an arrangement), process state (05), learner state (Lemma: "state is a pure
function of items/edges/evidence — deliberately not one of them").
