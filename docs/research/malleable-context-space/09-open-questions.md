# 09 — Open Questions

Classified: **Conceptual / Product / Information / Interaction / Architecture / Technical /
Cross-project**. **[founder]** = needs the founder-led brainstorm. Compatible with GSC's
09 (whose list this extends from the Thylas side).

## 1. Conceptual

1. **[founder]** Is "Malleable Context Space" a *substrate* claim (shared foundation) or a
   *design-language* claim (shared principles only)? — decides Q-F.
2. Is a Work Representation fundamentally different from a Workspace, or a kind of one?
3. D's "roles develop in use": does this mean no normative structure early, or that
   structure is only *promoted* by users?

## 2. Product

4. **[founder]** Which scenario (A GSC / B Thylas / C Lemma) gets the first malleable
   treatment? (Doing all three at once = sprawl.)
5. What is the smallest visible feature that *tests* the shared primitives? (Candidate:
   "select N items → ask Coworker → results as proposals" — Thylas can ship this today
   over its extract pipeline.)
6. Are engagement traces visible by default (Ream) or drill-down only? (Thylas default:
   drill-down, per 06 §5.)
7. **[founder]** Does Lemma's v-next take any dependency on shared infrastructure, or is
   alignment purely conceptual? (→ Q-F)

## 3. Information model

8. Edit-level attribution record shape: event fields vs entity? (→ Q-G)
9. Engagement-trace granularity and retention policy (privacy: Ream traces are
   *personal* data — PIPL/GDPR implications).
10. **[founder]** Artifact-versioning (pin + authority) vs GSC supersede chains: unify,
    map, or coexist? (Conflict C1.)
11. Where do selection provenance ("selected by gesture X") and spatial hints live —
    representation membership metadata or events? (Thylas stance: membership metadata.)

## 4. Interaction

12. Intent-class inference vs declaration (Q-G) — and the reconciliation UI.
13. How are agent *structural-reorganization proposals* rendered and accepted? (D's
    hardest gap; Thylas has the governance path, not the UI.)
14. Clarification UX: suggested options vs open question — per project or shared?
15. "Delegate with selection": frozen snapshot or live set? (home-interaction 02 §5 same
    question.)
16. E's local-targeting difficulty: selection handles? named regions? (boards' sections
    are a candidate answer.)

## 5. Questions for the other agents (cross-agent F)

**To the GSC agent:**
1. Do GSC Contexts intend to carry *selection provenance* (E) natively, or as member
   metadata only?
2. Is the `proposals` mechanism (D-042) willing to be the shared agreement-protocol
   reference implementation (Q-F2), or is it GSC-internal?
3. How does GSC see engagement traces attaching — extend `events`, or a new trace family?
4. **C2 resolution:** confirm "Context Entry / Knowledge Object" are deprecated in favor
   of GSC's actual "Context (assembly) / Structured Object" — or does GSC plan to rename?

**To the Lemma agent:**
5. Is the learner concept graph a *representation of understanding* (reorganizable work
   product) or governed information (proposals required)? — decides its reorganization
   semantics entirely.
6. Which shared primitives could Lemma adopt without threatening product independence?
7. Does the learning log need engagement-level traces or milestone-level only?
8. Is "Learn Space" (= project today) intended to stay a UI-level rename, or become a
   real container object?

**To both (and the founder):**
9. Accept C's claim that long-running collaboration *requires* first-class process
   despite overhead? (→ Q-D)
10. WAM boundary: where do process traces (C) end and WAM runtime state begin?

## 6. Architecture

11. **[founder] Q-D**: process derived / first-class / hybrid (08-D).
12. **[founder] Q-E**: persistence ladder + scratch TTL (08-E).
13. **[founder] Q-C**: spatial = view / environment / hybrid (08-C).
14. Q-A resolution: which views are saveable, and where do parameters live?
15. Where do *kept* representations live — GSC? per-app? (cross-project!)

## 7. Technical

16. Trace/event write overhead and query patterns at engagement granularity.
17. Object identity/addressing across projects (export/import mapping).
18. Permission overlay on shared representations (owner model when two projects hold
    copies).
19. Agreement-protocol state machine: idempotent, auditable transitions (candidate:
    `mutation.ts` commitIntent as reference semantics).

## Founder list (one screen)

| # | Question | Why it matters |
|---|---|---|
| 1 | Substrate vs design language (Q-F) | determines everything downstream |
| 2 | First scenario (A/B/C) | prevents sprawl |
| 3 | Lemma dependency (Q-F) | independence boundary |
| 4 | Artifact-versioning vs supersede (C1) | blocks exchange formats |
| 5 | Process first-class (Q-D) | schema-vs-events |
| 6 | Persistence ladder (Q-E) | representation storage |
| 7 | Spatial status (Q-C) | boards + Huabu roadmap |
| 8 | Accept "process required for long collaboration"? | C's central claim |
