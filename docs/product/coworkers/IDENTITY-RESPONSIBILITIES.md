# Coworker identity and responsibilities

## 1. Identity **[C] with [P] mechanics**

| Dimension | Ruling | Notes |
| --- | --- | --- |
| **Name** **[C]** | Required, unique is *not* required — display names may repeat; ids do not. | Avoid forcing @handles on users. |
| **Description** **[C]** | Required at creation, editable. One honest paragraph: what this Coworker is for. | This is the brief users read back — not a hidden prompt. |
| **Visual identity** **[P]** | Optional. A mark (colour + two letters, the house pattern) suffices for MVP; uploaded avatars deferred. | Consistent with `design/` — no arbitrary icon packs. |
| **Status** **[C]** | Three separate statuses, never merged — see [`LIFECYCLE.md`](LIFECYCLE.md): availability (active/paused/archived), runtime execution (WAM's), current-work state. | A paused Coworker has no runtime status at all. |
| **Creation / modification info** **[C]** | Created by + at; config changes are logged in the Coworker's activity. | Same attribution grammar as artifact versions. |

## 2. Responsibilities — the standing brief **[C]**

> A Coworker's **responsibilities** state what it is for, what it is not for, and what
> good output looks like. They are structured, user-authored, and visible — never a
> hidden prompt.

Proposed shape **[P]** (three blocks, plain language, editable any time):

1. **Responsible for** — the working domain and the kinds of tasks to accept.
   *"Reviews experimental protocols for completeness; drafts boundary tables from
   probes."*
2. **Not responsible for** — explicit exclusions, so delegation has honest edges.
   *"Does not run benchmarks; does not modify accepted artifacts."*
3. **What good output looks like** — the expectations results are judged against.
   *"Tables carry witnesses. Recommendations cite the probe that supports them."*

Rules:

- **[C]** Responsibilities are **product configuration**, rendered read-only to the
  user and shipped to the runtime (WAM) as part of the working brief. Thylas does not
  interpret them — it records, displays, and delivers them.
- **[C]** Identity is **not** a single system prompt. The prompt layer, if WAM uses
  one, is assembled from the brief + access + preferences at run time; users never
  write or see it.
- **[P]** Responsibilities can reference artifacts (a methodology it applies, a
  standard it enforces) — references, not copies; the artifact stays canonical
  ([`../artifacts/CANONICAL-REUSE.md`](../artifacts/CANONICAL-REUSE.md)).

## 3. Responsibilities vs Toolsets vs Methodologies — three different things **[C]**

| Concept | What it is | Who defines it | Example |
| --- | --- | --- | --- |
| **Responsibilities** | The brief: what this Coworker is for | The user, in the Coworker config | "Reviews protocols for completeness" |
| **Toolsets** | What it may *do* — the tools it can call | Granted by access configuration (workspace-level grants) | file read, board write, compute submit |
| **Methodologies** | Reusable *methods* it may apply, as artifacts | Created/maintained as artifacts; the Coworker gets Usable access | "Boundary mapping method" |

The test that keeps them apart: a **Toolset** answers "what can it *do*"; a
**Methodology** answers "how is this kind of work *done well*"; a **Responsibility**
answers "what is this Coworker *for*". A reviewer Coworker may have the file-read
toolset, apply the boundary-mapping methodology, and be responsible only for protocol
reviews — removing any one changes a different thing.

## 4. Expected outputs **[C] with [P] shape**

Responsibilities declare the **kinds** of output to expect — so results can be judged
and the working experience can render them:

- Artifacts produced or proposed (kinds: draft documents, boundary tables, reviews).
- Records kept (a run of a methodology, a review verdict with reasoning pointer).
- Answers delivered in conversation.

**[P]** Output kinds may later become structured promises ("this Coworker produces
boundary tables") that the UI can render as typed results — deferred until a real
runtime exists; the config field is free-form at MVP.

## 5. What this does not decide **[Q]**

- Whether responsibilities support structured slots (checklists, acceptance criteria)
  vs free prose at MVP — lean prose first.
- Whether a Coworker's brief can be inherited/copied into a new Coworker
  ("duplicate as starting point") — likely yes, trivially, at MVP.
- How WAM consumes the brief (assembled prompt vs structured request) — WAM contract,
  see [`WAM-BOUNDARY.md`](WAM-BOUNDARY.md) §4.
