# 03 — Representation Model Exploration

How are information objects selected and organized for a working purpose? Key term: **Work
Representation** (D, shared-definition candidate) — "the organization of units and relations
(plus arrangement/annotations) that humans and agents form and revise to advance work."
Not the information itself, not the UI, not the storage.

## 1. The shipped instance: Thylas boards

`src/pages/boards/` is already a Work Representation engine (5,800 lines, tested):

| Element | Board primitive | Note |
|---|---|---|
| Unit | `BoardCard` (title, lines, colour, `ref`, `live`) | text units today; `ref` links to objects |
| Relation | `BoardEdge` (label, sides, curve/ortho, direction) | typed vocabulary is a gap (02 §3) |
| Group | `BoardSection` (named region) | = GSC "Cluster" analogue |
| Arrangement | free x/y placement + align/distribute gestures | position is meaningful (Huabu: "position is part of the thinking") |
| History | `boards/history.ts` undo/redo (session-only) | **not** provenance (A×D gap) |

The Huabu replication plan (`docs/development/boards/HUABU-PLAN.md`) adds node kinds,
intake, and honest delegation — same representation core.

## 2. The six questions

### 2.1 What is a unit?
Anything addressable can be *referred* into a representation (02's objects) plus
**derived units** that exist only inside the representation: annotations, frames, ink
strokes (E), extracted candidate blocks (Thylas `candidates` block). **[ours]** A derived
unit is a child of the representation unless promoted (see §4 ladder).

### 2.2 Relations vs proximity
E's "local targeting" difficulty + boards' typed edges both say: **spatial proximity is a
hint; named relations are the fact.** A cluster-by-position should be able to *propose* a
relation, never silently create one (mutation.ts commit gate).

### 2.3 Sequences & hierarchies
Lemma's prerequisite partial order (`knowledge_edges`, acyclic) is a domain-specific
relation set. The shared shape is "typed acyclic/any relations with provenance" — not the
pedagogical meaning.

### 2.4 Who arranges?
Four authorship modes: user-arranged, agent-arranged (as *proposal*), imported (e.g. from a
source document's structure), inferred (layout algorithms). D's finding — systems support
agent *incorporation* well and agent *reorganization* badly — maps to a governance rule:
**agent reorganization is always a Revision Proposal (home-interaction 04 §2), never an
in-place mutation.**

### 2.5 Private explorations vs shared representations
Three persistence tiers (GSC's 03 §4 ladder, adopted here as **candidate**):

| Tier | Meaning | Default |
|---|---|---|
| **Scratch** | auto-expiring working state (marquee selection, drag preview, ink drafts) | minutes–hours |
| **Kept** | user-pinned, private/semi-shared arrangements ("my board for next week") | until deleted |
| **Canonical** | governed, shared, proposal-mediated (a published board section set) | authority + versions |

Answer to "does every representation need to be persistent?" — **No.** Evidence: B shows
intermediate results must survive *sometimes*; D shows premature structure ossifies.
Ladder with a default of scratch + explicit promotion is the [ours] synthesis. Unknowns:
scratch TTL; may an agent promote (presumed **no** — promotion is a user act).

### 2.6 Representation history
A×D: structural moves (group/ungroup/move/pin) are collaboration history. Rule candidate:
record structural moves as **events** first; promote to entities only if queries demand
(GSC 02 §2 discipline). Boards' undo stack is not this and must not be mistaken for it.

## 3. Reorganization operations (the D gap)

Minimum operation vocabulary for a malleable representation:
`place · remove · group · ungroup · connect · disconnect · align · order · annotate ·
promote · demote · merge · split`. Each maps to either a local edit (scratch) or a
MutationIntent (kept/canonical). **[ours]** The hard cases from D — consequential changes
beyond the representation (renaming a canonical object from inside a board) — are exactly
home-interaction 04's Revision Proposal flow; the governance model is already designed,
the UI is not.

## 4. The persistence question restated (for the brainstorm)

Q-E alternatives (08): everything-ephemeral / everything-persistent / **ladder**. Ladder is
the recommendation *candidate* because it satisfies B (intermediate reuse), E (cumulative
assistance) and C's overhead warning (trivial work stays trivial) simultaneously. It is
NOT a decision.

## 5. What a Representation is NOT

- Not a database (D [paper]: distinct from database/document/workspace).
- Not a View (04): the same representation can be projected as a list, timeline, graph,
  spatial canvas; the representation is the organization, the view is the projection.
- Not a Workspace (Thylas workspaces are tenancy/scope; a workspace *contains*
  representations).
- Not an infinite canvas (GSC glossary warning): spatial workspace ≠ scalable surface; the
  semantics (bring materials in / think with / shape the space) are the point (E).
