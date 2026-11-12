# Coworkers — product foundation

**Date:** 2026-11-12 · **Status:** product model in force; no implementation exists yet — every code reference below says so.
**Read this first:** a Coworker is an independent, persistent AI work entity that users create, configure, manage, and collaborate with across Workspaces. It is not a chatbot, not a system prompt, and not a visual wrapper around a WAM agent.

## Marking convention (shared with `product/artifacts/`)

- **[C]** — confirmed / decided. Record of decision: `../ui-mvp/DECISIONS.md` (D-054).
- **[P]** — proposed design direction.
- **[I]** — implemented in code today.
- **[Q]** — open question; collected in [`SCOPE.md`](SCOPE.md).

## The documents, in reading order

| # | Document | Answers |
| --- | --- | --- |
| 1 | [`DEFINITION.md`](DEFINITION.md) | What a Coworker is and is not; why it is an independent entity |
| 2 | [`IDENTITY-RESPONSIBILITIES.md`](IDENTITY-RESPONSIBILITIES.md) | Name, description, status; what a Coworker owns — and why identity ≠ a system prompt |
| 3 | [`WORKSPACE-RELATIONSHIP.md`](WORKSPACE-RELATIONSHIP.md) | Membership, access boundaries, adding/removing, archiving |
| 4 | [`ARTIFACT-RELATIONSHIP.md`](ARTIFACT-RELATIONSHIP.md) | Discover / reference / understand / apply / create / propose — six verbs, kept apart |
| 5 | [`CONFIGURATION.md`](CONFIGURATION.md) | What users configure; MVP vs deferred settings |
| 6 | [`WORKING-EXPERIENCE.md`](WORKING-EXPERIENCE.md) | Conversation, Current Work, Resources, Artifacts, Activity |
| 7 | [`WAM-BOUNDARY.md`](WAM-BOUNDARY.md) | Thylas vs WAM responsibilities; why many Coworkers ≠ a multi-agent system |
| 8 | [`LIFECYCLE.md`](LIFECYCLE.md) | Creation → participation → pause → archive; three statuses that are not one |
| 9 | [`SCOPE.md`](SCOPE.md) | Confirmed decisions, proposals, open questions, MVP, deferred, dependencies |

## The one-paragraph model **[C]**

A Coworker is created and configured in Thylas (identity, responsibilities, access). It
participates in one or more Workspaces — membership grants what the workspace's owner
configures, never everything. At work time the Coworker connects to WAM, which runs,
plans, and executes; Thylas records what the user must see (membership, configuration,
conversations, artifacts, activity). Coworkers in the same workspace talk to each other
through WAM's A2A protocol, not through Thylas, and multiple Coworkers in one workspace
are *colleagues sharing a room*, not an orchestrated multi-agent system.

## What exists in code today **[I]** — and must not be contradicted

- The artifact detail page's **Coworker action** opens the real chat dock with the
  artifact as declared context (`src/pages/artifacts/`) — the first Coworker-flavoured
  interaction, honestly prototype-grade: it is the user talking with declared context,
  not an independent agent.
- No Coworker entity, store, or UI exists anywhere else. Every "coworker" reference in
  shipped docs is a role in the artifact model (reader, runner, proposer).
