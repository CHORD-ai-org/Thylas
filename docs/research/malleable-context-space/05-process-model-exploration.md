# 05 — Process Model Exploration

How is ongoing work represented and preserved? Do not settle prematurely: whether Process
is a first-class persistent object is **Q-D [founder]**.

## 1. The vocabulary (C, [paper])

Process model = **Problem Space · Workflow · Operations · Environment · Reflection**,
viewable and modifiable; structural adaptation allowed. Diagnosis: chatbot / copilot /
task-agent modes all lack a shared explicit process representation. Stated risks:
representation overhead, over-structuring, human/agent interpretive drift.

Neighbouring terms to keep apart (10-glossary): **Event** (immutable fact), **Activity**
(deprecated unqualified — say engagement/operation), **Task**, **History** (derived from
events).

## 2. What exists today (all three projects)

| Project | Process-ish reality | Gap vs C |
|---|---|---|
| Thylas | runs/compute surfaces: queued→running→needs_input→succeeded (`src/data/runs.ts`, `Processes.tsx`); board undo; extract candidate sessions | no Problem Space / Reflection; runs are **WAM-projected observability**, not owned |
| GSC | process-as-history (events, capture tasks, phases) | P/R modules absent |
| Lemma | learning loop strategies, methods (socratic / direct), evidence feedback loop (`plan/evidence-feedback-loop/`) | pedagogy-shaped, not general |

**Boundary (preserved):** WAM owns agent runtime; Thylas projects run state
(`WAM-BOUNDARY.md`). A process model must not absorb runtime state — GSC open Q30 asks
exactly where this line sits.

## 3. The three alternatives (full set in 08-D)

- **D1 Process-as-derived** — events + computed views. No new entities; honors C's overhead
  warning; but goals/reflections remain unrepresented.
- **D2 Process-as-first-class** — a Process entity with P/W/O/E/R slots. Faithful to C;
  adds an entity family + governance + UI — against "no unnecessary entities" unless
  evidence is strong (C is conceptual, unvalidated longitudinally).
- **D3 Hybrid** — optional structured work-entries attached to Contexts/representations,
  layered over an event substrate. Pay-as-you-go; risk: dual sources of truth.

**[ours] Thylas reading:** the *shipped* pieces argue D1/D3: Thylas already treats work as
observable projections (run views) fed by WAM, and its governance model (MutationIntent →
commit → history) is event-shaped. The part C adds that Thylas genuinely lacks is
**Reflection** — the "why did we choose this" layer. Candidate cheap move: reflection as a
first-class *entry type* (like a decision record) rather than a Process entity.

## 4. Questions this raises

1. Do process structures persist **per workspace, per representation, or globally?**
   (Cross-project: Lemma's "learn loop" and Thylas's "runs" would collide if global.)
2. Should process history influence future context retrieval? (C×A finding, 01 §2:
   yes as traces — retrieval ranking is a consumer, not an owner.)
3. What is observable and editable? C says both; the interaction contract says only ship
   editable controls that really work — so: observe everything that exists as events,
   edit only structure the user explicitly created.
4. Can a process be *delegated* (a Coworker takes over a workflow step)? This is the
   home-interaction D2/D3 delegation question in another dress — keep one answer, not two.

## 5. Anti-goals

- Not a workflow engine (WAM owns execution).
- Not a Gantt/dashboards product (process is for coordination and reflection, not
  surveillance — Lemma's "do not harass users" and "no fake UI" rules travel here).
- Not permanent by default: trivial work stays trivial (C's overhead warning).
