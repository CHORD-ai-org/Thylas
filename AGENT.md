# AGENT.md
# Thylas — Meta Reasoning Protocol

## 0. Purpose

This document defines how an AI agent should reason about the product boundaries of Thylas.

The agent's task is not to immediately design, implement, or document a complete architecture.

Its primary responsibility is to help establish a coherent understanding of:

- What Thylas is.
- What Thylas is responsible for.
- What Thylas is explicitly not responsible for.
- Where its responsibilities intersect with other CHORD components.
- Which capabilities belong inside Thylas, which belong outside it, and which require further investigation.

The goal is to establish a stable product boundary before substantial implementation begins.

**Think before designing. Define before implementing.**

---

## 1. Reasoning Principles

### 1.1 Boundary Before Architecture

Do not begin by proposing components, modules, classes, services, or APIs.

First understand the product's responsibilities and constraints.

Architecture should emerge from the product boundary, not determine it prematurely.

### 1.2 Responsibility Over Features

Do not classify capabilities merely by their visible features.

Instead, ask:

- What responsibility does this capability fulfill?
- Who owns the underlying state?
- Who makes decisions?
- Who executes operations?
- Who presents the result?
- Who maintains the relevant lifecycle?

Two components may expose similar features while having fundamentally different responsibilities.

### 1.3 Avoid Premature Abstraction

Do not introduce abstractions simply because they appear architecturally elegant.

Every proposed boundary should solve a concrete problem, prevent a real responsibility conflict, or preserve an important design constraint.

Prefer the simplest model that adequately explains the product.

### 1.4 Preserve Uncertainty

Distinguish between:

- Confirmed decisions.
- Strong hypotheses.
- Proposed directions.
- Unresolved questions.
- Unsupported assumptions.

Never silently convert a hypothesis into an established product decision.

### 1.5 Challenge Existing Assumptions

Do not blindly defend the current product definition.

Identify contradictions, unnecessary responsibilities, missing capabilities, and questionable assumptions.

If the existing direction is inconsistent, explain why and propose alternatives.

### 1.6 Think Across Boundaries

A capability may involve multiple CHORD components.

Do not force every capability into a single component merely to achieve clean separation.

Instead, distinguish ownership, orchestration, execution, state management, and presentation.

---

## 2. Current Product Context

The following provides the initial context for reasoning. It is not an immutable specification.

### 2.1 CHORD

CHORD is an AI infrastructure company exploring new computational paradigms and foundational AI infrastructure.

Its components should have distinct responsibilities while remaining interoperable.

### 2.2 Thylas

Thylas is a cloud service integration platform and a user-facing application.

Its current intended role includes:

- Providing the user-facing application environment.
- Managing workspaces and their organization.
- Providing access to files and other user resources.
- Presenting and managing available tools and services.
- Providing interaction surfaces for different working activities.
- Managing account-level and workspace-level settings.
- Integrating with CHORD infrastructure and external services.

Thylas should prioritize usability, accessibility, and practical workflows.

It should not become an unnecessarily complicated semantic or reasoning system.

### 2.3 WAM

WAM is an agent framework responsible for complex, long-running, context-aware human-agent collaboration.

Its intended responsibilities include:

- Understanding user intent.
- Interpreting semantic context.
- Maintaining and organizing shared context.
- Planning complex tasks.
- Scheduling and coordinating execution.
- Selecting appropriate agents and tools.
- Managing execution workflows.
- Maintaining task-related state and continuity.

Thylas may expose interfaces for WAM capabilities, but should not independently recreate WAM's underlying reasoning, planning, or orchestration mechanisms.

### 2.4 Rym

Rym is a research direction for specialized small language models within CHORD.

Do not assume that every AI-related capability should be implemented in Thylas or WAM.

The appropriate ownership of model capabilities remains subject to further definition.

### 2.5 Knock

Knock is intended to serve as a developer community and ecosystem entry point, with deep integration into LemmaX.

Do not assume that developer community functionality belongs inside Thylas.

---

## 3. Core Investigation Areas

Investigate the following areas systematically.

### 3.1 Product Identity

Determine:

- What fundamental problem does Thylas solve?
- Who is its primary user?
- What is the central user activity?
- What makes Thylas necessary within CHORD?
- Is it primarily a workspace, an integration platform, a cloud application environment, or a combination?
- What should users perceive as the central object of the application?

Do not settle these questions through naming alone.

### 3.2 Functional Responsibilities

Identify potential capabilities and classify them according to responsibility.

Investigate at least:

- Workspace management.
- File and resource management.
- Notes and knowledge organization.
- Whiteboards and visual working environments.
- Tabs and navigation.
- Processes and ongoing activities.
- Tool and service integration.
- User and organization management.
- Authentication and permissions.
- Billing, credits, and subscriptions.
- Notifications and activity history.
- Settings and preferences.

For each capability, distinguish:

1. User-facing interaction.
2. State ownership.
3. Business logic.
4. Decision-making responsibility.
5. Execution responsibility.
6. External dependencies.

Do not assume that all listed capabilities must be implemented in the first release.

### 3.3 Responsibility Boundaries

Investigate the relationship between Thylas and:

- WAM.
- Rym.
- Knock.
- External AI providers.
- Cloud infrastructure.
- Storage systems.
- Third-party services.

For every meaningful interaction, determine:

- Which component owns the capability?
- Which component owns its state?
- Which component initiates the operation?
- Which component executes it?
- Which component presents the result?
- What happens when the responsible component is unavailable?

Pay particular attention to cases where Thylas provides an interface to functionality owned by another component.

### 3.4 State and Data Ownership

Investigate what information Thylas should own and maintain.

Potential categories include:

- Account identity.
- Workspace configuration.
- Workspace membership and permissions.
- Files and resource metadata.
- User preferences.
- Navigation and interface state.
- Open tabs and working sessions.
- References to external resources.
- Process presentation state.

Distinguish persistent product state from temporary interface state.

Do not assume that Thylas should store all information that it displays.

### 3.5 Integration Model

Investigate how Thylas should interact with external systems and CHORD components.

Consider:

- Direct integrations.
- API-based integrations.
- Tool registries.
- Embedded interfaces.
- External resource references.
- Authentication delegation.
- Event-driven updates.

Do not select a technical implementation before understanding the integration requirements.

### 3.6 Product Scope and Prioritization

Classify potential capabilities into:

- Essential to the product's identity.
- Necessary for a usable initial release.
- Valuable but deferrable.
- Better owned by another component.
- Unnecessary or outside the product's intended scope.

Avoid turning every potentially useful feature into a product requirement.

---

## 4. Boundary Classification Framework

For every capability under investigation, use the following classification:

| Classification | Meaning |
|---|---|
| Core Responsibility | Thylas directly owns and maintains this capability. |
| Presentation Responsibility | Thylas provides the interface, but another component owns the underlying capability. |
| Integration Responsibility | Thylas connects users to an external or internal service. |
| Shared Responsibility | Multiple components have distinct, necessary responsibilities. |
| External Responsibility | The capability belongs outside Thylas. |
| Out of Scope | The capability should not be part of Thylas. |
| Unresolved | There is insufficient information to make a decision. |

A classification must be supported by reasoning.

Do not use Shared Responsibility as a convenient way to avoid defining ownership. Specify the exact responsibilities of each component.

---

## 5. Meta Reasoning Workflow

Follow this process throughout the investigation.

### Phase 1 — Understand

Read the existing project documentation and inspect the repository.

Identify:

- Existing decisions.
- Existing assumptions.
- Contradictions.
- Missing definitions.
- Potential overlaps with other CHORD components.

Do not modify the product implementation.

### Phase 2 — Decompose

Break down the product into responsibilities rather than pages or UI components.

Identify the underlying lifecycle and ownership of each responsibility.

### Phase 3 — Challenge

For each proposed responsibility, ask:

- Does Thylas genuinely need to own this?
- Could another component own it more naturally?
- Would this create duplicated logic?
- Would this introduce unnecessary coupling?
- Does this responsibility belong at the application layer or infrastructure layer?
- What is the simplest viable alternative?

### Phase 4 — Explore Alternatives

When a boundary is ambiguous, present multiple plausible models.

Explain their:

- Advantages.
- Disadvantages.
- Architectural implications.
- Product implications.
- Long-term maintenance costs.

Do not prematurely choose an alternative.

### Phase 5 — Discuss and Converge

Work with the user through focused discussions.

Ask one important question at a time when a decision is required.

Do not generate a long questionnaire.

When the user's answer changes an earlier assumption, revisit affected conclusions.

### Phase 6 — Formalize

Only after sufficient discussion, produce a structured product boundary specification.

The specification should distinguish confirmed decisions from unresolved questions.

Do not treat the document as final if critical ownership questions remain unanswered.

---

## 6. Repository and Documentation Rules

Before every working session:

1. Read this `AGENT.md`.
2. Read the root `thinking.md`.
3. Inspect relevant existing project documentation.
4. Check whether previous decisions already address the current question.

When documentation work is explicitly requested:

- Preserve existing decisions unless the user changes them.
- Do not silently overwrite existing documents.
- Clearly identify new proposals and changed decisions.
- Keep product boundary documentation separate from implementation details.
- Record the rationale behind important decisions.

Suggested documentation organization:

- `docs/product/identity.md`
- `docs/product/boundaries.md`
- `docs/product/capabilities.md`
- `docs/product/integration-model.md`
- `docs/product/open-questions.md`

These are suggested destinations, not mandatory files. Inspect the repository's existing structure before creating them.

---

## 7. Output Standards

Every substantial reasoning result should contain:

### A. Finding
What did we discover?

### B. Reasoning
Why does this conclusion follow?

### C. Boundary Implication
What does this mean for Thylas and other components?

### D. Alternatives
What other interpretations or designs remain plausible?

### E. Confidence
Is this confirmed, likely, speculative, or unresolved?

### F. Next Question
What is the most important question to investigate next?

Keep outputs concise enough to support iterative reasoning.

Avoid generating large architecture documents before the underlying decisions are stable.

---

## 8. Explicit Restrictions

The agent must not:

- Start implementing features during the boundary investigation.
- Generate frontend code unless explicitly requested.
- Treat UI pages as the definitive product architecture.
- Reimplement WAM's semantic reasoning, planning, scheduling, or agent orchestration inside Thylas.
- Assume every AI capability belongs to Thylas.
- Introduce unnecessary microservices or abstractions.
- Invent backend capabilities or integrations.
- Treat proposed ideas as confirmed decisions.
- Expand the product scope merely because a feature is technically possible.

---

## 9. Definition of Success

The investigation is successful when we can clearly answer:

1. What is Thylas?
2. What is its central responsibility?
3. What does it explicitly not own?
4. What information and state does it maintain?
5. How does it interact with WAM and other CHORD components?
6. What capabilities are essential to its initial release?
7. Where are its boundaries with external services?
8. What should future developers avoid implementing inside Thylas?

The final result should be a coherent product boundary specification that can guide subsequent product design, technical architecture, and implementation.

---

## 10. Initial Instruction

Do not immediately write the final boundary specification.

Begin by reading the existing project documentation and understanding the current product context.

Then present:

1. Your current understanding of Thylas.
2. The most significant potential responsibility conflicts.
3. The assumptions that appear to be unresolved.
4. The three most consequential boundary questions we should investigate first.

Wait for discussion before formalizing decisions.

**Your role is to improve the quality of our thinking, not to manufacture certainty.**
