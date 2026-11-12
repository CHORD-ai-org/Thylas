# Accuracy, provenance, and governance

## 1. The principle **[C]**

> **No universal accuracy score.** Reliability is *declared, evidenced, and governed*
> along separate dimensions — visible to every reader, never collapsed into one number.

A single score would hide exactly what a knowledge tool must show: *why* should I
trust this, *who* stands behind it, *where* it applies, and *how old* it is. Two
artifacts with the same "score" can differ in every dimension that matters.

## 2. Content classes and their default trust posture **[C]**

Every artifact declares which class of content it carries — multiple, labelled:

| Class | Default posture | Required signals |
| --- | --- | --- |
| **User-defined knowledge** | Authoritative for its scope *because the user says so* | Author (human), definition, scope |
| **Agent-generated proposal** | **Not accepted** until a human or granted process accepts it | Author (agent + run link), reasoning pointer, review state |
| **External information** | As reliable as its source; source is cited, never inferred | Origin reference, fetch/import date |
| **Empirically validated** | Strong *within its measured scope* | Method run link, parameters, raw evidence |
| **Accepted organizational standard** | Binding inside its authority's scope | Maintainer acceptance, version, evidence links |

Rules that follow:

- **[C]** Agent-generated content is never silently trusted into an accepted state. It
  enters the lifecycle as a proposal (chat answers are proposals; ingestion via B2 is a
  proposal) and is accepted by a human or an explicitly granted process.
- **[C]** Empirical claims must trace to a method run or an import source — "validated"
  is earned by a link, not asserted by an adjective.
- **[P]** Class labels are metadata, not a hiding place: an artifact mixing classes
  (a standard quoting external data) labels each labelled part.

## 3. The seven dimensions **[P]**

Each dimension is structured metadata + a visible state. None is a score.

| Dimension | Question it answers | Where it comes from |
| --- | --- | --- |
| **Provenance** | Where did the information originate? | Origin records: the run, the import, the source conversation — captured at creation (B2 ingestion makes it mandatory) |
| **Authorship** | Who created or modified it? | Version attribution: `authored by X · applied by Y · under authority Z` |
| **Evidence** | What supports its claims? | Relations to Empirical artifacts (`validates` / `contradicts`) |
| **Validation** | Has it been tested or reviewed? | Lifecycle status + review records: who accepted, against what |
| **Scope** | Under which conditions does it apply? | Declared scope field (free or spec-driven); scope violations are the reader's judgement aided by the declaration |
| **Currency** | Is it still current? | Last-reviewed date + optional review cadence; overdue review is a visible state, not an error |
| **Authority** | Who may change the canonical definition? | Maintainers of the canonical artifact (see [`CANONICAL-REUSE.md`](CANONICAL-REUSE.md)) |

## 4. What the reader sees **[P]**

The governing surface of an artifact shows, without digging:

```
── Product Principles ───────────────────────────── [ACCEPTED]
   authority: ceaser (maintainer) · accepted 11-10 · v4
   evidence: 2 linked results · last reviewed 11-10 (cadence: monthly ✓)
   scope: Thylas v1 product decisions
   ⚠ 1 section authored by agent, accepted by ceaser
```

vs a draft:

```
── Market hypotheses ────────────────────────────── [DRAFT · agent proposal]
   authored by WAM run #42 · NOT accepted · review requested
   provenance: 3 external sources (fetched 11-09) · no evidence links yet
```

The design goal: **uncertainty and limitation are visible at a glance**, and nothing in
the UI whispers "verified" about something that was not.

## 5. Governance model **[C] with [P] mechanics**

1. **Authority is granted, never assumed.** The canonical artifact's maintainers decide
   who may edit, who may accept agent proposals, and whether review is required before
   acceptance. Agents hold no authority by default **[C]**.
2. **Review is optional per artifact, explicit when on.** A maintainer marks an
   artifact (or a spec's instances) as review-gated; acceptance then requires a review
   record **[P]**.
3. **Evidence-backed acceptance.** Where stakes justify it, an acceptance cites the
   Empirical artifacts that support it — closing the loop with
   [`TAXONOMY.md`](TAXONOMY.md) §2.5.
4. **Disagreement is data.** A contradicted claim (new evidence against an accepted
   artifact) surfaces as a governance signal to the maintainers — it does not
   auto-change the artifact.
5. **Deprecation is part of governance.** "Still current?" is answerable only if
   deprecation is visible; see [`LIFECYCLE.md`](LIFECYCLE.md) §5.

## 6. What this does not attempt **[Q]**

- Computing truth from content (no LLM-as-judge score, no "confidence percentage").
- Reputation systems across workspaces.
- Automatic evidence verification — an evidence link asserts the relationship; the
  reader follows it.
