# 08 — End-to-end user scenarios

**Status:** [P] validation scenarios. Each one exercises the specs in 02–06. "Persisted"
means what is actually durable after the flow (per audit: only profile/user/conversations/
files are server-durable today).

---

## 1. `@` an existing Coworker

- **Intent:** ask Mira (Researcher) to review a note.
- **Sequence:** type `@Mi` → palette (Coworkers group) → select Mira → chip → type request → send.
- **System:** reference resolved to coworker id; message tagged with the mention; coworker
  scope/context attached per `coworkers/WORKING-EXPERIENCE.md`.
- **UI:** chip above input; in-thread mention rendered as a link to `/coworkers/:id`.
- **Data:** message + `ContextSource{kind:'integration'|'workspace'}` (as applicable) written to conversation state.
- **Permission:** workspace membership required to mention; nothing else needed.
- **Persisted:** conversation message (server when `VITE_CHAT_SOURCE=api`).

## 2. Reference an existing Artifact

- **Intent:** bring "Learning Engine — Concept v3" into the thread.
- **Sequence:** `@Learning Engine` → Artifacts group → select → "Bind as context" (chip popover).
- **System:** `toReference()` → `ContextSource{kind:'file'|'note'|…}` per existing kinds; read-only binding.
- **UI:** chip marked "bound"; a `Retrieved Context` block may list what of it is in the working set (03 §3).
- **Data:** `conversation.context` gains one entry. **Invocation ≠ execution**: no mutation.
- **Permission:** artifact read scope (workspace membership).
- **Persisted:** conversation context (chat state PUT).

## 3. Retrieve a specific GSC Context

- **Intent:** "what did we decide about the naming convention?"
- **Sequence:** NL request → assistant issues retrieval → `Retrieved Context` block lists entries with provenance → user binds two.
- **System:** `POST /api/gsc/search` (03 §5) → ranked entries → user selection → Working Context.
- **UI:** candidate/evidence list (ComputeRun-style), summary first, evidence on demand.
- **Data:** retrieval state attached to the turn; binding adds `ContextSource`s.
- **Permission:** read on GSC scope; none committed.
- **Persisted:** working-context binding (conversation state). *(Blocked: GSC has no code.)*

## 4. Extract Artifacts from diary + Elarie conversations  ← **MVP demo**

- **Intent:** "extract some Artifacts from my diary last month and my conversation files with Elarie."
- **Sequence:** NL request → **Source Discovery** block (notes/files filtered by date+name) → user selects 6 sources → "Extract" → progress status → **CandidateList** (12 candidates, grouped by type, each with evidence) → user edits 3, rejects 4, accepts 5 → **Commit** (inline confirm, high-risk batch) → 5 canonical artifacts.
- **System:** extraction (LLM, `extract.ts` pattern) produces candidates + evidence spans; review states `pending/accepted/rejected/edited`; commit idempotent (`recordKey`-style dedupe), provenance attached; history appended.
- **UI:** candidate cards with evidence-on-demand, inline editors per type, batch select, one batch confirm.
- **Data:** sources read-only; candidates created; on commit → canonical artifacts with `versions[1]`, provenance, relations to sources.
- **Permission:** read sources (membership); **commit authority required** (06 §3) — agent cannot auto-create.
- **Persisted:** candidates + committed artifacts *(artifacts table does not exist yet — until then the flow must be labelled prototype)*.

## 5. Edit an Artifact Candidate in Intelligent UI

- **Intent:** fix a candidate's definition before accepting.
- **Sequence:** open candidate → structured editor → edit text + split one candidate into two → agent notices the split and re-associates evidence → user accepts.
- **System:** user edits = patches (`editedContent` precedent); agent re-runs only what's affected (evidence re-association), never overwrites user edits.
- **UI:** StructuredEditor block; agent changes appear as **Proposal** sub-block requiring accept; undo available pre-commit.
- **Data:** candidate patch history; no canonical write yet.
- **Permission:** none beyond review (proposal is not a commit).
- **Persisted:** edited candidate (review state).

## 6. Ask an Agent to update User Profile

- **Intent:** "remember that I prefer concise answers."
- **Sequence:** NL → **Proposal** block (ProfileCandidate: content + evidence "user said…") → user clicks accept → commit.
- **System:** exactly the shipped profile flow (`/discover`-less local variant → `candidates` → `/commit`).
- **UI:** one-line summary + accept/reject/edit; no confirmation needed (medium risk, reversible pre-commit).
- **Data:** candidate → `ProfileRecord` + history entry.
- **Permission:** self-scope; commit by user (or delegated grant — open question).
- **Persisted:** profile record + history (`server/profile/store.ts`) — **real today**.

## 7. Resolve duplicate or conflicting information

- **Intent:** two candidate concepts ("Working Context") look like duplicates; one existing canonical concept contradicts a new claim.
- **Sequence:** extraction dedupe pass flags similarity → **Compare/Dedup** block (side-by-side, shared evidence highlighted) → user picks "merge into canonical" / "keep both (distinct)" / "supersede" → commit.
- **System:** similarity = name+content match (no accuracy score — `contradicts`/`supports` relations carry the semantics); merge writes relations + history.
- **UI:** Compare block with three decisions, each one keystroke; important decision visually distinct from detail (05 §5).
- **Data:** relation writes + possible `supersedes` revision proposal.
- **Permission:** commit authority on the canonical object (high risk when superseding → explicit diff + confirm).
- **Persisted:** relations/history; canonical version bump on apply.

## 8. Propose a revision to a Canonical Artifact

- **Intent:** the roadmap artifact is outdated after last week's decisions.
- **Sequence:** "update the roadmap from last week's notes" → sources → extraction → **Diff/Revision** block (proposed changes, evidence per hunk) → user edits hunks, rejects one → apply → new version.
- **System:** Revision Proposal carries provenance; apply requires `expectedVersion` (optimistic concurrency, chat-PUT precedent); never in-place silent edit.
- **UI:** diff view (extend Notes "Show both" into hunk-level), accept/reject per hunk.
- **Data:** revision proposal record; on apply → new `Artifact.versions` entry + history.
- **Permission:** authority on the artifact (high risk → explicit confirm).
- **Persisted:** new artifact version.

## 9. NL + multiple `@` references combined

- **Intent:** "compare @Learning Engine with @diary-2026-10 and tell me where they disagree."
- **Sequence:** two chips bound → NL request → assistant runs comparison over Working Context → returns a `text` answer with `evidence` blocks per claim + a `Compare` block listing disagreements → user accepts one disagreement as a `contradicts` relation proposal → commit.
- **System:** retrieval over exactly the bound set (no silent extra context); claims cite evidence spans.
- **UI:** answer + evidence rows + relation proposal at the decision point.
- **Data:** relation write only.
- **Permission:** read both; commit authority for the relation (low risk → undo instead of prompt).
- **Persisted:** relation + history.

---

### Cross-scenario invariants

1. Invocation never mutates; commit always passes through review when risk requires it.
2. Every agent output that becomes persistent information is a candidate/proposal first.
3. Every claim in a result is evidence-backed or labelled as inference (`informationType` precedent).
4. Blocked surfaces are labelled prototype (GSC retrieval, artifact persistence) — never faked as working.
