# Subplan index

The program now has two levels, because one level was hiding the work:

- **SP-xx (parent)** — the *specification* of a surface or stage: scope, UX, visual rules, technical plan. Unchanged in intent.
- **SP-xxa (unit)** — the *unit of execution*: one branch, one commit, ≤ 1.5 days, its own acceptance and validation. A parent is complete only when all of its units are.

Parents carry UX/visual specification so units do not repeat them; each unit says which parent section it implements. This is the file to read when deciding "what do I do next".

## Units

| ID | Unit | Parent | Days | Depends | Status |
| --- | --- | --- | --- | --- | --- |
| SP-00 | Foundation | — | 1.5 | — | **Completed 11-07** |
| SP-01 | Application shell | — | 2.0 | SP-00 | **Completed 11-07** |
| [SP-02](SP-02-overview.md) | Overview | — | 1.0 | SP-01 | **Completed 11-07** |
| [SP-03a](SP-03a-tab-model.md) | Tab model and reconciliation | SP-03 | 1.0 | SP-01 | **Completed 11-07** |
| [SP-03b](SP-03b-panel-and-restore.md) | Panel widths, scroll restore, workspace semantics | SP-03 | 0.5 | SP-03a | **Completed 11-07** |
| [SP-04a](SP-04a-table-grammar.md) | Table grammar and column budgets | SP-04 | 0.75 | SP-03b | **Completed 11-07** |
| [SP-04b](SP-04b-file-interactions.md) | Disclosure, keyboard, tombstone, honest actions | SP-04 | 0.75 | SP-04a | **Completed 11-07** |
| [SP-05a](SP-05a-note-model.md) | Note model, local store, link parser, backlinks | SP-05 | 1.0 | SP-04a | Blocked (Q-1) |
| [SP-05b](SP-05b-editor-and-save.md) | Editor, save loop, conflict, dirty guard | SP-05 | 1.75 | SP-05a | Blocked (Q-1) |
| [SP-05c](SP-05c-note-library.md) | Library list, search, panel | SP-05 | 1.25 | SP-05b | Not Started |
| [SP-06a](SP-06a-scene-model.md) | Scene model, geometry, persistence schema | SP-06 | 0.75 | SP-04a | **Completed 11-07** |
| [SP-06b](SP-06b-viewport.md) | Viewport: zoom, pan, pointer machine | SP-06 | 1.25 | SP-06a | **Completed 11-07** |
| [SP-06c](SP-06c-cards.md) | Cards: create, drag, snap, marquee, undo | SP-06 | 1.5 | SP-06b | **Completed** 11-07 |
| [SP-06d](SP-06d-edges.md) | Edges, anchors, labels | SP-06 | 1.5 | SP-06c | Not Started |
| [SP-07a](SP-07a-ai-endpoint.md) | AI middleware, client, error taxonomy | SP-07 | 1.0 | SP-03b | Not Started |
| [SP-07b](SP-07b-ai-panel.md) | Overview AI panel and its states | SP-07 | 0.75 | SP-07a, SP-02 | Not Started |
| [SP-07c](SP-07c-process-states.md) | Process states, controls, labelled simulator | SP-07 | 0.75 | SP-03b | Not Started |
| [SP-08](SP-08-account-and-settings.md) | Account and settings | — | 0.5 | SP-01 | Not Started |
| [SP-09a](SP-09a-gates.md) | Gates script and e2e expansion | SP-09 | 1.0 | SP-02…SP-08 | Not Started |
| [SP-09b](SP-09b-visual-audit.md) | Visual, a11y, perf, identity test | SP-09 | 1.0 | SP-09a | Not Started |

Remaining: **18 working days** (SP-03…SP-09), of which SP-05 and SP-06 are 9.

## Rules

1. A unit is `Completed` only when its acceptance list and the five gates pass (`check`, `build`, `lint`, `test`, `e2e`).
2. A unit that needs a decision records it in `DECISIONS.md` and stops at a disabled/mock state rather than inventing behaviour.
3. Units in the same parent may be executed in any order the dependency column allows; cross-parent order comes from `MASTER-PLAN.md` §6.
4. If a unit exceeds 1.5 days, split it again — the split is cheaper than the overrun.
5. Parent documents are not edited during execution except to record a deviation in their result section.
