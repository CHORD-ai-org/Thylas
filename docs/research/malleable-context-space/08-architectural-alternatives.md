# 08 — Architectural Alternatives

No winner declared. For each major question: 2–3 plausible alternatives with advantages,
disadvantages, per-project implications, and unknowns. Compatible with the GSC agent's 08
(whose alternatives are adopted where inspected); Thylas implications are this agent's.

## Q-A — Static or dynamic views?

| | Description | + | − | GSC | Thylas | Lemma | Unknowns |
|---|---|---|---|---|---|---|---|
| A1 | System views only | simple, no storage | kills "save my arrangement" | fits current view set | boards already violate this | kills custom study views | — |
| A2 | Parameterized saved views | cheap (filters/density) | doesn't capture arrangements | cheap | saves list filters | path/quiz presets | where params live |
| A3 | Views as projections over **saved representations** | unifies with Q-E; governance-friendly | needs the kept tier first; representation sprawl | Cluster/Context fit | boards fit exactly | structures fit | promotion UX |

**[ours]** Thylas shipped reality is A1+A3 (system projections + boards as saved
representations). A2 is the missing cheap layer.

## Q-B — Static or dynamic classification?

| | Description | + | − | Unknowns |
|---|---|---|---|---|
| B1 | Fixed dimensions, free values (status quo) | anti-fragmentation | emergent roles homeless | — |
| B2 | Extensible dimensions via **proposal-gated** introduction | handles emergent roles | governance cost | who approves? |
| B3 | Fully dynamic folksonomies | maximum malleability | cross-workspace fragmentation | — |

**[ours]** B2 matches all three projects' instincts (GSC SemTag governance, Thylas
proposal protocol, Lemma's "register terms before use" rule). Evidence from D ("roles
develop in use") says *start* at B1 and let B2 unlock on demand.

## Q-C — Spatial workspace: view or environment?

| | Description | + | − | Unknowns |
|---|---|---|---|---|
| C1 | Just another view | simple (Canvas-tree precedent) | contradicts E ("shaping the space IS the work") | — |
| C2 | Full working environment (own state/ops/persistence) | matches E's three activities | persistence multiplied; infinite-canvas trap | what persists on close |
| C3 | Hybrid: view + transient ink/marks layer; arrangements persist via the 03 ladder | honest to both; degradable | two persistence layers on one surface need clear UX | ink promotion rules |

**[ours]** C3 matches Thylas boards as shipped (arrangements persist, gestures don't).

## Q-D — Process as first-class? **[founder]**

| | Description | + | − | Unknowns |
|---|---|---|---|---|
| D1 | Process-as-derived (events + computed views) | no new entities; respects C's overhead warning | Problem Space/Reflection unrepresented | — |
| D2 | Process-as-first-class entity (P/W/O/E/R) | faithful to C | new entity family + governance + UI; unvalidated longitudinally | schema shape |
| D3 | Hybrid: optional work-entries over an event substrate | pay-as-you-go | dual-truth risk | entry ownership |

**[ours]** Thylas leans D1/D3 (run views + MutationIntent are event-shaped); the genuinely
missing piece is **Reflection** — possibly as a decision-record entry type, not an entity
family. Lemma's learning loop is a domain-local process model regardless.

## Q-E — Representation persistence threshold? **[founder]**

| | Description | + | − | Unknowns |
|---|---|---|---|---|
| E1 | Everything ephemeral | zero sprawl | breaks B's intermediate reuse and E's cumulative work | — |
| E2 | Everything persistent | nothing lost | sprawl, noise, governance fatigue | — |
| E3 | **Ladder**: scratch (auto-expire) / kept (user-pinned) / canonical (governed) | fits all evidence | promotion UX must be trivial | scratch TTL; agent promotion (presumed no) |

## Q-F — CHORD ↔ Lemma sharing strategy? **[founder]**

| | Description | + | − | Unknowns |
|---|---|---|---|---|
| F1 | Concepts only (shared vocabulary + patterns) | zero coupling; fastest; respects independence | re-implementation drift; no interop | — |
| F2 | Shared specification (representation/proposal/trace schemas as published specs) | consistency without runtime coupling; future exchange | spec maintenance; premature-spec risk | spec ownership |
| F3 | Shared SDK/API (common libraries or GSC-as-service) | maximum reuse | violates "Lemma must not depend on GSC" unless chosen; operational coupling | — |

**[ours]** Evidence today supports **F1 → maybe F2**; F3 needs Q-D/E settled first. All
three agents' glossaries already implement F1 in practice.

## Q-G — Edit-level attribution mechanism (cross-cutting, from B)

| | Description | + | − | Evidence |
|---|---|---|---|---|
| G1 | Inferred (CLEO-style detection modules) | zero user burden | mis-inference has consequences (B Study 1) | — |
| G2 | Declared (user marks "this is feedback") | precise | friction | — |
| G3 | Inferred + user override | balanced | needs conflict UI | B evidence leans G3 |
