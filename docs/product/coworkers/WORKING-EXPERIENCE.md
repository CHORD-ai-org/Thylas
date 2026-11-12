# Coworker working experience

The working experience is where a user **collaborates with** a Coworker rather than
configures it. Five surfaces, one entity — the config page and this page are two views
of the same record.

## 1. The five surfaces **[C]**

| Surface | What it shows | The line it must not cross |
| --- | --- | --- |
| **Conversation** | Time-ordered discussion with the Coworker. | It is one input channel — not the organizing principle of the Coworker (`product/definition.md`: the artifact is). |
| **Current Work** | Meaningful work objectives and their progress. | Not a chat transcript, not an auto-generated TODO dump. |
| **Resources** | What this Coworker can reach here: granted resources, pinned artifacts, memberships. | Declared access, rendered read-only — no ambient trust. |
| **Artifacts** | What it produced or proposed, across workspaces, attributed. | Proposals are labelled as proposals until accepted. |
| **Activity** | The record: config changes, memberships, runs, version events. | Never rewritten; attribution permanent. |

## 2. Conversation **[C] with [I] entry**

- **[I]** The first conversation entry exists today: an artifact detail's **Coworker
  action** opens the real chat dock with the artifact declared as context. It is the
  user talking with declared context — an honest prototype of Coworker conversation,
  not an independent agent.
- **[P]** Full Coworker conversations attach to the Coworker (and to a workspace
  membership), so the transcript is attributable and continuous. Until a runtime
  exists, conversations are user-driven; nothing claims the Coworker is "thinking".

## 3. Current Work — the hard design problem **[C] with [P] shape**

> **Current Work represents meaningful work objectives and their progress.** It is not
> a transcript, not a TODO list, and not a fake activity feed.

What qualifies as a Current Work item **[C]**:

- An **objective someone stated** (a user gave the Coworker a task) or a **run the
  Coworker started** under its responsibilities.
- It has **observable state** — in progress / waiting (needs input or approval) /
  done / failed — fed by real signals: conversation milestones, method runs, artifact
  proposals.
- It **ends in artifacts**: each item links the results it produced.

What disqualifies as Current Work **[C]**:

- Every chat message as a "task" (chat is a channel, not a goal).
- Speculative plans the Coworker never committed to.
- Recreated busywork so the panel looks alive — the product does not ship fake
  activity.

**[P]** Shape of an item: `{ objective (user's words), status, linked artifacts, linked
runs/conversations, started/updated }`. The status vocabulary stays aligned with
Processes: running / waiting / done / failed — WAM feeds what it can; Thylas renders
what it receives and says so when it cannot (no invented telemetry).

## 4. Resources and Artifacts **[C]**

- **Resources** renders the membership's declared grants — the same three categories
  the config page edits (resources / artifacts / toolsets), read here. The reader can
  always answer "what is this Coworker allowed to touch?".
- **Artifacts** lists what the Coworker created or proposed, with status chips
  (draft/proposal/accepted) and links. It reuses the artifact library's row grammar —
  one list grammar across the product.

## 5. Activity and History **[C]**

- The activity log is the attribution backbone: config changes ("responsibilities
  updated"), membership events ("added to Workspace B"), runs ("applied Boundary
  mapping method v2"), artifact events ("proposed a change to Noise Floor").
- Sorted newest-first, filterable by kind, never rewritten — the same log grammar as
  Compute and Connect.

## 6. Entering the experience **[C] with [P] routes**

- **From the Coworker**: a Coworker's own page (conversation + current work + history)
  is the eventual home **[P]**.
- **From the workspace**: the workspace lists its Coworker participants; opening one
  shows that membership's view (role, grants, work in *this* workspace) **[P]**.
- **From an artifact**: the detail page's Coworker action **[I]** — opens the chat dock
  with the artifact as context.
- No separate navigation system for Coworkers inside workspaces; they are participants
  rendered where work happens.

## 7. The WAM line inside the experience **[C]**

Every surface above is **Thylas's product record** (what was configured, said,
produced, accepted). Runtime truth — what WAM is *right now* planning, which agent
instance is executing — belongs to WAM and is rendered only as far as WAM reports it
(`product/definition.md` items 9–13: subscribe, cache for display, render controls only
if WAM exposes them). The experience never invents a runtime status to fill a panel.

## 8. What this does not decide **[Q]**

- Whether Current Work items are WAM-sourced objects mirrored in Thylas, or
  Thylas-native records fed by conversation milestones — depends on the WAM contract.
- Whether a Coworker can hold multiple concurrent work items — leans yes; needs a
  real runtime to judge.
- Coworker-to-Coworker conversation rendering (an A2A transcript view) — named, not
  designed; the protocol is WAM's.
