# Artifact — definition

## 1. The definition **[C]**

> An **Artifact** is a persistent, identifiable, evolvable, and reusable asset of a
> user's intellectual, technical, organizational, or creative work — created,
> maintained, understood, and used by humans and agents, and available to future work.

Every word earns its place:

| Word | Consequence |
| --- | --- |
| **persistent** | It outlives the conversation, the session, and the tool that produced it. |
| **identifiable** | It has an identity separate from any file, message, or view of it. |
| **evolvable** | It changes through versions with attribution; old states remain inspectable. |
| **reusable** | It can be discovered, referenced, applied, and executed — by people and by agents — without being re-created. |
| **asset of work** | It carries meaning and value to the user, not merely to the system. |
| **humans and agents** | Authorship is agnostic; provenance records who and what. |

## 2. What qualifies — and what does not **[C]**

Qualifies: anything a user would want to **name, keep, find again, and hand to future
work**. A terminology someone pins. An experiment and its evidence. A product definition
a team argues from. A methodology a coworker can run. A design system.

Does **not** qualify:

| Not an Artifact | Why | Where it lives instead |
| --- | --- | --- |
| A chat message | A message is a moment in a conversation; the artifact is the thing the moment produced. | Conversation history (`chat/`) |
| A file's bytes | A file is a storage container; the artifact is the semantic object a file may represent. | Storage layer, once it exists **[P]** |
| A UI view or filter state | No identity, no evolution, no reuse beyond the session. | Client state |
| A tool's transient output that nobody kept | Produced ≠ kept. Ingestion (B2) is what makes a thing an artifact. | — |
| WAM's internal context and plans | WAM owns its working state; what WAM **delivers** becomes an artifact. | WAM |

The boundary rule from `product/definition.md` B2 stays: **WAM supplies content and a
proposed name; Thylas assigns identity, scope, placement, and provenance.** An artifact
begins its life at ingestion (or at human creation) — not inside a model.

## 3. Independent object, not attachment **[C]**

The narrow view — artifacts as outputs glued to conversations — fails in four ways, and
each failure is a product requirement:

1. **Lifetime.** A conversation ends; the roadmap does not. The artifact outlives every
   surface that shows it.
2. **Agency.** Users create artifacts without any conversation (a note, a product
   definition); agents propose artifacts inside one. Creation path is provenance, not
   identity.
3. **Reference.** "The pricing model" must be linkable from a second conversation, a
   second workspace, a run record — messages cannot be that referent.
4. **Evolution.** A pricing model is *revised*. A message is sent. Only an independent
   object can have versions, history, and authority.

## 4. Artifact vs file vs document **[C]**

- A **file** is bytes in a container. An artifact **may be represented by** files
  (a diagram export, a dataset) and may **contain** files, but is not one: renaming or
  replacing the file must not destroy the artifact's identity, and one artifact may have
  many representations.
- A **document** is one representation of one version. An artifact is the stream of
  versions plus the authority over them.
- Practical consequence: "export as PDF" and "sync to Obsidian" are operations on
  representations; the artifact's identity, history, and governance stay in Thylas.

## 5. The terminology ruling: Artifact, Asset, Knowledge Object, Executable Object **[C]**

Four candidate words, one ruling — do not introduce redundant terminology:

| Term | Ruling |
| --- | --- |
| **Artifact** | The single word for the product concept. Use it. |
| **Asset** | Colloquial synonym. Never a second class. In copy, "asset" may flavour prose; in the model, it does not exist. |
| **Knowledge Object** | Reads as a subset (conceptual assets). The concept is covered by the Conceptual category of artifacts; a separate noun would force every artifact into a knowledge frame, which is wrong for a company or a script. Rejected. |
| **Executable Object** | Not a class — a **capability facet**. Some artifacts can be executed (methodologies, scripts); "executable" is a flag a taxonomy category or user-defined type grants, like "renderable". |

The test that settled it: "a Company" is meaningfully an artifact, but calling it a
Knowledge Object is wrong, calling it an Executable Object is wrong, and duplicating it
as an Asset is noise. One noun, facets for the rest.

## 6. How humans and agents interact with artifacts **[C]**

| Act | Human | Agent |
| --- | --- | --- |
| Create | Directly (editor, import, spec instantiation) | Proposes via ingestion (B2); proposal enters the lifecycle as such — see [`GOVERNANCE.md`](GOVERNANCE.md) §3 |
| Read / reference | Browse, link, cite | Reads the artifact's structured surface (spec fields, current version) when granted access |
| Modify | Edits create versions under their authority | Edits arrive as **proposals**; they never silently replace an accepted artifact |
| Execute | Runs methodologies / executable artifacts | Same surface; runs are recorded, originals untouched (see [`METHODOLOGY.md`](METHODOLOGY.md)) |
| Govern | Maintainer authority; accepts, rejects, deprecates | None by default — authority is granted, never assumed |

Two asymmetries are deliberate:

- **Agents propose; humans (or granted processes) accept.** Agent-generated content is
  never auto-trusted into an accepted state (see [`GOVERNANCE.md`](GOVERNANCE.md) §2).
- **Authorship is recorded, never hidden.** Every version knows who or what produced it.

## 7. Relationship to long-term work **[C]**

Artifacts are how work compounds. A methodology is reused as runs; runs produce
results; results become evidence for a standard; the standard governs a product; the
product has a roadmap. Each arrow is an artifact **relation** (see
[`TAXONOMY.md`](TAXONOMY.md) §5) — the graph of artifacts is the user's real capital,
and the conversation layer is one way of touching it, not the organising principle
(`product/definition.md`: "the conversation is not kept as the primary record; the plan
and the artifacts are").

## 8. What this definition does not decide **[Q]**

- Storage technology and where artifact content physically lives (persistence is
  undecided — `../development/backend/`).
- The identity format (ids, canonical URL shape) — see
  [`CANONICAL-REUSE.md`](CANONICAL-REUSE.md) §4.
- Whether "collection"/"folder" grouping is an artifact relation or a view — deferred
  until the first UI for artifact browsing exists.
