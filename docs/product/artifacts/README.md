# Artifacts — product foundation

**Date:** 2026-11-12 · **Status:** product foundation in force; implementation not started (except where marked **[I]**).
**Read this first:** an Artifact is not a generated document and not a message attachment. It is a persistent, identifiable, evolvable, reusable asset that humans and agents create, maintain, and use together.

## Marking convention (inherited from `product/definition.md`)

- **[C]** — confirmed / decided. Carries the weight of a product decision; list of record in `../ui-mvp/DECISIONS.md` (D-053).
- **[P]** — proposed design direction, reviewed but not built.
- **[I]** — implemented in code today (pointer given).
- **[Q]** — open question; collected in [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md).

## The documents, in reading order

| # | Document | Answers |
| --- | --- | --- |
| 1 | [`DEFINITION.md`](DEFINITION.md) | What an Artifact is and is not; Artifact vs file vs attachment vs "knowledge object"; the terminology ruling |
| 2 | [`TAXONOMY.md`](TAXONOMY.md) | Six categories, why they are emphases rather than classes, capability facets |
| 3 | [`USER-DEFINED-OBJECTS.md`](USER-DEFINED-OBJECTS.md) | How users define Products, Companies, Concepts — the User-defined Semantic Object System |
| 4 | [`LIFECYCLE.md`](LIFECYCLE.md) | Identity / content / version / status / activity — creation to archival, with diagrams |
| 5 | [`GOVERNANCE.md`](GOVERNANCE.md) | Provenance, evidence, authority — why there is no accuracy score |
| 6 | [`CANONICAL-REUSE.md`](CANONICAL-REUSE.md) | One authoritative definition, many workspace references; pinning, notifications, proposals back |
| 7 | [`METHODOLOGY.md`](METHODOLOGY.md) | Methodology / Method Run / Result / Evaluation — a method as an executable, versioned asset |
| 8 | [`EXTERNAL-INTEGRATIONS.md`](EXTERNAL-INTEGRATIONS.md) | Notion, Obsidian; native vs externally owned assets |
| 9 | [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) | Every unresolved product and architectural decision in one list |

## The nine questions this set must answer (final-review checklist)

1. What exactly is an Artifact? → §1
2. What kinds of things can users create as Artifacts? → §2
3. How can users define new concepts and object types? → §3
4. How are Artifacts created and evolved? → §4
5. How do we preserve accuracy, provenance, and authority? → §5
6. How can Coworkers discover and reuse them across Workspaces? → §6
7. How can a Methodology be executed and improved? → §7
8. How do native Artifacts coexist with Notion and Obsidian? → §8
9. Which decisions remain unresolved? → §9

## What exists in code today **[I]** — and therefore must not be contradicted

- A chat **artifact block** (`src/pages/chat/`) can be saved as a **real note** — the only
  artifact persistence that exists.
- The notes store already versions content (`version` + `updatedAt` + conflict review) —
  the versioning precedent the artifact system generalises.
- WAM writes nothing directly: artifact ingestion goes through one Thylas surface, and
  Thylas assigns id, scope, placement, and provenance (`product/definition.md` B2,
  `architecture/application.md` §5.2 — push-first **[P]**).
- Coworkers, canonical registries, external sync: nothing exists. Docs say so.
