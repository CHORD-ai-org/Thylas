# Artifact taxonomy — six emphases, not six classes

## 1. The ruling **[C]**

The six categories (Conceptual, Methodological, Structural, Executable, Empirical,
Organizational & Product) are **emphases with characteristic behaviours**, not a
technical class hierarchy. The model is:

```
┌─────────────────────────── Artifact (one core) ───────────────────────────┐
│  identity · versions · status · provenance · authority · relations        │
├───────────────────────────────────────────────────────────────────────────┤
│  categories (tags, several allowed, user-defined ones too)                │
│  capability facets (executable · reviewable · dataset-bearing · …)        │
│  structure (none · user-defined semantic object spec — see §4)            │
└───────────────────────────────────────────────────────────────────────────┘
```

**[C]** Every artifact carries the same core. Categories are **tags** (several
allowed, plus user-defined ones). **Executable**, **reviewable**, and friends are
**capability facets** that turn behaviours on. Structure is opt-in via the
User-defined Semantic Object System ([`USER-DEFINED-OBJECTS.md`](USER-DEFINED-OBJECTS.md)).

Why not six classes — the test cases that forced the ruling:

- "An Experiment" is Empirical, *runs* a Methodological artifact, and *produces*
  Structural output. Three categories in one object; a class hierarchy cannot express
  that without multiple inheritance.
- "A UI Prototype" is Executable today and becomes Empirical evidence once tested.
- "A Company" is Organizational and contains Conceptual (principles), Structural
  (roadmap), Empirical (metrics) children.

## 2. The six categories

### 2.1 Conceptual **[C]**

- **Purpose:** pin meaning. The shared vocabulary a workspace argues and builds from.
- **Examples:** concepts, terminologies, theories, principles, standards, taxonomies,
  evaluation criteria.
- **Characteristic properties:** definition, scope of applicability, examples and
  counter-examples, authority (who may change the canonical definition), relations to
  other concepts (is-a / part-of / contrasts-with).
- **Interaction:** heavily *read-and-reference*; edits are meaningful events (a changed
  definition invalidates things built on it) — hence review-and-accept flows matter
  more than for most categories.
- **Relations:** referenced by everything. A Conceptual artifact is the most common
  **canonical, cross-workspace** artifact (see [`CANONICAL-REUSE.md`](CANONICAL-REUSE.md)).

### 2.2 Methodological **[C]**

- **Purpose:** capture *how work is done* so it can be repeated and improved.
- **Examples:** methodologies, research protocols, experimental procedures, reverse
  engineering methods, meta-reasoning frameworks, reusable workflows.
- **Characteristic properties:** this is the most structured category — purpose,
  applicability, preconditions, inputs, procedure, decision rules, expected outputs,
  constraints, failure modes, examples. Full treatment: [`METHODOLOGY.md`](METHODOLOGY.md).
- **Interaction:** discover → inspect applicability → **run** → evidence preserved.
  The original is never mutated by a run.
- **Relations:** runs produce Empirical artifacts; procedure steps reference Structural
  and Executable ones.

### 2.3 Structural **[C]**

- **Purpose:** hold the shape of systems and plans — the artifacts other work is
  organised around.
- **Examples:** roadmaps, architecture diagrams, data pipelines, specifications,
  system models, organizational structures.
- **Characteristic properties:** internal structure (nodes, stages, components);
  typically long-lived; frequently **derived from** proposals and **referenced by**
  empirical results ("this run validated step 3 of the roadmap").
- **Interaction:** collaborative editing with review; export to representations
  (image, document); timeline views across versions.
- **Relations:** the hub of the graph — most other categories point at a structural
  artifact as "the thing we are doing".

### 2.4 Executable **[C]**

- **Purpose:** ship behaviour. The artifact *does* something.
- **Examples:** encapsulated code, scripts, web applications, interactive prototypes,
  tools, reusable execution workflows.
- **Characteristic properties:** an **execution capability facet** plus a runtime
  target (see Compute: queued-not-started honesty rules travel here unchanged);
  version pinning is load-bearing — a run must record *which version* executed.
- **Interaction:** preview → run → result linkage; every execution leaves evidence.
- **Relations:** produces Empirical artifacts; often an instance of a Methodological
  workflow; lives alongside Compute's backend/instance model when it needs capacity.

### 2.5 Empirical **[C]**

- **Purpose:** hold observations about reality — the category that can disagree with
  the others and be right.
- **Examples:** experiments, observations, evidence, benchmark results, datasets,
  validation reports.
- **Characteristic properties:** provenance is the headline (measurement conditions,
  instruments, parameters); immutability preference — an observation is rarely edited,
  it is *superseded by a new observation*; links to what it supports or contradicts.
- **Interaction:** create-once-revisit-often; validation and evaluation flows; citation
  from governance (an accepted standard cites its supporting evidence).
- **Relations:** result of Method runs; evidence for Conceptual artifacts and for
  authority decisions in [`GOVERNANCE.md`](GOVERNANCE.md).

### 2.6 Organizational & Product **[C]**

- **Purpose:** model the entities work happens *about* — the containers of strategy
  and structure that other artifacts hang from.
- **Examples:** companies, products, teams, open-source projects, brands, product
  strategies, design systems.
- **Characteristic properties:** almost always **user-defined semantic objects**
  (a Product has Features, Target Users, Pricing Model, Principles, Roadmap,
  Architecture — fields the user defines, see
  [`USER-DEFINED-OBJECTS.md`](USER-DEFINED-OBJECTS.md)); long-lived; frequently
  canonical across workspaces; access permissions matter most here.
- **Interaction:** dashboard-like surfaces over the spec fields; children and relations
  listed and navigable; change history reads like an org log.
- **Relations:** parent/owner of many artifacts across categories.

## 3. Cross-category relations — the real graph **[C]**

| Relation | Direction | Example |
| --- | --- | --- |
| `produces` | Method Run → Empirical | the run's result artifact |
| `validates` / `contradicts` | Empirical → Conceptual / Structural | benchmark vs the spec's claim |
| `instantiates` | any → Methodological | running the protocol |
| `governs` | Conceptual (standard) → any | the standard a change must satisfy |
| `part-of` | any → Organizational | the roadmap of the product |
| `references` (canonical) | any workspace → canonical artifact | see [`CANONICAL-REUSE.md`](CANONICAL-REUSE.md) |

Relations are first-class (named, typed, carrying provenance) — they are how
"the user's real capital" becomes navigable. The relation vocabulary above is
seeded **[P]**; user-defined relation types arrive with the semantic object system.

## 4. What is deliberately absent **[C]**

- **No fixed per-category schemas.** Categories do not dictate fields; user-defined
  specs do, where structure is wanted.
- **No single "type enum" in the storage model.** Categories are tags; making one
  `type` field would re-create the class hierarchy the ruling rejects.
- **No "sub-artifact" vs "attachment" split.** A contained file is a representation or
  a related artifact, per [`DEFINITION.md`](DEFINITION.md) §4.
