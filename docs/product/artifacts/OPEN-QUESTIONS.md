# Open questions — Artifact system

Every unresolved product and architectural decision, collected. Each names the document
that raises it and, where known, who or what must decide it. Nothing in this list is
silently assumed anywhere else in the set.

## 1. Identity and registry

| # | Question | Raised in | Notes |
| --- | --- | --- | --- |
| 1.1 | Canonical id format: opaque id vs human-readable key vs both (key + id)? | CANONICAL-REUSE §4 | Human-readable keys age badly across workspaces; opaque ids need a lookup surface. |
| 1.2 | Where does the canonical registry live — per deployment, per org, or per user? | CANONICAL-REUSE §2 | Blocks server persistence design. |
| 1.3 | What happens on **deletion** of a canonical artifact? References and derived objects dangle — tombstone or hard rule against deletion while referenced? | LIFECYCLE §5 | Notes have a tombstone precedent **[I]**. |

## 2. Persistence and architecture

| # | Question | Raised in | Notes |
| --- | --- | --- | --- |
| 2.1 | Storage technology for the artifact store | backend/OVERVIEW §2 | Deliberately undecided; chat-domain migration first (D-052). |
| 2.2 | Content storage: inline vs content-addressed blobs for large datasets/binaries | TAXONOMY §2.4 | Datasets may exceed any inline budget. |
| 2.3 | Production host for the middleware (carried from AI subplan Q-2) | development/chat/AUDIT | Gates everything server-side. |

## 3. Lifecycle and collaboration

| # | Question | Raised in | Notes |
| --- | --- | --- | --- |
| 3.1 | Exact version-boundary semantics: what the system auto-versions vs what the author names | LIFECYCLE §3 | Notes idle-save is the precedent; artifact scale may need more. |
| 3.2 | Diff surface for non-text content (diagrams, tables, datasets) | LIFECYCLE §3 | Text diff exists; the rest is unsolved. |
| 3.3 | Review-gating granularity: per artifact, per spec, per field? | GOVERNANCE §5 | |

## 4. Governance

| # | Question | Raised in | Notes |
| --- | --- | --- | --- |
| 4.1 | Who can grant **authority** — can maintainers delegate? | GOVERNANCE §5 | Org-level question; needs the org model. |
| 4.2 | Review cadence defaults per category (Conceptual vs Empirical differ) | GOVERNANCE §3 | |
| 4.3 | How agent proposals aggregate: many small proposals vs batched review sessions | GOVERNANCE §2 | Ties to WAM's working cadence. |

## 5. User-defined objects (USOS)

| # | Question | Raised in | Notes |
| --- | --- | --- | --- |
| 5.1 | Spec residency: workspace-local, canonical, or both? | USER-DEFINED-OBJECTS §6 | |
| 5.2 | Constraint enforcement point: write-time vs render-time | USER-DEFINED-OBJECTS §6 | |
| 5.3 | Spec authoring UI: form builder vs document-first structure detection | USER-DEFINED-OBJECTS §6 | |
| 5.4 | Structured export format for agents reading instances | USER-DEFINED-OBJECTS §6 | Must serve WAM without becoming WAM's ontology. |
| 5.5 | Instance query surface ("all Products where Pricing = X") | USER-DEFINED-OBJECTS §6 | Search, not storage, is the hard part. |

## 6. Cross-workspace

| # | Question | Raised in | Notes |
| --- | --- | --- | --- |
| 6.1 | Permission model details: who grants Visible/Usable/Proposer, and revocation semantics | CANONICAL-REUSE §5 | Blocks any multi-workspace implementation. |
| 6.2 | Notification mechanism and its digest/urgency model | CANONICAL-REUSE §6 | In-product feed is the decided floor **[C]**; anything more is open. |
| 6.3 | Whether derived objects can offer "re-sync from source" without becoming mirrors | CANONICAL-REUSE §8 | |

## 7. Methodology

| # | Question | Raised in | Notes |
| --- | --- | --- | --- |
| 7.1 | Run records: where do they live if the methodology is canonical elsewhere? | METHODOLOGY §4 | Decided direction: running workspace owns results **[C]**; storage mechanics open. |
| 7.2 | Structured, machine-checkable procedure format vs prose with conventions | METHODOLOGY §2 | |
| 7.3 | Pipelines / composition of methodologies | METHODOLOGY §6 | Named future work; no design yet. |

## 8. External integrations

| # | Question | Raised in | Notes |
| --- | --- | --- | --- |
| 8.1 | Obsidian vault watch: polling vs file-watch granularity; conflict UX | EXTERNAL-INTEGRATIONS §4 | Sequencing puts Obsidian first. |
| 8.2 | Notion block-mapping fidelity targets (which block types must survive v1) | EXTERNAL-INTEGRATIONS §3 | |
| 8.3 | Two-way mirror field-level design | EXTERNAL-INTEGRATIONS §2 | Deferred until persistence exists **[C]**. |

## 9. Product framing

| # | Question | Raised in | Notes |
| --- | --- | --- | --- |
| 9.1 | Are collections/folders of artifacts an artifact relation or a view? | DEFINITION §8 | Deferred until artifact browsing UI exists. |
| 9.2 | Artifact deletion UX (if 1.3 allows it): what the user must see before confirming | LIFECYCLE §5 | |

— Nothing here blocks **[I]** work already shipped: chat artifact blocks and
save-as-note are unaffected by every open question above.
