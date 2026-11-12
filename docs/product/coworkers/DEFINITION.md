# Coworker — definition

## 1. The definition **[C]**

> A **Coworker** is an independent, persistent AI work entity that a user creates,
> configures, manages, and collaborates with across Workspaces. It has an identity,
> declared responsibilities, configured access, and a working history — and it
> survives every conversation it takes part in.

Every word earns its place:

| Word | Consequence |
| --- | --- |
| **independent** | It has its own identity and configuration, separate from any conversation or workspace. |
| **persistent** | It outlives sessions; its configuration and history are the same tomorrow. |
| **work entity** | It is defined by what it is responsible for — not by a personality prompt. |
| **across Workspaces** | It can participate in several workspaces, each relationship configured separately. |
| **collaborate with** | The human works *with* it — gives context, reviews outputs, steers — not merely chats *at* it. |

## 2. Why an independent entity — the four things that have no home otherwise **[C]**

Recurring work loses state today: the same instructions are re-typed into every
conversation, access is re-declared per chat, and nothing accumulates. A Coworker is
the home for four things that otherwise have nowhere to live:

1. **A standing brief.** What this entity is responsible for, what good output looks
   like — written once, applied every time.
2. **Standing access.** Which resources, artifacts, and tools it may use — configured,
   reviewable, revocable.
3. **A working record.** Its conversations, current work, and produced artifacts,
   gathered in one place.
4. **A reusable membership.** The same Coworker can join Workspace A this month and
   Workspace B next month without being re-created.

## 3. What a Coworker is not **[C]**

| Not this | Why | What the difference means in the product |
| --- | --- | --- |
| **A chatbot** | A chatbot is a conversation surface; a Coworker exists between conversations. | A conversation *with* a Coworker is one session of its work, not its definition. |
| **A system prompt** | A prompt is one config field, not the identity. Responsibilities, access, and history are not promptable state. | Users edit structured configuration; the prompt (if any) is an implementation detail hidden behind it. |
| **A conversation** | Conversations are time-ordered; work is goal-ordered. | Current Work is a work object, not a transcript (see [`WORKING-EXPERIENCE.md`](WORKING-EXPERIENCE.md)). |
| **A Workspace** | Workspaces own resources and people; Coworkers are participants. | A Coworker joins workspaces; it does not contain them. |
| **A WAM Agent** | WAM defines how agents run, plan, and execute — that is runtime machinery, not a product entity. | The Coworker is Thylas's product entity; its WAM connection is a runtime detail (see [`WAM-BOUNDARY.md`](WAM-BOUNDARY.md)). |

The last row is the boundary line, and it is worth restating plainly: **users manage
Coworkers; WAM runs them.** Nothing in the Coworker UI shows or edits WAM's internal
agent definitions, plans, or context.

## 4. What users accomplish with a Coworker **[C]**

The success test for the whole feature:

1. **Delegate recurring work without re-explaining it.** "Same brief, new material."
2. **Trust it with the right things only.** Access is configured and visible — a
   Coworker can touch what its membership and configuration allow, nothing more.
3. **See what it is doing and what it did.** Current Work while active; Activity and
   artifacts afterwards.
4. **Reuse its outputs.** Results land as artifacts, addressable later.
5. **Improve it over time.** Configuration and responsibilities are editable; the
   working record shows what to change.
6. **Share it across work.** The same Coworker joins another workspace under that
   workspace's rules.

## 5. What makes a Coworker persistent and reusable **[C]**

- **Identity persists** independent of conversations and memberships.
- **Configuration persists** — responsibilities, access, preferences are objects, not
  message content.
- **History persists** — conversations, current work, and artifacts accumulate and are
  attributable to the Coworker.
- **Membership is re-configurable** — joining and leaving workspaces does not reset the
  entity.

What does **not** persist, by design: runtime execution state (WAM's), in-flight
reasoning, and anything the underlying model does not carry between calls. The
Coworker's memory is what the user and the system record — not an implied continuous
mind.

## 6. What this definition does not decide **[Q]**

- Whether a Coworker has a model preference or inherits the deployment's (deferred
  with multi-model routing — see [`SCOPE.md`](SCOPE.md)).
- How Coworker identity maps onto WAM's agent identities at runtime (one-to-one?
  per-session instantiation?) — a WAM contract question, see
  [`WAM-BOUNDARY.md`](WAM-BOUNDARY.md) §4.
- Whether Coworkers can be shared between *users* (vs only between workspaces) —
  an org-model question.
