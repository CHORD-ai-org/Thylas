# Methodology as a reusable asset

## 1. The four nouns **[C]**

A Methodology is not a Markdown document. The system distinguishes four things, and the
distinction is the whole point:

```
┌─────────────────┐   run    ┌──────────────┐   produces   ┌───────────────┐
│   METHODOLOGY   │─────────▶│  METHOD RUN  │─────────────▶│    RESULT     │
│ v3 (pinned)     │          │ snapshot of  │              │ the output    │
│ reusable method │          │ inputs+steps │              │ + evidence    │
└─────────────────┘          └──────────────┘              └───────┬───────┘
       ▲                     run by coworker/agent                  │ assessed by
       │                          + target                           ▼
       │ improved via proposals                              ┌───────────────┐
       └─────────────────────────────────────────────────────│  EVALUATION   │
                                              (proposal back)│ of run+result │
                                                             └───────────────┘
```

| Noun | Ruling |
| --- | --- |
| **Methodology** **[C]** | The reusable method itself. A canonical artifact; runs never mutate it. |
| **Method Run** **[C]** | One application: records the methodology **version it pinned**, the inputs, the executor (coworker or agent), the target, and the timeline. |
| **Result** **[C]** | The output(s) of the run — typically artifacts (Empirical evidence, Structural drafts, Executable prototypes), linked back with provenance. |
| **Evaluation** **[C]** | A separate assessment of the run and its result — did the method work, where did it strain, what to change. Feedstock for improving the methodology. |

A run **never modifies the original** — improving happens through proposals into the
methodology's lifecycle, the same rule as every canonical artifact
([`CANONICAL-REUSE.md`](CANONICAL-REUSE.md) §7).

## 2. What a Methodology artifact declares **[P]**

Structured, inspectable fields — a coworker (or agent) must be able to judge
applicability *before* running:

| Field | Question it answers |
| --- | --- |
| **Purpose** | What is this method for? |
| **Applicability** | When is it the right choice — and when explicitly not? |
| **Preconditions** | What must already be true (materials, access, context)? |
| **Inputs** | What must be supplied to a run (artifacts, parameters, files)? |
| **Procedure** | The steps, in order, each with its intent. |
| **Decision rules** | Branch points: "if X, do A; else B" — the judgement calls, made explicit. |
| **Expected outputs** | What a completed run produces (kinds, not instances). |
| **Constraints** | Budgets, tool requirements, safety/authority limits. |
| **Failure modes** | How this method typically fails, and the signals of each. |
| **Examples** | Links to past runs and their evaluations. |
| **Version history** | The lifecycle of the method itself. |

The structural fields may be expressed through the User-defined Semantic Object System
(a Methodology spec) — [`USER-DEFINED-OBJECTS.md`](USER-DEFINED-OBJECTS.md) — but the
*fields* above are the product contract regardless of mechanism.

## 3. The run lifecycle **[P]**

```
DISCOVERED ──▶ APPLICABILITY CHECKED ──▶ RUNNING ──▶ COMPLETED / FAILED / STOPPED
   (search)       (preconditions,           (steps executed            │
                   inputs supplied)          against a target)         ▼
                                                    RESULT(s) recorded
                                                    EVALUATION written
```

Rules:

- **[C]** A run pins the methodology **version**. Improvements to the method never
  change what an in-flight or historical run means.
- **[C]** Execution is observable and recorded — steps, decision points taken, timings —
  but the *reasoning layer* of whoever executes belongs to the executor (WAM), not to
  the artifact record (boundary: `../development/backend/INTEGRATION.md` §3).
- **[C]** Failure is a first-class outcome. A failed run is kept, evaluated, and feeds
  the method's **Failure modes** field — the improvement loop runs on failures as much
  as successes.
- **[P]** Runs target execution capacity through the Compute model (queued-not-started
  honesty rules unchanged); pure-reasoning methods may have no compute target at all.

## 4. Who runs what — authority carries over **[C]**

- Any coworker with **Usable** access on the canonical methodology can start a run in
  their workspace (see [`CANONICAL-REUSE.md`](CANONICAL-REUSE.md) §5).
- The run's **results are artifacts of the running workspace**, owned there — not in
  the methodology's home. Provenance links back both ways.
- Proposals back to the method require **Proposer** access, same as any canonical
  artifact.

## 5. The improvement loop **[C]**

```
run + evaluation ──▶ pattern across runs ──▶ proposal ──▶ new methodology version
```

Evaluations accumulate on the methodology (as relations from runs). When several
evaluations strain the same step, the maintainer proposes a revision; the revision
becomes the new current version, old versions stay pinned by their runs, and each
version's evaluations remain attached to it. A method gets better *the way artifacts
get better* — through versioned, attributed, reviewable change — not by drifting.

## 6. What this does not attempt **[Q]**

- Automatic execution of procedures by the platform (execution belongs to agents/tools;
  Thylas records and renders).
- A process engine enforcing steps in order — the procedure is inspectable guidance,
  and a run's deviations are themselves data.
- Cross-methodology composition (pipelines of methods) — named as future work in
  [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md).
