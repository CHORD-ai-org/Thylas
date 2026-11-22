# Home Interaction — documentation system

**Date:** 2026-11-21. Evolving the Home Conversation — the merged evolution of the
Overview intent input and the Chat system (founder decision, 2026-11-21) — into Thylas's
unified interaction entry point. Principle: **the conversation is the entry point, not the
entire interaction interface.**

| # | Document | Answers |
| --- | --- | --- |
| 00 | [Existing system audit](00-existing-system-audit.md) | what is shipped, reusable, and missing (file:line evidence) |
| 01 | [Vision](01-vision.md) | what the Home Conversation is; conversational vs structured vs dedicated surfaces |
| 02 | [Invocation system](02-invocation-system.md) | `@` object invocation vs action vs context binding vs authorization |
| 03 | [GSC context interaction](03-gsc-context-interaction.md) | seven-term reconciliation; discover/retrieve/bind/create/evolve; contracts |
| 04 | [Artifact creation & evolution](04-artifact-creation-evolution.md) | source→evidence→candidate→canonical workflow; per-type implications |
| 05 | [Intelligent UI](05-intelligent-ui.md) | bidirectional structured editing; information-load management |
| 06 | [Agent operations & governance](06-agent-operations-governance.md) | MutationIntent; execution permission ≠ commit authority; risk-scaled confirmation |
| 07 | [Interaction architecture](07-interaction-architecture.md) | lifecycle, layer responsibilities, current/proposed/future |
| 08 | [End-to-end scenarios](08-end-to-end-scenarios.md) | nine validating scenarios (incl. the MVP demo flow) |
| 09 | [Terminology & open questions](09-terminology-and-open-questions.md) | canonical terms, conflicts, Q1–Q8 founder decisions |
| 10 | [Execution roadmap](10-execution-roadmap.md) | phases, task cards, MVP scope, blocked items |
| 11 | [Execution plan](11-execution-plan.md) | P0/P1/K 可执行拆解：单元卡、硬关卡、依赖图 |

Reading order: 00 → 01 → 02 → (03, 04, 05, 06) → 07 → 08 → 09 → 10.

Constraints inherited from `AGENT.md`, `docs/design/interaction-contract.md`, and the
Artifact/GSC product docs: label decisions, never invent capabilities, no fake controls,
no silent product ambiguity.

## Change log

| Date | Change |
| --- | --- |
| 2026-11-21 | Post-review revision (founder decisions applied): Home Conversation redefined as the merged evolution of the Overview intent input and the Chat system (00 verdict, 01 §1/§6, 02 §3, 07 §4, 09 §1/§3 updated, Q1 restated); mobile behaviour in 02 §7 marked **[Deferred]** per D7 (09 §2); agent execution path confirmed as real orchestration via the profile-pipeline pattern (11 §0) — no other doc changes needed. |
