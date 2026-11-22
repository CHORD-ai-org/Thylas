# 10 — Glossary (cross-project terminology)

Rule (adopted from GSC's 10-glossary): if a term means different things in different
projects, **record the distinction** instead of forcing one definition. "Shared" = proposed
unified definition; "Divergent" = keep separate, record the mapping. This file is
compatible with `D:/github projects/GSC/docs/research/malleable-context-space/10-glossary.md`
and `lemma-ai/.worktrees/main-v3/docs/research/malleable-context-space/10-glossary.md`.

## Core terms

| Term | Status | Definition | Divergence |
|---|---|---|---|
| **Information Object** | Shared | A persistent, addressable unit with identity, type, provenance, lifecycle | GSC implements as items (`raw.*` / `object.*`); Thylas as Artifact/Note/FileItem/ProfileRecord |
| **Knowledge Object** | **Divergent** | GSC: informal name for a Structured Object (Concept/Decision…). Thylas docs (home-interaction 03) used it for GSC-side objects. Lemma: a *learner's* knowledge construction — different thing. **Do not merge.** | **C2:** Thylas's usage follows GSC's *docs*, GSC's *implementation* says "Structured Object". Resolution proposal: adopt **Structured Object** as canonical, retire "Knowledge Object" in cross-project text |
| **Artifact** | Divergent (Thylas-owned) | Persistent, addressable, evolvable asset with **authority, immutable versions, pinned canonical references**; agreement through proposals (`docs/product/artifacts/`) | vs GSC Information Object (supersede chains, no pinning) — mapping candidate: Artifact ≈ governed Structured Object + version policy. Conflict C1 |
| **Resource** | Divergent | Thylas: workspace materials. Infrastructure sense (C): external environment assets | always qualify ("workspace resource", "environment resource") |
| **Context** | Divergent by scope, shared shape | GSC: explicitly assembled, purpose-specific set (subject/scope/purpose + members). Local/task (E): bounded selection + nearby materials. WAM: task-level runtime context | qualify: "persistent context (GSC)" / "working context (local)" / "WAM shared context (runtime)" |
| **Working Context** | Thylas-local | The bound subset a conversation/task may read (`home-interaction/03 §1`) | **C5:** ≠ GSC "Context View (assembly)" ≠ presentation View |
| **Context Entry** | Shared candidate | Membership record: object X in Context C + why/by whom/when | GSC `context_members`; E suggests selection provenance travels with it |
| **Work Representation** | Shared (from D) | The organization of units + relations + arrangement humans/agents form and revise to advance work. Not information, not UI, not storage | instances: GSC Clusters/Contexts, Thylas boards, Lemma knowledge structures |
| **Unit / Relation** | Shared (from D) | Members of a representation / typed links between them (proximity is a hint, not a relation) | — |
| **View** | Shared | A projection of information and/or a representation (density, modality, ordering, filters). **Not a data model**; no storage except parameters | "View" must never mean GSC's Context assembly — say "Context" or "assembly" there |
| **Workspace** | Divergent (Thylas-owned) | Thylas: tenancy/scope unit (resources, Coworkers). GSC: deliberately **no** Workspace concept (cross-workspace infra). Lemma: Learn Space ≈ learning workspace | never use unqualified in cross-project text |
| **Spatial Workspace** | Divergent (open, Q-C) | E/Huabu: environment where placement, proximity, ink carry working meaning. **≠ infinite canvas** | its persistence status is undecided (08-Q-C) |
| **Process** | Shared (from C) | Explicit representation of ongoing activity: Problem Space / Workflow / Operations / Environment / Reflection | **not implemented as such in any project today** |
| **Activity** | **Deprecated unqualified** | Overloaded across projects | use **Event** (recorded fact), **Engagement** (participant↔object interaction, Ream), **Operation** (available action) |
| **Event** | Shared | Immutable fact record (who/what/when/why) about an object or representation | GSC `events` table; Thylas MutationIntent history is a specialized event stream |
| **Provenance** | Shared | Where information came from and how it changed: origin, source attribution, transformation history, confirmation state | Ream [paper, abstract] proposes *engagement* provenance — proposal, not decision |
| **Evidence** | **Divergent** | GSC: raw/locator data + evidence references. Lemma: mastery-qualifying records. Thylas: artifact evidence links + candidate evidence spans. UI sense: "evidence on demand" | always qualify |
| **Candidate** | Shared candidate | Machine- or agent-produced proposal awaiting review (status: pending/accepted/rejected/edited) | real in Thylas (profile + artifact-candidate pipelines) and GSC (proposals) |
| **Proposal / Confirmation** | **Shared (strongest)** | Machine produces a proposal; human confirms; only then is it authoritative | independently real in GSC (D-042) and Thylas (CANONICAL-REUSE) — the best sharing candidate |
| **Attribution** | Shared (from B) | Which participant did which edit, with intent class (feedback / independent work / co-edit / takeover / reuse) | currently origin-level everywhere; edit-level is the gap |
| **Canonical / Kept / Scratch** | Exploratory | Representation persistence ladder (03 §4) | not yet any project's vocabulary |

## Domain-local terms (explicitly NOT shared)

- **GSC:** Chunk, capture pipeline, SemTag, MCP/API surface.
- **Thylas:** Coworker, Workspace (as tenancy), boards gestures, Run, `ContextSource`.
- **Lemma:** mastery, misconception, learning path, Socratic turn, quiz item, **Learner
  State** ("a pure function of items/edges/evidence — deliberately not one of them",
  `backend/models/knowledge.py`), Knowledge Item ("not a question"), Outer/Inner Fringe.
- **WAM:** runtime state, A2A protocol terms (WAM-owned boundary).

## Registered disagreements (do not silently resolve)

| ID | Disagreement | Stance |
|---|---|---|
| C1 | Versioning: Thylas immutable+authority vs GSC supersede vs Lemma no-time-travel | coexist; mapping tables |
| C2 | "Knowledge Object/Context Entry" (docs) vs "Structured Object/Chunk" (GSC code) | proposal: adopt GSC code names in cross-project text |
| C5 | "View" three senses (presentation / Context assembly / Working Context) | always qualify |
| Q-F | Lemma's concept graph: representation-of-understanding vs governed information | open — asked to Lemma agent (09 §5.5) |
