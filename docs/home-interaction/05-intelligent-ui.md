# 05 — Intelligent UI & Collaborative Editing

**Status:** [P] product design. Visual direction: **Quiet Computationalism / 静谧计算美学**
(`docs/design/visual-system.md`); binding rules from `interaction-contract.md` (no fake
controls, feedback at the action point, no modals except ⌘K).

## 1. What Intelligent UI is

An interaction layer where **agents and users work on the same structured object together**:
agent output arrives as *reviewable, editable structure* — not prose to parse, and not a
static card. The central requirement:

> **Bidirectional editing** — the user edits the structured UI directly, and the agent
> interprets those edits and continues working on the *same object*.

It is NOT decorative cards, NOT dashboards, NOT a summary dump.

## 2. Block taxonomy (extends the existing `Block` contract)

Existing `lib/chat.ts:26-30` blocks: `text | artifact | evidence | status`. Extend the
contract (same file — client and server share it) with **interaction blocks**:

| Block | Purpose | Reversible? | Commit needed? |
| --- | --- | --- | --- |
| **Proposal** (agent-proposed modification) | "I suggest X change to object Y" with rationale | n/a | yes (06) |
| **CandidateList** | a manageable set of candidates with accept/reject/edit | yes (undo) | yes |
| **EvidenceView** | evidence spans on demand (source → span → claim) | n/a | no |
| **Compare/Dedup** | two or more similar items side by side, merge/pick/keep-both | yes | yes |
| **Diff/Revision** | proposed change to a canonical object; line-level compare, apply/discard | yes | yes (authority) |
| **StructuredEditor** | inline editor bound to one object type (artifact candidate, profile entry, context entry) | yes | yes |
| **Approval** | risk-scaled confirm (see 06 §5); inline, never modal | yes | yes |
| **Status/Progress** | long-running work; existing `status` block semantics kept | n/a | no |

Rendering contract: blocks render **inline in the turn** (or docked alongside via
`ChatDock`/`ContextPanel` for wide ones); every block has a defined empty, loading, error
state; every block that mutates is undoable until commit.

## 3. Patterns (all precedents exist in-tree)

| Need | Precedent to reuse | File |
| --- | --- | --- |
| Ranked candidate list w/ reasons & caveats | ComputeRun target recommendation | `src/pages/compute/ComputeRun.tsx:212-285` |
| Accept / reject / edit candidates + batch select | ProfileInit candidate review | `src/pages/user/ProfileInit.tsx:220-261` |
| Candidate model (evidence, confidence, editedContent, status) | `ProfileCandidate` | `src/lib/profile.ts:58-77` |
| Inline confirm (no modals) | compute inline confirm | `compute.module.css:636-659` |
| Whole-text compare ("Show both") | Notes save conflict | `src/pages/Notes.tsx:470-508` |
| Version history list | ArtifactDetail versions | `src/pages/artifacts/ArtifactDetail.tsx:217-221` |
| Two-way structured patch | `isCandidatePatch` + PATCH endpoint | `src/lib/profile.ts:177-188`, `routes/profile.ts` |
| Real in-message action | CodeBlock "Save as note" | `src/pages/chat/CodeBlock.tsx:23-47` |

## 4. Bidirectional editing model

1. **One object, two authors.** An object opened in a structured block is identified by id;
   user edits and agent edits are patches against the same version.
2. **Patch, don't replace.** Agent → user direction: proposals/diffs (`Revision Proposal`);
   user → agent direction: edits become *facts the agent reads* (`editedContent` precedent).
3. **Synchronization**: conversation feedback ("make it shorter") resolves into structured
   state (a patch on the open object) — the block re-renders from state, not from a second copy.
4. **Conflict**: concurrent user edit + agent revision → Diff/Revision block with both sides
   (never silently merged). Optimistic `expectedVersion` (chat PUT precedent).
5. **Undo/recovery/history**: every mutation has an undo until commit; commits are append-only
   history (profile history precedent). Agent undo is also a patch ("revert my last change").
6. **Traceability**: every block shows who did what: `authored by X · applied by Y · under
   authority Z` (GOVERNANCE.md vocabulary).

## 5. Information load management (critical constraint)

The interface shows **the decision, not the database**.

| Rule | Application |
| --- | --- |
| Progressive disclosure | summary row → expand for detail → expand for raw evidence. Never three levels at once |
| Relevance-based presentation | order by decision impact; hide corroborating duplicates behind "n more like this" |
| Summary before detail | every multi-item block leads with one line: what changed / what's proposed / what's needed |
| Evidence on demand | evidence is one click away, never inline by default |
| Minimal mandatory decisions | defaults are pre-chosen where safe; reject/accept is one keystroke; multi-step wizards only when risk requires |
| Contextual explanations | *why* this is shown, when the reason affects the decision |
| Important vs optional | decisions are visually distinct (accent) from informational detail (muted) |
| Long-running flows | complex workflows keep a persistent "what's next / what needs you" affordance (Needs-you precedent, `Overview.tsx:325-362`) |

Simple operation and complex workflow must both work: same block grammar, different depth.

## 6. Visual/interaction requirements (Quiet Computationalism)

- Typography and spacing carry hierarchy; hairlines only; no gradients/glass; no card walls.
- Each interactive element has one purpose; disabled controls show *why* before the click.
- No toast/modal/banner; feedback at the action point (interaction contract).
- Motion minimal; state changes are legible without animation.

## 7. Explicit non-goals

- Static "summary cards" pretending to be interactive.
- One giant dashboard replacing the conversation.
- Agent-silently-applied changes to user-owned objects (see 06).
- Replacing the dedicated editors (notes/boards/artifact pages stay authoritative surfaces).

## 8. Open questions (→ 09)

- Do structured blocks live in the message stream, in the dock, or both per block-kind?
- Snapshot or live binding: if the user edits an object elsewhere (e.g. note editor), does the open block live-update?
- Global undo stack vs per-block undo?
