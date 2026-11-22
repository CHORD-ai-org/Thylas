# 01 — Home Interaction Vision

**Status:** [P] product direction, grounded in shipped surfaces. Principle of record:
> **The conversation is the entry point, not the entire interaction interface.**

## 1. What the Home Conversation is

**[C]** (founder decision, 2026-11-21): the Home Conversation is the **merged evolution of
the Overview intent input and the Chat system** — one surface, not two. Today the entry
behaviour is split: `/chat` + dock is a conversational transcript, and `/overview` holds a
separate one-shot input (audit §1). This document defines their combined behaviour.

The Home Conversation is Thylas's **unified interaction entry point**: the place where a
person states what they want in their own words — and where Thylas resolves that into
objects, context, operations, and surfaces.

It is **not** merely a chat interface. It is the front door of a workspace system:

| Function | Through the conversation |
| --- | --- |
| Discover | find Coworkers, Workspaces, Artifacts, resources, GSC context by naming them |
| Reference | bind objects to the current task (`@` invocation → context chips) |
| Retrieve | pull specific context (a passage, a record, a file) into the working set |
| Create | start notes, boards, processes, Artifacts — conversationally or via structured UI |
| Edit | open structured editors inline; agent and human edit the same object |
| Organize | relate, group, archive, version persistent information |
| Evolve | propose revisions to canonical Artifacts; resolve conflicts and duplicates |

Users should be able to *initiate* complex work conversationally while the **actual work is
presented through appropriate interactive surfaces** — not compressed into chat messages.

## 2. Task taxonomy: which surface each task belongs to **[P]**

| Mode | Task shape | Surface | Examples |
| --- | --- | --- | --- |
| **Conversational** | short, low-stakes, answer-shaped, reversible | chat message + answer block | "what does this note say", "summarize the thread", "which workspace has X" |
| **Structured** | multi-candidate, needs review/edit/decision | **Intelligent UI block in/next to the conversation** | artifact candidate review, profile entry approval, dedupe/conflict resolution, revision proposals |
| **Dedicated surface** | long-form, spatial, versioned, multi-object | workspace editor (notes, boards, processes, files) | writing a methodology, laying out a board, running a process, editing a document |
| **Ambient** | navigation, status, settings | shell (rail, tabs, panels, ⌘K) | open X, switch theme, check run status |

Rules:
1. Never turn an operation into a chat message when a control exists (and never render a control that only fakes the operation — interaction contract).
2. Never turn a result into a dashboard card when the user needs to decide something; if a decision is needed, show the decision, not the data dump.
3. The conversation may **embed** structured work; the structured work must remain directly editable (see 05).

## 3. Relationship to the rest of Thylas

| System | Role relative to Home Conversation |
| --- | --- |
| **Coworkers** | addressable participants (`@Coworker`) that take briefs and return work; each keeps its own identity/config (`docs/product/coworkers/DEFINITION.md`). The conversation is their working surface; it does not become them. |
| **Workspaces** | the scope/permission boundary. Every invocation, retrieval and mutation is workspace-scoped; membership gates access (session → membership → write). |
| **GSC** | the persistent, governed context layer the conversation *reads from and writes to* (discover/retrieve/create/evolve). GSC is infrastructure owned by itself; Thylas is a consumer (`docs/product/gsc/MANIFESTO.md`). |
| **Artifacts** | the persistent, versioned outputs the conversation creates and revises (see 04). Provenance and authority rules are the Artifact System's, unchanged. |
| **User Profile** | a governed, candidate-reviewed information domain the agent may read and *propose to* (see 06) — and a demonstration of the required mutation model. |
| **Resources / external sources** | evidence and inputs (files, pages, integrations) that can be bound as context and used as Artifact sources. |
| **Intelligent UI** | the presentation layer that makes agent output reviewable and editable (05). |
| **Agent ops & governance** | the permission/commit model behind every agent-side write (06). |

## 4. Product principles

1. **Entry point, not container.** The conversation starts work; work lives in real objects.
2. **Grounded, not simulated.** Every object the composer references must exist and resolve; every block must have a producer. No fake retrieval, no fake tools.
3. **Context is bound, not assumed.** Only explicitly invoked/bound information is in play — GSC's "Accessible, Not Automatically Injected".
4. **Decisions before detail.** Show the decision the user must make; hide the rest behind disclosure (see 05 §5).
5. **Persistent information is governed information.** Any write to profile/artifacts/GSC goes through intent → review → commit → history (06).
6. **Cognitive load is a feature.** The interface must let a user accomplish simple operations without learning the full system.

## 5. Out of scope for Home Interaction

- Replacing dedicated editors (notes, boards, processes stay authoritative).
- Building an agent runtime / tool execution inside Thylas (WAM boundary; `WAM-BOUNDARY.md`).
- A universal vector database or autonomous memory pool (explicitly "what GSC is not").
- Redesigning the shell, rail, or tab model beyond adding invocation entry points.

## 6. Open questions (see 09)

- **Q1 (restated after the merge decision):** does the merged Home Conversation become the
  default landing surface, and where do `/overview`'s orient functions (Continue, Needs-you,
  workspaces, recently) live afterwards? (Currently landing is `/overview`.)
- Does the conversation own a persistent "working context" that outlives a thread, or is context per-conversation?
- Which operations are invoked by `@` vs natural language (see 02 §8)?
