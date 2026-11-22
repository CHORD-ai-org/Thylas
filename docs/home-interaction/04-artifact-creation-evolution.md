# 04 — Artifact Creation & Evolution

**Status:** [P] workflow spec. Preserves the Artifact System's provenance / authority /
versioning / user-governance rules (`docs/product/artifacts/{GOVERNANCE,LIFECYCLE,CANONICAL-REUSE}.md`).
**Reference implementation already in-tree**: the profile candidate pipeline
(`server/profile/{fetch,extract,store}.ts` + `ProfileInit.tsx`) — candidate → evidence →
review → idempotent commit → append-only history. Artifact evolution is that pattern,
generalized and typed.

## 1. Design case

> "Extract some Artifacts from my diary last month and my conversation files with Elarie."

## 2. Terminology (six distinct things)

| Term | Definition | Not to be confused with |
| --- | --- | --- |
| **Source** | an input object consulted (a diary note, a conversation transcript, a file, a page). Carries origin + date. | evidence; a source can yield zero evidence |
| **Evidence** | a specific span/record *from* a source that supports a candidate claim. Always citable back to its span. | source; evidence is a pointer into a source |
| **Artifact Candidate** | a *proposed* artifact-shaped thing extracted or authored before acceptance. Owns evidence + confidence + status (`pending/accepted/rejected/edited`) | canonical artifact |
| **Canonical Artifact** | the single authoritative artifact after acceptance; has identity, authority, versions | candidate; exactly one per identity (`CANONICAL-REUSE.md`) |
| **Revision Proposal** | a proposed change to an existing canonical artifact (diff-shaped, carries provenance, requires authority review) | candidate (which is net-new) |
| **Artifact Application** | the act of applying a revision/decision: the commit step that creates a new version and writes history | execution of a Methodology (different domain, `METHODOLOGY.md`) |

## 3. The nine-step workflow

| # | Step | Behavior | UI (see 05) | Governance |
| --- | --- | --- | --- | --- |
| 1 | **Source Discovery** | list candidate sources in scope: notes, conversations, files, pages (by date/name filter, e.g. "last month", "with Elarie") | source picker with counts | read permission only |
| 2 | **Source Selection** | user selects which sources to mine | multi-select list | nothing written |
| 3 | **Candidate Detection** | agent extracts artifact-shaped candidates (LLM extraction over source text, with evidence spans) — like `profile/extract.ts` but typed per artifact category | candidate list (collapsed) | **extraction ≠ creation**; nothing canonical |
| 4 | **Evidence Collection** | each candidate shows its evidence spans with source pointers | evidence-on-demand expand | evidence must be findable in source (extract.ts:120 rule) |
| 5 | **Candidate Composition** | user groups/merges/splits candidates; sets target type & name | structured editor | user is author of the composition |
| 6 | **Human Review** | accept / reject / edit each candidate (profile's review states) | candidate review block | user decision recorded |
| 7 | **Editing & Refinement** | direct edit of content/structure before acceptance | structured editor per type | edits tracked (`edited` state, `editedContent` precedent `lib/profile.ts:58-77`) |
| 8 | **Acceptance & Persistence** | commit accepted candidates → canonical artifacts, with provenance and initial version | commit action | **commit authority required**; idempotent by content key; never silently overwrite |
| 9 | **Versioning & Future Evolution** | later sources produce **Revision Proposals** against canonical artifacts | revision/diff block | authority reviews; version history append-only |

Hard rule **[C]**: an agent must NOT automatically turn every detected concept into a
canonical artifact. Detection ends at *candidates*. Canonicalization is a human commit.

## 4. Type-dependent implications (six categories, `TAXONOMY.md`)

| Category (examples) | Candidate shape | Review interface | Special rules |
| --- | --- | --- | --- |
| **Conceptual** (concepts, theories, principles) | definition + evidence + open questions | text + relation check (dedupe against existing concepts!) | dedupe/duplicate resolution is mandatory before commit (08 §7) |
| **Methodological** (protocols, methodologies) | steps + inputs/outputs + preconditions | structured steps editor | commit does not mean executable; "Methodology definition ≠ Methodology execution" |
| **Structural** (roadmaps, specs, models) | sections/outline + references | outline editor | may contain children; part-of relations |
| **Executable** (code, prototypes, tools) | asset + runtime target | file/code view | execution capability is a facet; no execution implied by commit |
| **Empirical** (results, measurements) | claims + numbers + raw evidence | table + evidence links | must link a method run when one exists; no accuracy score (`GOVERNANCE.md`) |
| **Organizational & Product** (companies, products) | entity + facts | attribute editor | contains other-category children |

One shared review skeleton (candidate → evidence → decision) with per-type editors.

## 5. Data/contract sketch (no new DB schema here)

```
POST /api/artifacts/candidates   { scope, sourceRefs[], type }        → candidate set (extraction runs)
GET  /api/artifacts/candidates?session=…                             → candidates w/ evidence + status
PATCH /api/artifacts/candidates/:id { status|content patch }          → reviewed candidate
POST /api/artifacts/commit       { candidateIds[], expectedVersions? }→ canonical artifacts (idempotent)
POST /api/artifacts/revisions    { targetId, proposal }               → revision proposal
POST /api/artifacts/revisions/:id/apply { expectedVersion }           → new version (authority required)
```
Reuse: `ArtifactRelation`, `ExternalSource`, `Artifact.versions` already declared in
`src/data/artifacts.ts:22-54`; `Source` (`uploaded|imported|produced`, `types.ts:33-36`)
extends to conversation/notes provenance.

## 6. What exists / what is missing

| Step | Today | Gap |
| --- | --- | --- |
| 1–2 Source selection | files/notes/conversations exist client-side; profile `/sources` registers URLs | conversation/note corpus mining not implemented |
| 3 Detection | profile `extract.ts` extracts *profile* entries from web pages | extraction over local notes/transcripts; artifact-typed candidates |
| 4–7 Review UI | `ProfileInit` candidate card (accept/reject/edit) | per-type structured editors, evidence span viewer |
| 8 Commit | profile commit (idempotent, history) | artifacts persistence server-side (schema comment says Phase 4) |
| 9 Revisions | artifact `versions` list only | diff UI, revision proposals, apply flow |

## 7. Boundaries

- No automatic canonicalization, no accuracy scoring, no authority for agents (all [C] in Artifact docs).
- Extraction is a *service call*, not a background daemon; results are reviewable state, not notifications spam.
- Until an artifacts table exists, prototype data must be labelled as such (interaction contract: no fake persistence).
