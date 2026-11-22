# 07 — Cross-Project Application (GSC × Thylas × Lemma)

How the shared concepts apply **independently** in each ecosystem. Compatible with the GSC
agent's `07-cross-project-application.md` and Lemma's set; disagreements are recorded, not
merged.

## 1. Capability matrix

| Capability | GSC | Thylas | Lemma |
|---|---|---|---|
| Information Model | **Defines** the ecosystem model: raw/structured items, relations, provenance, proposals | Consumes + extends at Artifact level (versions, authority, canonical reuse) | Learning-centered model: knowledge items + prerequisite partial order + derived learner state — **must stay local** |
| Classification | Controlled dimensions × free values × scope | Artifact taxonomy + user-defined objects (`TAXONOMY.md`) | concept / skill / problem_type; course structures |
| Representation | Persistent: Clusters, Contexts (explicit assembly). Scratch/kept tier is a **gap** | Boards (units/edges/sections/arrangement) — shipped Work Representation | Knowledge structures + study Space; reorganization = cognitive act |
| Multiple Views | Overview/list/grid/reader/Canvas-tree/Recently/Activity (all projections) | Home Conversation, Coworker UI, boards, run views, candidate review | concept map, path, quiz, progress |
| Process Model | process-as-history (events) | Run observability **fed by WAM** (boundary preserved) | learning workflows, Socratic loops, evidence feedback loop |
| Provenance | **Defines** it (origin/events/SemTag; supersede chain) | Artifact versions + authority + `MutationIntent` + candidate pipelines | explain-why for learner growth; material source tags |
| Collaborative Editing | single-user-first; proposals as agreement protocol | multi-actor by design (User + Coworkers); agreement through proposals | learner + agent co-editing explanations |
| Context Assembly | **Defines** it (Contexts: subject/scope/purpose + explicit members) | `@` invocation → `ContextSource` chips → Working Context; board selections | study scope; bounded practice sets |

## 2. Scenarios

### Scenario A — GSC: hundreds of persistent objects
Explore, find, understand relations, inspect provenance, build a custom representation,
ask a Coworker to analyze a selection, save the result. **[ours]** GSC must support this as
**optional lenses over canonical information** — representations are never prerequisites
(the anti-KM-app discipline). Thylas's candidate→commit pipeline is the reusable shape for
"ask a Coworker, save the result" (proposals, not auto-writes).

### Scenario B — Thylas: research project with Coworkers
Share Artifacts, organize materials, work a common representation, observe agent activity,
modify agent output, preserve decisions, reuse prior work. **[ours]** Composition = GSC
contexts (when they exist) + Artifacts (canonical outputs) + boards (shared
representation) + home-interaction blocks (proposals/diffs/candidates) + engagement traces.
The governance loop is already shipped in miniature (extract→review→commit).

### Scenario C — Lemma: months-long learning
Collect materials, build concept structures, see relations, find gaps, reorganize
understanding, revise explanations with an agent, observe development. **[ours]** Lemma can
reuse the *mechanisms* (representation as units+relations+arrangement, candidate→commit,
attribution, views-as-projections) while its **objects stay pedagogical** (mastery,
misconception, learning path). "Reorganize their understanding" is a representation
operation on *understanding*, not on governed information — the two must not be conflated
(glossary: Knowledge Object divergent).

## 3. Required conclusions (Thylas version)

1. **Shared primitives (candidates):** typed objects with provenance + lifecycle; typed
   relations; **proposal→confirmation agreement protocol** (already independently real in
   GSC D-042 and Thylas CANONICAL-REUSE — strongest candidate); representation =
   reference-set (units + relations + arrangement); engagement/event traces; explicit
   context/selection boundaries.
2. **Shared interaction patterns:** select→delegate; explicit submission before agent
   work; clarify-or-proceed; results land as reviewable proposals; edit-level attribution;
   evidence on demand.
3. **Shared infrastructure candidates:** provenance/trace recording; agreement-protocol
   engine; context assembly + export. **NOT shared:** databases, runtimes, UI kits,
   taxonomies.
4. **Domain-specific models:** GSC cross-workspace governance; Thylas Coworker identity /
   Artifact authority / workspace tenancy; Lemma cognition + pedagogy.
5. **Domain-specific views:** GSC library/reader/canvas-tree; Thylas home conversation /
   boards / run views; Lemma path/quiz/progress/concept-map.
6. **Never shared:** WAM runtime state; Lemma learner model; Thylas Coworker persona;
   GSC internal taxonomy must not be imposed on Lemma.
7. **Future integration points:** context export/import across stable interfaces;
   proposal-protocol interop (Artifact proposals referencing GSC objects); a
   representation exchange format (units+relations+arrangement JSON) **only if Q-F goes
   beyond "concepts only"**.

## 4. Cross-agent coordination (A–F)

**A. Thylas-specific findings.**
- Governance is *already implemented* in two pipelines (profile, artifact-candidates) —
  proposal→confirm→commit→history is proven pattern, not aspiration.
- Boards are a shipped Work Representation engine; the D/E research maps cleanly onto its
  primitives (cards/edges/sections/gestures).
- `MutationIntent` (`src/lib/mutation.ts`) is Thylas's attribution/commit nucleus — a
  candidate shared primitive if Q-F > concepts.
- Home Interaction docs 00–11 define the conversational/structured/dedicated surface
  taxonomy and the intelligence UI rules this research assumes.

**B. Reusable by GSC/Lemma.** Candidate→commit pipeline semantics (idempotent content key,
never silent overwrite, append-only history); attribution-class table (06 §3);
proposal-rendering patterns (`proposal`/`diff`/`candidates` blocks in `lib/chat.ts`).

**C. Potential conflicts (recorded, not merged).**
- **C1 versioning philosophy:** Thylas immutable versions + authority vs GSC supersede
  chains vs Lemma "no time travel" — three change-control styles; exchange formats need
  mapping tables, not a merged model.
- **C2 terminology drift:** Thylas docs say "Knowledge Object / Context Entry" for GSC
  concepts; GSC's implementation says "Chunk / Structured Object / Context (assembly)".
  Resolution proposal in 10-glossary; do not fork further.
- **C3 independence:** any Lemma→GSC dependency is undecided (Q-F) and must not be assumed.
- **C4 process-first-class** would add entities to GSC against its "no unnecessary
  entities" discipline — requires Q-D evidence first.
- **C5** (new, Thylas-side): home-interaction's "Working Context" term vs GSC's
  "Context View (assembly)" vs presentation-View — three senses, must stay qualified.

**D. Shared concepts (consistent definitions wanted).** Information Object, Work
Representation, View, Process, Event, Provenance, Context Entry, Proposal/Confirmation,
Attribution → 10-glossary.

**E. Domain-specific concepts.** GSC: Chunk/Object taxonomy, capture pipeline, MCP/API
surface. Thylas: Coworker, Workspace tenancy, Artifact authority model, boards gestures.
Lemma: mastery, misconception, learning path, Socratic turn, quiz item, learner state.

**F. Questions for other agents** → 09 §5.
