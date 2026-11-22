# 03 — GSC Information & Context Interaction

**Status:** [P] behavioral spec. **Builds on** `docs/product/gsc/MANIFESTO.md` (2026-11-15) —
its terms are not restated differently here. GSC is *independent of WAM, Thylas and
Coworkers*; Thylas is a **consumer**. There is **no GSC code** today (audit §6.7), so this
document defines user-facing behavior and service contracts only — no database design.

## 1. Terminology reconciliation (the seven terms)

The brief lists terms that are NOT interchangeable. Mapping onto GSC's declared vocabulary
(Manifesto: Persistent / Structured / Addressable / Discoverable / Governed / Evolvable):

| Term | Definition (canonical here) | GSC basis | Owner |
| --- | --- | --- | --- |
| **Raw Information** | an ingested bit of source material (file text, page, transcript line) with its origin metadata. Not yet structured. | the "material" GSC structures; provenance-bearing | source/import layer |
| **Context Entry** | a *Governed, Addressable* record of one fact/claim/decision with provenance (who/when/where it came from). The atom GSC stores. | "Structured, Not Merely Stored" + Governed | GSC |
| **Knowledge Object** | a curated, named, reusable thing built from Context Entries (a concept, decision record, profile entry). Higher cohesion; carries authority/versioning like an Artifact-lite. | Addressable + Evolvable | GSC |
| **Context** | an *abstract* set of Context Entries/Knowledge Objects considered relevant to a scope (a conversation, a task, a workspace). Not an object itself. | "Shared, Not Flattened" | GSC |
| **Retrieved Context** | the concrete subset selected by a retrieval query at a moment in time — the answer to "what is available now". | Discoverable + "Accessible, Not Automatically Injected" | retrieval |
| **Working Context** | the *bound* subset a specific task/conversation is allowed to read — retrieved ∩ explicitly bound (via `@`). Per-conversation by default (see 01 §6). | "Accessible…" in practice | conversation state |
| **Artifact** | per the Artifact System: a persistent, identifiable, evolvable, reusable asset with authority and versioning (`docs/product/artifacts/DEFINITION.md`). Artifacts may be *evidenced by* Context Entries but are governed by artifact rules. | overlaps; authority rules are Artifacts' | Artifact System |

**Rulings [C] for this spec:**
- Context Entry ≠ Knowledge Object ≠ Artifact. Never auto-promote between them.
- Working Context is a *view*, not a copy: it holds references + access scope, not duplicated bodies.
- Nothing in the conversation silently reads GSC outside the Working Context.

## 2. Information types & object boundaries

- A Context Entry has: `id, scope(workspace|user|shared), type(fact|decision|preference|event|claim), content, provenance{sourceRef, fetchedAt, author}, authority, confidence?, version`.
- A Knowledge Object adds: `name, kind, structure(schema-ish), relations[]`, and a canonical identity.
- Relationships (first-class, typed, provenance-carrying — mirroring Artifacts' relation vocabulary): `supports | contradicts | derives-from | part-of | supersedes | references`.
- Boundaries: Raw Information never enters retrieval until it becomes Context Entries (explicitly created or extracted-with-review, see 04/06).

## 3. Interaction behaviors through Home Conversation

| User act | Behavior | Surface |
| --- | --- | --- |
| **Discover** | `@` GSC group → search by name/content; results show type + provenance summary | invocation palette (02) |
| **Retrieve** | "find what we decided about X" → assistant issues a retrieval request → **Retrieved Context block** lists matches with evidence lines; user picks | Intelligent UI block (05) |
| **Select & bind** | picked entries join Working Context (chips); show as "bound: n entries" | composer chips |
| **Create** | "remember that …" → assistant proposes a Context Entry (or Knowledge Object) as a **candidate**; user reviews/commits | candidate block (05) + commit model (06) |
| **Update / evolve** | "that decision changed" → **supersede** proposal (new entry, `supersedes` link) — never in-place silent edit | revision block (05/06) |
| **Organize/relate** | "link these two" → relation proposal (typed, provenance) | inline relation editor |
| **Provenance inspect** | every block exposes "where did this come from" on demand (evidence on demand) | expandable detail (05) |

## 4. Permissions, ownership, versioning, conflicts

- **Ownership/authority**: per Manifesto — explicit governance; agents hold no authority by default (same rule as Artifacts `GOVERNANCE.md`).
- **Permissions**: read = workspace membership (+ object-level visibility if present); write/commit = authority or delegated grant. The client never computes access (`session.ts:1-11`).
- **Versioning**: Context Entries are versioned with append-only history (pattern already proven: profile history append, `server/profile/store.ts:228`).
- **Conflicts**: `contradicts` relations are first-class data, not errors ("Disagreement is data", Artifacts GOVERNANCE). Conflict resolution is a dedicated review surface (08 §7) — never automatic last-write-wins.

## 5. Service/API contracts (behavioral, no new DB)

```
POST /api/gsc/search        { scope, query, types?, limit }        → { entries:[{id,type,content,provenance,score}] }
GET  /api/gsc/entries/:id                                        → entry + versions + relations
POST /api/gsc/candidates    { scope, kind: entry|knowledge-object, content, provenance } → candidate id   [review required]
POST /api/gsc/relations     { from, to, type, provenance }        → relation (pending if unprovisioned authority)
POST /api/gsc/supersede     { targetId, newContent, reason }      → revision proposal
POST /api/gsc/commit        { candidateIds[], expectedVersions? } → committed records (idempotent, never silent overwrite)
```
Contract principles (mirroring profile pipeline `server/routes/profile.ts:109-193`):
candidate → review → commit; idempotent commit keys; append-only history; failures are typed.

## 6. Explicit non-goals (Manifesto "What GSC Is Not")

Not a chat product, not a document manager, not a universal vector DB, not an autonomous
orchestrator, not an unrestricted shared memory pool. **No automatic injection** — retrieval
is an explicit, inspectable step.

## 7. Open questions (→ 09)

- Does a Workspace Context exist implicitly, or must scope be explicit per entry?
- Who may create Knowledge Objects vs Context Entries (same authority? different)?
- Is "Retrieved Context" cached/inspectable after the turn (audit trail requirement)?
- Relationship to Artifact evidence links — share one relation store or two with a bridge?
