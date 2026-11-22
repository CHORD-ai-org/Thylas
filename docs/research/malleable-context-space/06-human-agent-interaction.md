# 06 — Human-Agent Interaction (Intelligent UI)

How the models above become real interactions. Thylas's binding rules (interaction
contract: no fake controls, no modals, feedback at the action point) are preserved
throughout. Builds directly on `docs/home-interaction/04,05,06`.

## 1. Direct manipulation (E, D)

| Gesture | Semantic meaning | Data effect |
|---|---|---|
| Select objects | "this is my context" (E: selection delimits the task) | selection → Working Context (home-interaction 03) |
| Group / ungroup | "these belong together" | structural-move event; optional relation proposal |
| Connect | "this relates to that, as X" | typed relation (proposal when canonical) |
| Reorder / move | "sequence/priority changed" | arrangement metadata on the representation |
| Mark / annotate (ink) | "here, this, now" (E) | derived unit on the representation (scratch tier) |
| Move between representations | "re-contextualize" | reference or promotion along the 03 §4 ladder |
| Create from selection | "turn this into an object" | Candidate → review → commit (04 of home-interaction) |

**[ours]** Spatial operations must map to *named* semantic operations (E's local-targeting
difficulty); anything ambiguous is a proposal, never an auto-mutation.

## 2. Conversational interaction

Already specced: `@` object invocation vs `/` action vs context binding vs authorization
(`home-interaction/02`), one question per surface, proposals for agent work
(`05-intelligent-ui`). Research additions:
- **Explicit submission** (E): an agent starts only from an explicitly submitted scope
  (ink/selection/chips) — Thylas chips are this; keep "nothing is read automatically".
- **Clarify-or-proceed** (CLEO decision loop): when user intent is ambiguous (feedback vs
  instruction), agent asks — but the cost of asking must be weighed (Lemma: "AI
  participation should be a decision rather than a default", voice review).

## 3. Bidirectional editing & attribution (B)

Thylas has the commit gate (`mutation.ts`) and the patch-not-replace rule (05 §4 of
home-interaction). Missing: **edit-level attribution classes** [ours, from B]:

| Class | Meaning | Handling |
|---|---|---|
| feedback | "change this" about agent work | agent revises; user stays author of the request |
| independent work | user edited their own thing mid-run | agent must not revert; re-sync |
| co-edit | both editing the same object | merge UI with attribution (Comparison view, 04 §3) |
| takeover | user takes over agent's draft | agent stands down |
| reuse | agent builds on user's edit | provenance chain extends |

Rule candidates: (1) every stored edit records `actor + intent-class + timestamp` (extend
MutationIntent or events — 08-Q-G); (2) agent-generated changes to user content are always
proposals; (3) conflicts render as diff with both attributions, never silently merged.

## 4. Mutual awareness (A)

What each side needs to see (Ream, abstract-level): the other's activity *within the
objects*, not a chat log. Thylas surfaces to upgrade:
- Artifact detail: version history exists; add engagement traces ("Mira edited §2 while
  Architect proposed v4") — **evidence on demand**, not inline clutter.
- Boards: structural-move trail per card.
- Conversation: `status`/`proposal` blocks already mark agent activity; add "what the
  human changed since" for the agent side (context assembly input, `buildAgentContext`-style).

## 5. Cognitive load

Unchanged from `home-interaction/05 §5`: progressive disclosure, relevance ordering,
summary-before-detail, evidence on demand, minimal mandatory decisions, decision-focused
interfaces. Research overlay: **attribution and provenance live one level down** (A's
localized visualizations); defaults never show the full trace.

## 6. Task continuity (E)

Long-running work across sessions: representations + working context + process traces are
the continuity substrate. Thylas today: notes survive (local DB), conversations survive
(envelope), boards survive (seed/local), candidate sessions survive (localStorage). The
missing continuity piece is a *named working context* that reopens with the task
(home-interaction Q3).
