# Coworker and Artifacts

Six verbs, kept apart. This document coordinates with `../artifacts/` — it adds the
Coworker as a **role** in the artifact model; it defines no competing artifact concepts.

## 1. The six verbs **[C]**

| Verb | What happens | What it changes | Guardrail |
| --- | --- | --- | --- |
| **Discover** | The Coworker finds artifacts it has **access** to (workspace grants + canonical references). | Nothing. | Discovery is permission-bounded — a Coworker never sees "every artifact". |
| **Reference** | The Coworker cites or links an artifact in its work (a conversation, a run, a produced draft). | Nothing. | References record the artifact's id and version — a citation, not a copy. |
| **Understand** | The Coworker reads the artifact's structure: spec fields, current version, scope, authority (the structured surface from `../artifacts/USER-DEFINED-OBJECTS.md`). | Nothing. | Understanding reads what is declared; it does not infer access or modify anything. |
| **Apply** | The Coworker **applies a Methodology**: starts a Method Run (pinned version), executes, records results in the *running workspace*. | Creates a **Run** and **Result** artifacts. The methodology is untouched. | The canonical method is never mutated by a run (`../artifacts/METHODOLOGY.md`). |
| **Create** | The Coworker produces a **new artifact** — entered via ingestion (B2): Thylas assigns id/scope/provenance; it lands as a **draft/proposal**, attributed to the Coworker. | Creates one artifact. | Authorship is recorded; agent-created drafts are proposals until accepted (`GOVERNANCE.md`). |
| **Propose** | The Coworker suggests a change to an **existing** artifact — content, structure, deprecation. | Creates a **proposal** in that artifact's lifecycle. | Never a silent overwrite; acceptance belongs to the artifact's authority (`LIFECYCLE.md`). |

## 2. The two confusions the six verbs prevent **[C]**

1. **Applying a Methodology ≠ modifying it.** A run consumes a pinned version and
   produces results; the method improves only through accepted proposals
   (`../artifacts/METHODOLOGY.md` §5). If a Coworker learns a better step mid-run, that
   observation goes into the **Evaluation** — feedback, not an edit.
2. **Producing ≠ overwriting.** A Coworker's new content lands as its own artifact or
   as a proposal. The authoritative version of a user-defined artifact is changed only
   when its authority accepts the proposal. There is no path where a Coworker's output
   silently replaces an accepted artifact.

## 3. How the verbs chain into Coworker work **[C]**

```
Discover ──▶ Understand ──▶ Reference ──▶ Apply (run) ──▶ Result artifacts
                                  │                                  │
                                  └───▶ Propose (improvement) ◀──────┘
                                             │
                                             ▼
                              authority accepts/rejects ──▶ new version
```

A realistic pass: the reviewer Coworker *discovers* the boundary model (canonical,
from Workspace A), *understands* its spec (definition, scope, authority), *references*
it in a protocol review, *applies* the boundary mapping method (run pinned to v2),
*creates* the result table in its workspace, and *proposes* one counter-example back
to the canonical concept. Five artifacts touched, zero silently modified.

## 4. What the Coworker's access config controls **[C] with [P] mechanics**

Each membership configures, per [`WORKSPACE-RELATIONSHIP.md`](WORKSPACE-RELATIONSHIP.md)
§2: which artifacts are **visible**, which are **usable** (runnable methodologies,
executable artifacts), and whether the Coworker is a **proposer** for granted
artifacts. The artifact detail page's Coworker action **[I]** (opens the chat dock with
the artifact as declared context) is the first interaction built on this — declared
context, not ambient access.

## 5. Records the Coworker leaves behind **[C]**

Every verb leaves an attributable record — the working history is auditable without
trusting anyone's memory:

| Verb | Record |
| --- | --- |
| Discover | (search/session-level; not persisted per artifact) |
| Reference | The reference in the conversation / produced draft |
| Apply | The Method Run (pinned version, inputs, timeline) |
| Create | The new artifact, `authored by` the Coworker, `applied by` the acceptor |
| Propose | The proposal in the target artifact's review |

## 6. What this does not decide **[Q]**

- Whether Coworkers can *own* canonical artifacts (be the authority) or only humans
  can — leans "humans hold authority; Coworkers maintain nothing by default", pending
  the org model.
- Whether Discover supports proactive surfacing ("the Coworker suggests a related
  artifact") — an agent capability, WAM's call; Thylas renders it if it happens.
- Cross-workspace artifact use by a Coworker whose memberships span workspaces —
  follows the same canonical-reference rules; per-membership grants stack, never
  widen.
