# THINKING.md — Active Task

> Last updated: 2026-11-14
> Source: user task brief — "Thylas Coworker — Product Vision & Initial Design Specification"
> Status: TASK SAVED. Design/spec work NOT yet started. Execution deferred pending user go-ahead.

## Why this file
- Standing instruction: read root `THINKING.md` before every answer.
- Task Phase 0 lists `thinking.md` as a project instruction file to read.
- This round the user said "把今天的任务存下来" (save today's task) → stored here.

## Deliverables checklist (from task)
1. Coworker Vision
2. Coworker Domain Model
3. Coworker Creation UX Specification
4. Mind Framework & Methodology Specification
5. Collaboration Model (A2A / A2H / H2A)
6. Minimal Collaboration Scenario
7. Local Simulation & Cloud Compatibility Notes
8. Implementation Roadmap

## Per-decision labelling required
For every decision, label as one of:
- **Confirmed direction**
- **Proposed design**
- **Open question**
- **Deferred capability**
Do NOT silently convert proposals into finalized architecture.

## Hard constraints (from task)
- Inspect the actual codebase before proposing. Do not invent existing functionality.
- Do not duplicate Phase 1 backend capabilities.
- No WAM integration. Do not implement WAM internals inside Thylas.
- Do not rewrite existing backend/frontend architecture.
- No decorative multi-agent UI with no functional backend behavior.
- Distinguish: configuration text ≠ executable behavior; A2A message passing ≠ collaboration;
  Methodology definition ≠ Methodology execution; shared context ≠ unrestricted data access.
- Multi-agent must be FUNCTIONAL (shared context, delegation, artifact exchange, critique,
  handoff, human intervention, traceability). Avoid decorative multi-agent.
- Keep product experience and runtime architecture distinct. Prefer minimal composable mechanisms.

## Already-known context (from prior sessions, not re-verified this round)
- `docs/development/coworkers/` already has `PLAN.md` (2026-11-12, audit + IA) and `IMPLEMENTATION.md`.
- `docs/development/coworkers/AVATAR-VISUAL-SYSTEM.md` (2026-11-14): Coworker avatar visual system — gold-on-black minimalist silhouette, fixed/customizable elements, generation skill (`thylas-coworker-avatar`), prompt anchors + validation. Pairs with Identity/visual-identity dimension (B) of the creation experience.
- No Coworker code exists yet; only artifact-detail → chat dock interaction is shipped.
- Reusable: Artifact page trio, ChatCore, `useWorkspaces`, artifacts store.
- WAM not connected; no runtime status; conversation is the only live surface.

---
# Task Brief (verbatim)

# Task: Thylas Coworker — Product Vision & Initial Design Specification

You are working on the Thylas application within the CHORD project.

This task has two parts:

- **Part I — Product Vision:** Establish the long-term vision, principles, and conceptual architecture of Coworkers.
- **Part II — Current Task:** Audit the existing implementation, document the Coworker creation experience, and design a minimal but functional collaboration model.

Do not immediately start implementing a large feature. First understand the existing project and produce a coherent design specification.

---

# PART I — PRODUCT VISION

## 1. What Is a Coworker?

Thylas Coworker should not be treated as a conventional chatbot, a named AI assistant, or a thin wrapper around a system prompt.

A Coworker is a persistent, specialized, configurable AI working partner that can participate in a user's work across authorized Workspaces.

A Coworker should have:

- An independent identity.
- Explicit responsibilities and boundaries.
- Its own Mind Framework.
- Its own Methodologies.
- Access to authorized Workspaces, Artifacts, resources, and Toolsets.
- A persistent working history.
- The ability to collaborate with humans and other Coworkers through explicit interaction mechanisms.

The central product idea:

**Users should be able to create, shape, work with, and progressively develop AI collaborators that have distinct ways of thinking and working.**

## 2. Coworker Creation as Commissioning

Creating a Coworker should feel like establishing a new working relationship, not filling out a configuration form.

The creation experience should balance:

- Emotional satisfaction.
- A sense of occasion.
- User agency.
- Practical simplicity.
- Functional depth.

The user should feel that they are creating a capable collaborator with a distinct identity and working philosophy.

The proposed creation dimensions are:

### A. Intention

What kind of collaborator does the user want?

Users should be able to describe their intentions in natural language or start from a blank configuration.

Examples:
- A technical researcher.
- A critical thinking partner.
- A product strategist.
- An experimental scientist.
- A software architect.

The system may transform the user's description into a structured Coworker Blueprint.

### B. Identity

- Name
- Description
- Role
- Domain
- Optional visual identity

Identity should express the Coworker's working identity, not merely its appearance.

### C. Responsibilities

- What it is responsible for.
- What it is not responsible for.
- Its working scope.
- Expected deliverables.
- Its relationship with the user.

Responsibilities must remain distinct from capabilities and methodologies.

### D. Mind Framework

Each Coworker should have an individual Mind Framework.

A Mind Framework should describe and, where applicable, operationalize how a Coworker:

- Understands and decomposes tasks.
- Organizes its working context.
- Reasons about problems.
- Handles uncertainty.
- Evaluates evidence.
- Makes decisions.
- Selects methodologies.
- Requests assistance.
- Interacts with humans and other Coworkers.

Do not reduce Mind Framework to an unstructured System Prompt.

Its exact internal structure is still an open design question. Investigate and propose a practical model rather than assuming that every listed dimension must become an independent configuration field.

### E. Methodologies

Methodologies describe how a Coworker performs specific categories of work.

Examples:
- Literature Review.
- Black-box Analysis.
- Reverse Engineering.
- Experimental Design.
- Hypothesis Testing.
- Architecture Evaluation.

A Methodology should be more than descriptive text. It should be executable or operationalizable.

Distinguish:

- Methodology: reusable method definition.
- Method Run: one concrete execution.
- Result: output of that execution.
- Evaluation: assessment of the method's application and result.

A Coworker should be able to select, execute, and report on relevant methodologies.

### F. Tools and Environment

Users should be able to configure:

- Authorized Workspaces.
- Artifact access.
- Resource access.
- Available Toolsets.
- Tool permissions.
- Model or compute preferences where supported.

Do not assume that Workspace membership automatically grants access to every resource.

### G. Collaboration

Coworkers should be designed for real collaboration rather than merely appearing as multiple independent chat interfaces.

Explore three interaction directions:

- A2A: Agent to Agent.
- A2H: Agent to Human.
- H2A: Human to Agent.

These should support meaningful communication, task delegation, information exchange, critique, negotiation, handoff, and human intervention.

Do not assume that every Coworker needs to be part of a fixed team.

## 3. Multi-Agent Must Be Functional

This is a critical product and technical requirement.

Avoid decorative Multi-Agent implementations where multiple agents simply generate separate responses and a coordinator combines them.

A meaningful collaboration system should support:

1. Shared Context — agents understand relevant shared task context.
2. Task Delegation — agents can assign and receive work with explicit responsibilities.
3. Artifact Exchange — agents exchange structured, addressable outputs rather than only free-form messages.
4. Negotiation and Critique — agents can question assumptions, challenge findings, and respond to objections.
5. Handoff — work can be transferred with context, status, and expected next actions.
6. Human Intervention — users can inspect, redirect, approve, reject, and participate in ongoing collaboration.

A2A should represent work coordination, not merely message passing.

A collaboration should be traceable:

- Who initiated an action?
- Who received it?
- What was requested?
- What context was supplied?
- What output was expected?
- What was actually produced?
- Was the result accepted?
- What happened next?

The system must not pretend that agents collaborated when they merely generated independent text.

## 4. Progressive Evolution

A Coworker should not need to be fully configured at creation time.

It should be possible to:

- Add or modify Methodologies.
- Update its Mind Framework.
- Expand its responsibilities.
- Adjust permissions.
- Add Toolsets.
- Learn from reviewed working experiences.
- Develop new collaboration relationships.

Important configuration changes should be versioned and governed by explicit user permissions.

Do not introduce uncontrolled autonomous self-modification.

## 5. Relationship with Artifact System

Coworkers and Artifacts are closely connected but must remain separate domain concepts.

Coworkers can:

- Discover Artifacts.
- Understand their definitions, constraints, versions, and provenance.
- Reference and apply them.
- Execute Methodologies represented as Artifacts.
- Produce new Artifacts.
- Propose changes to existing Artifacts.
- Record usage and outcomes.

A Coworker's Mind Framework and Methodologies may eventually be represented by reusable Artifacts.

However, do not prematurely force every Coworker configuration field into the Artifact system.

Keep the relationship extensible.

## 6. Relationship with WAM

Thylas and WAM have separate responsibilities.

Thylas owns:

- Coworker creation and management.
- Identity and configuration UI.
- Workspace membership.
- Resource and Artifact access.
- Conversation and working interfaces.
- Human interaction.
- Visualization of collaboration and work.

WAM is intended to own agent-side runtime capabilities, including:

- Agent execution.
- Context management.
- Reasoning and planning.
- Tool execution.
- State management.
- Scheduling and execution coordination where appropriate.

Important constraints:

- Do not implement WAM's internal architecture inside Thylas.
- Do not assume WAM is already integrated.
- The current MVP may use the existing model/API integration.
- Keep interfaces and domain boundaries compatible with future WAM integration.
- Coworkers should not automatically become a traditional Multi-Agent system simply because multiple Coworkers exist in one Workspace.
- A2A communication should be treated as a distinct collaboration mechanism.

---

# PART II — CURRENT TASK

## Objective

Audit the existing Thylas project and produce a practical Coworker design specification covering:

1. Coworker domain model.
2. Coworker creation experience.
3. Mind Framework and Methodology conceptual model.
4. Functional A2A/A2H/H2A collaboration design.
5. A minimal collaboration scenario that can later be implemented and tested.

Do not build the complete feature set yet.

The immediate objective is to establish the right product and system boundaries before implementation.

## Phase 0 — Repository and Architecture Audit

Before making changes:

1. Read all applicable project instructions:
   - AGENTS.md / AGENT.md.
   - README.
   - thinking.md.
   - Existing architecture and decision documents.
   - Relevant frontend and backend documentation.

2. Inspect the actual codebase:
   - Existing User, Workspace, Coworker, and Artifact entities.
   - Existing database schema and migrations.
   - Existing API conventions.
   - Authentication and authorization.
   - Conversation and Message implementation.
   - Model/API integration.
   - Canvas and Artifact interfaces.
   - Existing Tool or plugin infrastructure.
   - Existing activity/history mechanisms.

3. Identify:
   - What is implemented.
   - What is partially implemented.
   - What is only documented.
   - What does not exist.
   - What can be reused.

Do not invent existing functionality.

Do not duplicate Phase 1 backend capabilities.

## Phase 1 — Coworker Domain Model

Produce a conceptual model of Coworker.

Investigate the following dimensions:

### Identity
- Name.
- Description.
- Role.
- Domain.
- Status.

### Responsibilities
- Responsibility scope.
- Explicit exclusions.
- Expected outputs.
- Working boundaries.

### Mind Framework
Propose a minimal but meaningful structure.

Investigate:
- Reasoning principles.
- Context organization.
- Decision rules.
- Uncertainty handling.
- Reflection and evaluation.
- Methodology selection.

Determine which elements are:
- Static configuration.
- Runtime behavior.
- Reusable components.
- Future extensions.

Do not turn every idea into an independent database table.

### Methodologies
Define the relationship between:

- Methodology.
- Method Run.
- Result.
- Evaluation.

Explain how a Coworker discovers and selects a methodology, executes it, and records its application.

### Toolsets
Clarify the distinction between:
- Responsibilities: what it should do.
- Mind Framework: how it organizes thinking.
- Methodologies: how it performs specific work.
- Toolsets: what capabilities it can invoke.

### Access and Permissions
Define the conceptual relationship between:
- Coworker and Workspace.
- Coworker and Artifact.
- Coworker and Tools.
- Coworker and external resources.

Avoid assuming unrestricted access.

Deliver a concise entity relationship diagram and explain unresolved design questions.

## Phase 2 — Coworker Creation Experience

Design the complete creation journey.

Explore these stages:

1. Intention — describe the collaborator the user wants.
2. Identity — establish identity and role.
3. Responsibilities — define scope and boundaries.
4. Mind & Method — configure or generate an initial thinking framework and methodology set.
5. Environment — configure Workspace, Artifact, resource, and Toolset access.
6. First Encounter — introduce the newly created Coworker and validate its actual working behavior.

The stages are conceptual, not mandatory separate pages.

### UX Requirements

The experience should:

- Feel deliberate and satisfying.
- Have a sense of occasion without becoming theatrical.
- Avoid a generic SaaS setup wizard.
- Avoid overwhelming users with technical configuration.
- Allow natural-language creation.
- Allow users to inspect and edit generated configurations.
- Support gradual configuration after creation.
- Make advanced settings discoverable without forcing every user to configure them.

Produce:

1. Creation flow diagram.
2. Screen-by-screen interaction outline.
3. User actions and system responses.
4. Suggested visual and interaction principles.
5. Creation completion and first-encounter experience.
6. MVP versus deferred interactions.

Do not implement the full UI in this task.

## Phase 3 — Functional Collaboration Model

This is the most important technical design task.

Design a minimal collaboration model that demonstrates actual cooperation between multiple Coworkers.

Do not start by designing a large generic Multi-Agent orchestration platform.

### A. Interaction Model

Define:

- A2A.
- A2H.
- H2A.

Explain their differences and how they interact.

### B. Collaboration Primitives

Evaluate the minimum useful set of structured operations:

- Request.
- Delegate.
- Respond.
- Challenge.
- Negotiate.
- Handoff.
- Request Human Input.
- Approve / Reject.
- Complete.

Do not automatically implement every primitive. Determine which are necessary for the first working collaboration scenario.

### C. Shared Context

Explain how agents share task-relevant context without indiscriminately sharing all their private or workspace data.

Distinguish:
- Shared task context.
- Coworker-specific working context.
- Workspace resources.
- Artifact references.
- Conversation history.

Avoid designing an elaborate memory architecture.

### D. Independent Mind Frameworks

Explain how two Coworkers with different Mind Frameworks should produce meaningfully different behavior.

Propose a way to verify this difference through observable behavior, not merely different prompts.

### E. Methodology Execution

Define how a Coworker selects and executes a methodology and how its execution can be inspected.

### F. Collaboration Traceability

Define the minimum information needed to reconstruct a collaboration:

- Initiator.
- Recipient.
- Task.
- Request.
- Context references.
- Expected output.
- Actual output.
- Status.
- Handoff or completion information.

### G. Human Intervention

Explain how a user can:

- Inspect ongoing work.
- Redirect an agent.
- Challenge a conclusion.
- Resolve disagreements.
- Approve consequential actions.
- Participate directly in a collaboration.

Do not assume the user must communicate exclusively through a central coordinator.

## Phase 4 — Design One Minimal Working Scenario

Design a realistic scenario that proves the collaboration model is functional.

Suggested example:

The user asks three Coworkers to help design an Agent Framework:

- Researcher: gathers evidence and identifies existing design patterns.
- Architect: develops the architecture.
- Critic: challenges assumptions and identifies weaknesses.

The workflow should demonstrate:

1. Task initiation.
2. Task delegation.
3. Context exchange.
4. Direct A2A communication.
5. Critique and response.
6. Human intervention when needed.
7. Shared Artifact production.
8. Traceable completion.

For every interaction, specify:
- Sender.
- Recipient.
- Intent.
- Structured payload or referenced object.
- Expected response.
- Resulting state transition.

Also identify what would make this collaboration fail or become merely decorative.

The scenario should be small enough to implement in a later MVP.

## Phase 5 — Local Simulation and Future Cloud Compatibility

Thylas needs to support local development and simulation before cloud deployment.

Investigate the existing project architecture and propose how to preserve the same domain model and application contracts across environments.

Separate:

- Domain logic.
- Application services.
- Runtime/model provider.
- Persistence adapter.
- External tool adapter.

The local implementation should not become a throwaway prototype.

Consider:
- Local persistence.
- Simulated or real model calls.
- Local event handling.
- Collaboration state.
- Artifact references.
- Future cloud persistence and authorization.

Do not introduce distributed infrastructure, queues, microservices, or complex runtime dependencies without a concrete requirement.

## Deliverables

Create or update a dedicated documentation section for Coworker design.

Use the repository's existing documentation conventions and folder structure.

At minimum, deliver:

1. Coworker Vision.
2. Coworker Domain Model.
3. Coworker Creation UX Specification.
4. Mind Framework & Methodology Specification.
5. Collaboration Model (A2A / A2H / H2A).
6. Minimal Collaboration Scenario.
7. Local Simulation & Cloud Compatibility Notes.
8. Implementation Roadmap.

Add diagrams where they materially improve understanding.

For each decision, distinguish:

- Confirmed direction.
- Proposed design.
- Open question.
- Deferred capability.

Do not silently convert proposals into finalized architecture.

## Implementation Decision

This task is primarily a design and specification task.

After completing the documentation:

1. Identify which small, isolated parts can be implemented safely using existing infrastructure.
2. Propose a prioritized implementation plan.
3. Identify dependencies and blockers.
4. Do not start implementing complex Multi-Agent runtime functionality.
5. Do not rewrite existing backend or frontend architecture.
6. Do not introduce WAM integration.
7. Do not build a decorative multi-agent UI that has no functional backend behavior.

If a small implementation is clearly valuable and independent, explain the scope and wait for approval before proceeding.

## Quality Standards

- Be concrete and technically grounded.
- Inspect before proposing.
- Prefer minimal, composable mechanisms.
- Keep product experience and runtime architecture distinct.
- Do not confuse configuration text with executable behavior.
- Do not confuse A2A message passing with actual collaboration.
- Do not confuse Methodology definitions with Methodology execution.
- Do not confuse shared context with unrestricted data access.
- Do not invent API endpoints, capabilities, or completed integrations.
- Avoid premature abstraction and overengineering.

The final result should help the team answer two questions:

1. **What kind of Coworker experience are we building?**
2. **What is the smallest real system that can prove our collaboration model works?**
