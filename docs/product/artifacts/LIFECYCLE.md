# Lifecycle and versioning

## 1. The five things that must not be confused **[C]**

| Concept | Definition | Changes how |
| --- | --- | --- |
| **Identity** | The artifact itself — the thing the id names. Immutable across everything below. | Never |
| **Content** | What the artifact *says*, as a sequence of versions. | By creating a new version |
| **Version** | One frozen, attributed state of the content. Append-only. | By adding the next version |
| **Status** | Where the artifact stands in its lifecycle (draft, accepted, deprecated…). | By a **status transition** — no content change required |
| **Activity** | The log of everything that happened (status changes, edits, runs, relations). | Continuously, never rewritten |

Plus two attributes that live with identity: **ownership** (which workspace holds the
canonical artifact, who the maintainers are) and **authorship** (who or what produced
each version — human, agent, or import; recorded, never hidden).

## 2. The lifecycle **[C]**

```
            create                propose                accept
   (any author) ──▶ DRAFT ────────▶ IN REVIEW ────────▶ ACCEPTED
                        │                 │                  │
                        │  (reject with   │                  ├──▶ edited ──▶ new version,
                        │   reasons)      │                  │    still ACCEPTED
                        ▼                 ▼                  ▼
                     DISCARDED       changes requested     DEPRECATED ──▶ ARCHIVED
                                     (back to DRAFT)      (still readable,
                                                           excluded from reuse)
```

Rules:

- **[C]** A **status change never creates a content version.** Moving `accepted →
  deprecated` writes an activity entry, not a version.
- **[C]** A **meaningful content modification always creates a version** — within a
  version's authoring window (a draft being written) the content may move freely; once
  a version exists, it is frozen.
- **[C]** Lifecycle applies per **canonical artifact**. References, runs, and derived
  objects have their own smaller lifecycles (see
  [`CANONICAL-REUSE.md`](CANONICAL-REUSE.md), [`METHODOLOGY.md`](METHODOLOGY.md)).

Statuses **[P]** (names proposed; the states themselves are the decision):

| Status | Meaning |
| --- | --- |
| DRAFT | Being written. Not discoverable outside the workspace by default. |
| IN REVIEW | A proposal is being evaluated (agent proposal or human change). |
| ACCEPTED | The canonical content people may build on. Governance metadata says who accepted it. |
| DEPRECATED | Superseded or obsolete. Reads fine, links resolve, excluded from "reuse this" flows, and points to its successor if one exists. |
| ARCHIVED | Out of active view. Still addressable by id. |

## 3. Versioning rules **[C] with [P] mechanics**

1. **Append-only.** Version N is never edited after creation — including by agents,
   including by maintainers.
2. **Attribution per version.** Every version records author (user, agent + run, or
   import source), timestamp, and a change message. This is the provenance backbone
   [`GOVERNANCE.md`](GOVERNANCE.md) builds on.
3. **What counts as "meaningful"** (new version vs continued drafting) **[P]**: a
   version boundary is created by *saving as a named state* (the notes store's idle-
   save + conflict model is the precedent **[I]**), by *a proposal being applied*, or
   by *a status transition that requires content* (accept). Typo-fix vs rewrite is the
   author's judgement; the system's job is to make every boundary explicit.
4. **Comparison.** Any two versions can be diffed **[P]** — the chat/notes conflict
   review is the interaction pattern to generalise.
5. **Rollback = forward.** "Restore version N" creates version N+1 with N's content
   and an activity note. History is never rewritten.

## 4. Collaboration and concurrency **[C] with [P] mechanics**

- Humans and agents may touch the same artifact. The rule from the notes editor
  carries over: **last-writer-wins is never silent** — a stale writer gets a conflict
  review with both sides shown, and resolving produces the next version.
- Agent **proposals** are a first-class concurrent writer: a proposal carries
  suggested content, its provenance, and its reasoning pointer; accepting it applies it
  as a new version attributed to the agent, *accepted by* the human (see
  [`GOVERNANCE.md`](GOVERNANCE.md) §3).
- Attribution grammar on every version **[P]**: `authored by X · applied by Y · under
  artifact authority Z`. The three roles are distinct on purpose: an agent may author,
  a human accepts, a workspace's maintainers hold authority.

## 5. Deprecation and archival **[C]**

- **Deprecation is information, not deletion.** A deprecated artifact keeps resolving,
  keeps its references, and is excluded from discovery/reuse defaults while remaining
  reachable from history ("this run used version 3, deprecated since…").
- **Archival** is a view change only. Nothing in the model deletes user content.
- Deletion of the artifact itself **[Q]** — see [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md)
  §identity.

## 6. Implementation note **[I] → [P]**

The notes store already implements the hard part of this contract at small scale:
append-only version field, conflict review, idle-save boundaries. The artifact system
generalises that shape — it does not invent a new one.
