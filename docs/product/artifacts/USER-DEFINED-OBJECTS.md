# User-defined objects — the Semantic Object System (investigation)

## 1. The requirement **[C]**

Users must eventually create and structure their **own kinds of things** — a Product
with Features and Pricing, a Company with Teams, a Concept with a definition and
counter-examples, a Methodology with preconditions. Two failure modes frame the design:

- **Fixed schemas per category** — the platform guesses the user's ontology ("every
  Product has these 7 fields"). Fails the moment a domain expert's model differs.
- **Pure free-form documents** — maximum flexibility, zero structure. Coworkers and
  agents cannot "read the Product according to its defined structure" because there is
  none.

The requirement is the middle path, and it must be built from primitives the user
controls. Working name: **User-defined Semantic Object System (USOS)**. Status: **[P]**
— designed here, not committed to an implementation.

## 2. The core idea **[P]**

> **A spec is an artifact.** A user defines an object kind — "Product", "Evaluation
> Criteria", "Company" — by creating an **Object Spec** artifact: named fields, typed
> values, relations to other artifacts, optional constraints. Other artifacts then
> **instantiate** that spec. Specs are versioned, governed, and reusable exactly like
> every other artifact — the system is self-describing.

Consequences that fall out immediately:

- A coworker opening "Product X" in another workspace can read *the spec* and therefore
  understands the object's structure — this is what makes cross-workspace reuse
  meaningful (see [`CANONICAL-REUSE.md`](CANONICAL-REUSE.md)).
- Agents read the same spec and know what fields mean and which are empty — structured
  export is a render of the spec, not a guess.
- New domains need no platform release: the user writes a spec.
- The spec itself has versions, provenance, and authority — changing a spec is governed
  like any content change.

## 3. The spec model — the proposed primitives **[P]**

An Object Spec declares:

| Primitive | Meaning | Example ("Product") |
| --- | --- | --- |
| **Field** | named, typed slot | `Pricing Model` (text), `Launched` (date) |
| **Field types** (seeded) | text · rich text · number · enum · date · boolean · **artifact reference** · table-of-fields | `Target Users` (table) |
| **Relation** | typed edge to other artifacts, with cardinality | `Roadmap` → one Structural artifact; `Competes With` → many |
| **Constraint** | validation the system can enforce | `Pricing Model` required before status `Accepted`; enum values closed |
| **Presentation hint** | how instances render | sections, ordering |

Seeded field types stay deliberately small. Complexity belongs in **relations to other
artifacts** (a Product's "Technical Architecture" is a *reference* to a Structural
artifact, not a free-text blob), because references carry their own identity, versions,
and governance.

### The worked example from the brief **[P]**

A user creates the **Product** spec, then instantiates "Thylas" against it:

```
Product (spec)
├─ Features            table-of-fields   (user-filled)
├─ Target Users        table
├─ Pricing Model       text              (required for acceptance)
├─ Product Principles  → Conceptual artifacts (relations)
├─ Roadmap             → one Structural artifact
└─ Technical Architecture → one Structural artifact
```

"Coworkers in other Workspaces understand and use this Product according to its
defined structure" — mechanically: they open the instance, the spec comes with it
(canonical reference), every field renders, every relation is navigable.

## 4. Versioning and evolution of specs **[P]**

- Specs version like all artifacts. An **instance pins the spec version it was filled
  under**; a spec's new version does not silently reshape existing instances.
- Evolution rules (the only ones proposed):
  1. Adding an optional field — instances keep rendering; the field shows empty.
  2. Adding a required field — existing instances surface a "spec moved ahead" state,
     not an error; the maintainer fills or the instance stays on the old version.
  3. Removing/renaming a field — old instances keep their data under the old version;
     the system never deletes user content on a spec change.
- This mirrors the envelope rule the codebase already follows — malformed/incomplete
  payloads lose nothing (`development/backend/ENGINEERING-STANDARDS.md` §2).

## 5. What the semantic object system is **not** **[C]**

- **Not a database schema editor.** Constraints are light (required, enum-closed);
  there are no joins, no migrations, no query language.
- **Not WAM's ontology.** WAM may *read* specs and instances; the semantic layer here
  serves human structure and shared vocabulary, not the agent's reasoning (boundary:
  `../development/backend/INTEGRATION.md` §3).
- **Not mandatory.** An artifact without a spec is a first-class citizen — most
  Methodological and Empirical artifacts start as plain structured content.

## 6. Open questions feeding [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) **[Q]**

1. Where do specs live — workspace-local, canonical cross-workspace, or both?
2. Strictness of constraint enforcement at write time vs render time.
3. The UI for authoring specs (form builder? document-first with structure detection?).
4. How agents receive spec structure (structured export format — JSON? rendering?).
5. Whether relations between instances of user-defined types need their own graph
   store or ride on artifact relations.
6. Search and discovery across instances of a spec ("all Products with Pricing Model
   X") — query surface, not storage, is the hard part.
