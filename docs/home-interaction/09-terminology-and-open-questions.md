# 09 — Terminology & Open Questions

**Status:** [C] for canonical terms where existing docs already decided; [Q] for open
decisions. Nothing here is silently resolved by assumption.

## 1. Canonical terminology

| Term | Canonical meaning | Source of truth | Do not use it for |
| --- | --- | --- | --- |
| **Home Conversation** | the merged evolution of the Overview intent input and the Chat system — the unified interaction entry point **[C]** (2026-11-21) | 01 §1 | the whole app |
| **Object Invocation** | referencing an existing object (`@`) | 02 §1 | executing an action |
| **Action Invocation** | requesting an operation (`/` or NL) | 02 §1 | object reference |
| **Context Binding** | making information available to the current task | 02 §1 | auto-injection |
| **Authorization** | permission to perform; **Commit authority** separate | 06 §3 | invocation |
| **Raw Information** | unstructured ingested source material | 03 §1 | Context Entry |
| **Context Entry** | governed, addressable, provenance-carrying fact/claim record | 03 §1 (GSC) | Artifact |
| **Knowledge Object** | curated named object built from Context Entries | 03 §1 (GSC) | Context Entry |
| **Retrieved Context** | the selected subset at a moment in time | 03 §1 | Working Context |
| **Working Context** | bound subset a task may read (per-conversation default) | 03 §1 | persistent storage |
| **Source** | input consulted for extraction | 04 §2 | Evidence |
| **Evidence** | citable span from a source supporting a candidate | 04 §2 | Source |
| **Artifact Candidate** | proposed artifact-shaped thing, before acceptance | 04 §2 | Canonical Artifact |
| **Canonical Artifact** | single authoritative artifact after commit | 04 §2 (Artifacts docs) | Candidate |
| **Revision Proposal** | proposed change to a canonical artifact | 04 §2 | Candidate (net-new) |
| **Artifact Application** | the commit act producing a new version | 04 §2 | Methodology execution |
| **MutationIntent** | the nine-field agent-write record | 06 §2 | UI state |
| **Intelligent UI** | the bidirectional structured-editing interaction layer | 05 §1 | static summary cards |
| **Resource** | file/note/board/process/integration usable as context or evidence | audit §2 (`Reference`) | Artifact |

## 2. Conflicting definitions found and their ruling

| Conflict | Where | Ruling |
| --- | --- | --- |
| "Knowledge object" used loosely for Artifact-like things | brief vs `artifacts/DEFINITION.md` | **[C]** Knowledge Object is a GSC term (03); Artifact is the Artifact System's. Never interchangeable. |
| Candidate vs Draft | profile `ProfileCandidate` vs artifact "candidate" | same *shape* (proposal with evidence + status), different domain types; shared mutation model (06 §7), not shared type. |
| Context in chat (`ContextSource`) vs GSC "Context" | `lib/chat.ts:18` vs Manifesto | `ContextSource` is a *binding record* (what's attached to a thread); GSC Context is the abstract relevant set. Rename planned: binding record → `ContextBinding` (09 §4). |
| `Reference` vs "Resource" | `types.ts:38` | Resource = the thing; Reference = the pointer to it. Keep both; stop calling references "resources" in UI copy. |
| "Agent executes" language in brief vs "no tool executes" | `DOMAIN-MODELS.md:55-62` | **[C]** no tool execution exists; "execute" in 06 means *running a proposal-producing operation* (model call + domain write), nothing more. |
| Mobile behaviour in 02 §7 vs D7 "no mobile in v1" | 02 §7 vs `docs/README.md` D7 | **[C]** D7 stands: mobile is Deferred; 02 §7 keeps the future shape only, labelled. |

## 3. Unresolved product decisions (need founder input)

| # | Question | Why it matters | Blocks |
| --- | --- | --- | --- |
| Q1 | **Restated (2026-11-21 merge decision):** does the merged Home Conversation become the default landing surface, and where do `/overview`'s orient functions (Continue, Needs-you, workspaces, recently) live? | the merge's IA consequence; changes first-run experience | 01, roadmap phase 1 |
| Q2 | `@` + `/` split vs single `@` for both objects and actions | 02 §2; affects composer architecture | 02, MVP scope |
| Q3 | Working Context lifetime: per-conversation vs per-task vs persistent session | 03 §1; affects retrieval design | 03 |
| Q4 | Delegation: can a Coworker hold standing commit authority (scoped, revocable)? | 06 §3/§9; whole governance shape | 06, coworker workflows |
| Q5 | Batch commit granularity: one confirm for N mutations, or per-mutation? | 06 §5; UX of the MVP extraction flow | 04/08 §4 |
| Q6 | Where do structured blocks live: message stream, dock, or per-kind? | 05 §8; panel architecture | 05 |
| Q7 | Artifact persistence: server table (Phase 4 in schema comments) or client-local for MVP? | 04 §7; what "persisted" means in the demo | 04, roadmap |
| Q8 | GSC scope model: implicit workspace context vs explicit per-entry scope | 03 §7 | 03 |

## 4. Architectural uncertainties

| # | Uncertainty | Impact |
| --- | --- | --- |
| A1 | Retrieval has no backend at all ("retrieval is not implemented in this build") — bound context is decorative today | 03/02 depend on a real retrieval service; MVP must either implement a minimal one or keep bindings honest-but-inert |
| A2 | `/api/ai*` unauthenticated | any agent-op flow must add session authz before it is real |
| A3 | Chat PUT conflict is not replayed client-side | multi-surface editing (05 §4) will hit this |
| A4 | No artifacts/GSC/notes server persistence | commit flows in 04/03 can only be prototyped with explicit labels |
| A5 | Model contract has no structured-output/tool channel | operation proposals must be produced via prompt+parse for now (labelled), or the contract gains a schema field |
| A6 | Name `ContextBinding` rename (09 §2) touches shared contract `lib/chat.ts` | do it in one pass with a migration, or not at all |

## 5. Decisions already made elsewhere (do not relitigate)

- No modals except ⌘K (D-047). No fake controls (interaction contract). Feedback at action point.
- Identity/permissions come from CHORD; client never computes access (B1).
- Agents hold no authority by default (Artifacts GOVERNANCE, GSC Manifesto).
- WAM owns the agent runtime; Thylas does not implement tool execution (`WAM-BOUNDARY.md`).
- GSC is independent infrastructure; Thylas/Coworkers are consumers (Manifesto).
- 2026-11-21 founder decisions: (1) Home Conversation = merged evolution of the Overview
  intent input and the Chat system (identity settled; IA consequences remain Q1); (2) MVP
  agent execution = real orchestration via `/api/ai` following the profile-pipeline pattern
  (extract → candidate → review → commit), seams kept WAM-compatible.
