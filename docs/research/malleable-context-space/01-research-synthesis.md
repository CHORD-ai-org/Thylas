# 01 — Research Synthesis (Thylas reading)

Evidence labels: **[paper]** = stated at the inspected level (A/D = abstract only);
**[ours]** = our interpretation. Direction digests B/C/E are relayed from the GSC and
Lemma agents' inspections (paths in README §6); A was re-verified from the abstract by
this agent.

## 1. The five directions

### A — Ream: mutual awareness through engagement traces *(abstract-level)*
**[paper]** In shared human-agent workspaces a "mutual awareness challenge" arises: agents
act faster than humans can monitor, and users' evolving interests are not always expressed
in chat. Ream (literature-review workspace) supports mutual awareness through **structured
artifacts, bidirectional engagement tracking, and localized visualizations** — users see
each party's activity *within documents*; agents retrieve the same history. 18-researcher
studies: traces used to inspect evidence, steer agents, communicate via annotations,
reflect on focus; shared history helped agents build on earlier work.

**[ours]** Provenance is not an audit appendix — it is an interaction surface. The same
trace serves both directions: humans read it as "what did the agent do", agents read it as
"what did the human change". For Thylas this is the missing layer above Artifact
versioning: versions record *what* changed; engagement traces record *who engaged how*.

### B — CLEO: concurrent editing & attribution *(partial full-text, via cross-agent)*
**[paper]** Transparent-but-unattributed concurrent editing produces conflicts, not
collaboration: agents mistake user edits for their own state and revert them. CLEO names
the gap **collaborative context awareness** (distinguish *feedback* / *independent work* /
*co-editing*) and adds User Change Detection + Attribution Change modules; studies yield
action modes, triggers, and a hand-off/co-work decision loop.

**[ours]** Attribution is a data problem before a UI problem. Thylas already separates
*intent* from *commit* (`src/lib/mutation.ts`); what it lacks is **edit-level attribution
classes** (the five CLEO-style intents). The profile pipeline's `by` field and artifact
`versions[].by` are origin-level only.

### C — Interaction / Process / Infrastructure *(partial full-text, via cross-agent)*
**[paper]** Three layers: Interaction (projection), Process (explicit, inspectable,
modifiable), Infrastructure (replaceable). Process model = Problem Space / Workflow /
Operations / Environment / Reflection + structural adaptation. Diagnosis: chatbot/copilot/
task-agent modes all lack a shared explicit process representation. Risks stated by the
paper itself: representation overhead, over-structuring, human/agent interpretive drift.

**[ours]** Process-as-persistent-structure is a real candidate but the paper is conceptual
with no longitudinal validation. Thylas's shipped `Process`/runs (compute surfaces) are
*observability projections fed by WAM* — that boundary must survive any process model.

### D — Working Through Representation / Malleable Workspace *(abstract-level; R1/R2/R3 NOT inspected)*
**[paper]** Humans and agents form and revise **Work Representations** — the organization
of units and relations that advances work — distinct from a database, document, or
workspace. 58-paper analysis + 3-month longitudinal study (7 expert agent users): systems
support local incorporation of agent output well, reorganization poorly, consequential
changes beyond the representation worst. "Representational roles develop in use."

**[ours]** The *organization itself* is work product. Agent-driven reorganization is the
hardest, least-solved capability — which aligns with Thylas's governance instinct:
machine output is a **proposal, never a structural mutation** (`mutation.ts` commit gate).
Thylas boards (`src/pages/boards/`: sections, cards, edges, free placement) are already a
shipped Work Representation instance.

### E — Inkitiate: ink-initiated situated assistance *(partial full-text; paper cached in Lemma repo)*
**[paper]** In a spatial workspace, selections and ink marks delimit what the agent may use
and where results land; three assistance activities: **bringing materials in, thinking with
materials, shaping the space**; explicit ink submission + bounded spatial context; results
return as persistent editable objects. Observed difficulty: "addressing local targets".

**[ours]** *Selection + spatial relation IS a context-boundary language.* Thylas's
`@` invocation + context binding (`src/lib/invoke.ts`, `ContextSource`) is the declarative
version of the same idea; Inkitiate adds the gestural version. The "local targeting"
difficulty warns against encoding semantics purely spatially.

## 2. Cross-dimension interactions (the emergent findings)

| Pair | Interaction | Thylas implication |
|---|---|---|
| E × D | If selections express context boundaries, Work Representations should record **selections as first-class sub-structures** | `ContextSource` could carry "why selected / by which gesture" metadata (today: `detail` string only) |
| A × D/C | Provenance must attach to **structural moves** (group/regroup/pin), not only content edits | Board gestures (drag/bend/group) should emit events; today boards have undo history only (`boards/history.ts`) |
| B × D | Intermediate results are persistent units (agents appropriate partial output) | Chat's `artifact` block and the extraction candidates are exactly these units — they already persist as candidates (`artifactCandidates.ts`) |
| C × A | Process traces + engagement traces are what future agents need to "build on earlier work" | Home-interaction's proposal/diff blocks (05-intelligent-ui) are the surface; the trace store is the missing substrate |
| E × D | Spatial proximity *may* carry intent — but "local targeting" failure says: keep spatial hints as soft metadata, semantic relations explicit | Boards' `BoardEdge` (typed relations) stays authoritative; proximity is not a relation |

**[ours] The loop:** Represent (D) → manipulate in place (E) → attribute concurrent changes
(B) → make activity mutually visible (A) → reflect and adapt structure (C) → back to
Represent. "Malleable Context Space" is the claim that this loop should be **one coherent
substrate**, not five product features. The design risk is over-structuring (C's own
warning): the substrate must degrade gracefully to a plain list and a chat box.

## 3. What this changes in Thylas's current thinking

1. **Provenance → participation.** Artifact versioning (who wrote v4) is necessary but
   insufficient; the working experience needs engagement traces attached to objects
   (Ream). Maps directly onto `MutationIntent` (06 of home-interaction) — extend `history`
   from commit-log to engagement-log.
2. **Attribution classes before merge UI.** Home-interaction 05 §4's "patch, don't replace"
   needs CLEO's intent vocabulary (feedback / independent / co-edit / takeover / reuse) to
   distinguish user edits from instructions.
3. **Representations are work products.** Boards' arrangement is not decoration; a saved
   board state is a candidate for canonical persistence (03 §4 persistence ladder).
4. **Selection is context language.** Composer chips + board marquee-selection should feed
   the same "Working Context" concept (home-interaction 03 §1).
5. **Do not over-build.** C's overhead warning + D's "roles develop in use" argue for
   events-first, entities-on-demand (Thylas's existing discipline: "don't turn every
   concept into a database entity").

## 4. Limitations

- A and D are abstract-level; D's R1/R2/R3 claims are **not cited** anywhere in this set.
- B/C/E findings are relayed from cross-agent inspections, not re-read here.
- B's quantitative details are version-inconsistent across inspections — treat patterns,
  not ratios, as reliable.
- No paper covers cross-workspace governance (GSC/Thylas territory) — the gap this research
  must fill with [ours] reasoning, clearly labelled.
