# Malleable Context Space — Cross-Project Research (Thylas × GSC × Lemma AI)

> Status: **research exploration** for the founder-led brainstorming session.
> NOT an approved architecture or product decision. "Malleable Context Space" is a
> tentative direction name, not an approved product name.
> Produced 2026-11-21 by the **Thylas agent** (one of three project-specific agents).

## 1. Why this research exists

Three projects circle the same problem from different angles:

- **GSC** (Global Shared Context) — persistent, structured, addressable, discoverable,
  governed, evolvable context infrastructure (`Thylas/docs/product/gsc/MANIFESTO.md`;
  implementation lives in `D:/github projects/GSC`).
- **Thylas** — the human-facing environment: User / Workspace / Coworker / Artifact;
  Home Conversation as the unified interaction entry point (`docs/home-interaction/`).
- **Lemma AI** — long-term learning and cognitive growth: "Learning is building, breaking
  and rebuilding a model of something — not collecting"
  (`D:/github projects/lemma-ai/docs/design/pitch-deck/build/build_deck15.py:894`);
  "Growth happens between requests" (`:164`).

All three need the same underlying answers: what is a working representation, how do
humans and agents manipulate it together, how does work persist and evolve, how is the
same information presented differently. This research explores whether one shared
conceptual foundation can serve CHORD and Lemma **without forcing identical products,
taxonomies, databases, or runtimes**.

## 2. The three projects and their relationship (working hypothesis, not decision)

```text
                    Shared Design Foundation
                  (Research / Concepts / Models)
                              |
               +--------------+--------------+
               |                             |
        CHORD / GSC                       Lemma AI
               |
           Thylas
               |
        Human-Agent UX
```

| Project | Role | Boundary (preserved) |
|---|---|---|
| GSC | persistent context infrastructure, independently evolvable | GSC ≠ WAM runtime state; not a vector DB / document repo / agent memory |
| Thylas | human-facing environment (Coworkers, Workspaces, Artifacts, Intelligent UI) | does not own GSC infrastructure; WAM owns agent runtime |
| Lemma | learning-oriented environment (cognitive growth domain model) | must NOT become "just a GSC interface"; learner model stays local |

**Open**: whether Lemma depends on GSC at all — undecided. Do not assume shared
database, backend, API, or taxonomy.

## 3. The five research directions

| # | Direction | Paper | Evidence level here |
|---|---|---|---|
| A | Ream — mutual awareness via engagement traces | *Ream: Unfolding Mutual Awareness in Human-Agent Workspaces* (UCSD/AI2/UW, arXiv 2610.09497) | **abstract-level** (verified by Thylas agent) |
| B | CLEO — concurrent human-agent editing & attribution | *"When to Hand Off, When to Work Together"* (arXiv 2603.02050) | **partial full-text** (via GSC/Lemma agents' inspections) |
| C | Interaction / Process / Infrastructure | *A Unified Framework for Human-Agent Collaboration* (arXiv 2506.11718, MSR) | **partial full-text** (via cross-agent inspection) |
| D | Working Through Representation / Malleable Workspace | *Malleable Workspaces for Human-Agent Knowledge Work* (MSRA/Tongji/CataX, arXiv 2610.30893) | **abstract-level**; R1/R2/R3 **not inspected** |
| E | Inkitiate — ink-initiated, situated agent assistance | *Inkitiate* (arXiv 2610.39905, implemented in microsoft/Huabu) | **partial full-text** (Lemma repo caches the paper: `lemma-ai/inkitiate.html`) |

Evidence discipline: every claim is labelled **[paper]** (stated by the paper at the
inspected level) or **[ours]** (our interpretation). Abstract-only findings are never
quoted as if full text were read.

## 4. What is established vs exploratory

**Established (preserved from existing decisions):**
- GSC's six properties and its independence from WAM (GSC MANIFESTO).
- Thylas Artifact governance: one canonical artifact, one authority, many references;
  agreement through proposals (`docs/product/artifacts/CANONICAL-REUSE.md`, `GOVERNANCE.md`).
- Candidate → review → commit governance is **already real** in code: the profile pipeline
  (`server/profile/store.ts`) and the artifact-candidate pipeline (`src/state/artifactCandidates.ts`,
  `src/lib/artifact-extract.ts`).
- Home Conversation is the entry point, not the entire interface (`docs/home-interaction/01-vision.md`).
- WAM owns agent runtime; Thylas projects run state (`docs/product/coworkers/WAM-BOUNDARY.md`).
- Lemma's knowledge model is domain-specific: knowledge items + prerequisite partial order
  + derived learner state (`lemma-ai/backend/models/knowledge.py`).

**Exploratory (NOT decided):** everything in 02–08 — the four conceptual models, the view
catalogue, process first-class-ness, spatial workspace status, persistence thresholds, and
the CHORD↔Lemma sharing strategy (concepts vs spec vs SDK).

## 5. Documents

| # | Document | Answers |
|---|---|---|
| 01 | [Research synthesis](01-research-synthesis.md) | five directions, cross-dimension interactions, the loop |
| 02 | [Information model](02-information-model-exploration.md) | objects, relations, provenance, multidimensional classification |
| 03 | [Representation model](03-representation-model-exploration.md) | units/relations/arrangements, persistence ladder, boards as the shipped instance |
| 04 | [View model](04-view-model-exploration.md) | view catalogue; View ≠ Representation; views need no storage |
| 05 | [Process model](05-process-model-exploration.md) | process-as-derived vs first-class vs hybrid; WAM boundary |
| 06 | [Human-agent interaction](06-human-agent-interaction.md) | direct manipulation, conversational, bidirectional editing, mutual awareness, cognitive load |
| 07 | [Cross-project application](07-cross-project-application.md) | GSC/Thylas/Lemma capability matrix, three scenarios, shared-vs-local conclusions |
| 08 | [Architectural alternatives](08-architectural-alternatives.md) | Q-A…Q-G, 2–3 alternatives each, no winner declared |
| 09 | [Open questions](09-open-questions.md) | classified questions + founder list + questions for the other agents |
| 10 | [Glossary](10-glossary.md) | shared vs divergent terms, aligned with GSC's glossary rulings |
| 11 | [Thylas action & decisions](11-thylas-action-and-decisions.md) | 三条行动线 + 8 项决策点登记 + Q-C 决策卡 |

## 6. Shared research index (exact local paths)

| Source | Path | Verified by |
|---|---|---|
| GSC research set (11 docs) | `D:/github projects/GSC/docs/research/malleable-context-space/` | GSC agent |
| GSC Manifesto (charter) | `D:/github projects/Thylas/docs/product/gsc/MANIFESTO.md` | all |
| Lemma research set (11 docs) | `D:/github projects/lemma-ai/.worktrees/main-v3/docs/research/malleable-context-space/` | Lemma agent |
| Lemma vision / global agent | `D:/github projects/lemma-ai/LEMMA_VISION.md`, `GLOBAL_AGENT_V0.md` | Thylas agent (read) |
| Lemma knowledge model | `D:/github projects/lemma-ai/backend/models/knowledge.py`, `plan/evidence-feedback-loop/README.md` | Lemma agent |
| Inkitiate paper cache | `D:/github projects/lemma-ai/inkitiate.html` | Lemma agent |
| Thylas home-interaction docs | `D:/github projects/Thylas/docs/home-interaction/` (00–11) | Thylas agent |
| Thylas artifact governance | `docs/product/artifacts/{DEFINITION,TAXONOMY,GOVERNANCE,LIFECYCLE,CANONICAL-REUSE,METHODOLOGY}.md` | Thylas agent |
| Thylas boards (Work Representation instance) | `src/pages/boards/`, `docs/development/boards/HUABU-PLAN.md` | Thylas agent |
| Thylas governance code | `src/lib/mutation.ts`, `src/state/artifactCandidates.ts`, `server/profile/store.ts` | Thylas agent |

**Limitations:** the Thylas agent did not re-read B/C/E papers in full — findings come from
the GSC and Lemma agents' inspected digests (labelled accordingly). A and D remain
abstract-level for everyone. No paper covers cross-workspace governance — an open gap.

## 7. Cross-agent coordination (summary)

- **A. Thylas-specific findings** → `07-cross-project-application.md` §10-A.
- **B. Reusable by GSC/Lemma** → `07-cross-project-application.md` §10-B.
- **C. Potential conflicts** → `07-cross-project-application.md` §10-C (incl. the
  **C1 versioning-philosophy conflict** and **C2 terminology drift** — not merged silently).
- **D/E. Shared vs domain-specific concepts** → `10-glossary.md` + `07` §10-D/E.
- **F. Questions for other agents** → `09-open-questions.md` §5.
