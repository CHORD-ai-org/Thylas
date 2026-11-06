# Thylas — Product Definition

**Status:** proposed, for review. Nothing here is implemented.
**Date:** 2026-11-07
**Supersedes:** nothing. It extends `AGENT.md` §2 and `design/thylas-ui-design-plan.md` §1 without contradicting either.
**Audience:** whoever has to decide what goes in the first release, and whoever has to build it.

Labels are the same four used in the design plan: **[C]** confirmed, **[P]** proposed, **[?]** open, **[A]** assumption.

---

## 0. What this document is for

It answers four questions and refuses to answer a fifth.

1. What is Thylas, said in a way that excludes the wrong products?
2. Where does its state end and WAM's begin?
3. What are its capabilities, grouped by what the user is trying to do?
4. What must the first release close?
5. *Not answered here:* pricing, quotas, org administration UX, mobile. These are real, they are just not identity questions.

The UI layer is specified elsewhere. `design/thylas-ui-design-plan.md` owns pages, tabs, canvas, and the visual system. This document owns why those pages exist and what they may not do.

---

## 1. The product in one paragraph

**[P]** Thylas is the place where a person's material, the work they do on it, and the work they hand to the system all sit in the same room.

Concretely: a user signs in, picks a workspace, drops in 40 papers, writes a note about what they are looking for, asks the system to run an analysis over those papers, comes back two hours later to a whiteboard with the conflicting claims laid out, and knows which run produced which card.

Everything in that sentence is a Thylas responsibility except the analysis. That split is the product.

---

## 2. The gap it fills

**[P]** CHORD's capabilities are callable but not inhabitable. WAM can plan and execute a long task; Rym will expose specialised models; external providers can be connected. Without an application layer, each of those is an API key and a script.

Take a real task: *"read this folder of papers, find where they contradict each other, put the contradictions on a board, and tell me which claim has the weakest support."* WAM is the right place to plan and execute that. But four things have no home:

| Missing | What the user actually lacks | Where it has to live |
| --- | --- | --- |
| The 40 papers | Somewhere to put them that survives the session | A workspace, with files |
| The output | A board and notes the user can rearrange by hand afterwards | Same workspace |
| The middle | Whether it is running, what it decided, what it spent, what it is stuck on | A run view fed by WAM |
| Next Tuesday | The ability to find this again without remembering what they typed | Recently, and the workspace itself |

Those four are the product. Not "an AI workspace" in general — the four places where delegated work would otherwise evaporate.

**[A]** The four-part gap assumes a user who delegates multi-hour work. If real usage is 2-minute questions, Thylas is over-built and the Overview should look much more like a search box. This is the single assumption most worth killing early.

---

## 3. Central activity and central object

**Central activity [P]:** *handing over a piece of work and then being able to pick it back up.* Not searching, not chatting, not writing documents. Those all happen, but they are in service of the handover loop: prepare material → delegate → inspect → keep or redo.

**Central object [C]** (carried from the design plan §4.1): the **Workspace**. Not the conversation, not the document.

Why workspace and not conversation: a conversation is ordered by time and dies. A workspace is ordered by place and persists. The user's mental model — "the paper-comparison thing I was doing" — is a place with stuff in it, and it has to still be there after the chat that started it is gone.

Why not the document: documents are one kind of material. A workspace holds files, notes, boards, and running processes at once, and the relationships between them are the value.

**Consequence for the shell:** the workspace switcher is a primary control, not a dropdown in a settings corner. Every screen except Account is inside a workspace scope or is a lens across them (Recently, Notes).

---

## 4. What "Application Layer" means, precisely

**[P]** The distinction is not "UI vs backend". It is **which state the component is the authority for**.

| State | Owner | Examples |
| --- | --- | --- |
| **The person's working state** | Thylas | which workspace, what is open, where a note lives, what a board looks like, what the user named things, what they have seen |
| **The system's reasoning state** | WAM | what the intent means, what the plan is, which agent is running, what context is shared across sessions, what to do next |

Thylas is the authority for the first column. It is a *reader* of the second. It may cache the second column for display and must be able to throw that cache away without losing anything.

**[C]** The test that follows, and that should be applied in every design review:

> If a Thylas screen has to *decide* something about the user's work, the screen is wrong. Thylas collects the instruction, WAM decides, Thylas reports.

**What this rules out**, concretely:

- A "smart" default that reorders a user's processes by inferred priority. That is a decision.
- A local retry when a run fails. That is orchestration.
- Estimating remaining time from past runs. That is a model.
- Auto-summarising a note locally. That is semantic reasoning, and it belongs on the other side of the boundary even when it is cheap to do here.

**What it does not rule out:** local full-text search, sorting, filtering, grouping by date, syntax highlighting, layout, drag and drop, undo. These are operations on Thylas-owned state.

---

## 5. What it is not

Three comparisons, because each one predicts a different wrong build.

### 5.1 Not a cloud management console

| | Cloud console | Thylas |
| --- | --- | --- |
| Unit of organisation | Resource (instance, bucket, function) | Workspace |
| Home screen answers | Is everything healthy? What am I spending? | What was I doing? What needs me? |
| Primary verb | Create, configure, destroy | Open, place, delegate, inspect |
| Definition of success | Resources are running | The work moved forward |
| Where cost lives | The landing page | Account → Usage, one click away |

**The difference that matters:** a console is organised around the health of the provider's resources. Thylas is organised around whether the *user's* work advanced. A dashboard of green checkmarks on the landing page is the failure mode here, and the current Overview deliberately has no charts (`design/…plan.md` §4.2).

**[P]** Quota and credits appear where a decision is being made (before starting a run, in Account), never as ambient decoration.

### 5.2 Not a productivity workspace

Notion, Heptabase, Obsidian: everything on screen was made by a person, and every object is in a state the person put it in.

Thylas has a second class of object: work that was *delegated and executed elsewhere*. That object has a lifecycle the user does not control — queued, running, needs input, succeeded, failed, stopped — and it can change while nobody is looking.

**Consequence:** state is a first-class visual element. Status dots, `needs input` badges, "produced by run #12" on an artifact. A productivity tool has no vocabulary for this, and copying one produces a workspace where a running job is indistinguishable from a finished note.

**Consequence for the board, specifically:** a card can be live (owned by a run, read-only) or authored (owned by the user, editable). The design plan §8.2 encodes this. It is not decoration; it is the visible form of the boundary.

### 5.3 Not a chat product with files attached

Chat is a good input method and a bad organising principle. It orders everything by time, it makes the artifact a message, and it puts the system's reasoning in the same visual channel as the user's material.

Thylas takes intent as text (Overview has one input, and that is deliberate) and then *files the result as an object in a workspace*. The conversation is not kept as the primary record; the plan and the artifacts are.

---

## 6. Who uses it

**[P]** Two people, and the second one is the reason organisations pay.

**U1 · The principal.** A researcher, engineer, or analyst. Owns 3–40 workspaces, mostly personal, a couple shared. Has more material than time. Wants long-running work off their desk. Drives the design: 1440 desktop, dense tables, keyboard-first, multi-tab.

**U2 · The member.** Invited into an organisation workspace. Does not create workspaces, does not manage billing, may not see other workspaces. Signs in, opens one workspace, does the work, leaves. Needs: nothing surprising, no personal data leaking into the org view, no dead rows they lack permission for.

**[?] Gap in the existing journey set.** `design/…plan.md` §11 has seven journeys (J1–J7) and all seven are U1 journeys. U2 has no documented path. The first U2 journey — *an invited member opens the app for the first time and lands inside the org workspace, not on a personal Overview* — is written in §7 below, and it forces a decision the current design has not made: what a user with zero personal workspaces sees as their default landing.

---

## 7. Journeys v1 must close

The seven U1 journeys are specified in `design/thylas-ui-design-plan.md` §11 and are not repeated here. Three acceptance conditions are added, because they are the ones that break silently.

| # | Journey | Accepted when | Currently unproven |
| --- | --- | --- | --- |
| J1+ | Returning user with 12 open tabs across 2 workspaces | Restores the previous workspace, strip, and scroll in under one second of visible work; nothing from workspace A appears in workspace B's strip | Tab persistence design exists (§7.4), storage choice is open (Q12 in this document) |
| J2+ | Run finishes while the app is closed | Opening the app shows the result in Recently and in the process list without a manual refresh; no toast, no modal | Requires WAM to expose a "changes since" query — unconfirmed |
| **J8** | **Invited org member, first sign-in** | Lands inside the org workspace; cannot see the org's other workspaces, the admin settings, or the personal library of anyone else; sees an empty state that says who invited them and what to do | No design exists. Depends on the authz model (N2) |

---

## 8. Responsibility matrix

**[P]** One row per capability. "Owner of state" is who holds the truth; "Decides" is who makes the call; "Executes" is who does the work. Thylas's role is what remains.

Classes: **Core** · **Presentation** (Thylas renders, another component owns) · **Integration** (Thylas connects to a service) · **Shared** (split, specified in the row) · **External** · **Out of scope** · **Unresolved**.

| # | Capability | Owner of state | Decides | Executes | Thylas role | Class | Conf |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Sign-in, session | CHORD identity provider | IdP | IdP | Redirect, hold session, render identity | Integration | [A] |
| 2 | Organization, membership, roles | Shared authorization service | That service | That service | Render members; gate rows; never authorise alone | Integration | [?] |
| 3 | Workspace create / rename / archive | Thylas | Thylas | Thylas | Full | **Core** | [P] |
| 4 | Workspace membership grants | Authorization service | Admin | That service | Invite UI, no local ACL copy | Integration | [?] |
| 5 | File binary storage | Object storage | Storage | Storage | Signed upload/download; never proxy bytes | Integration | [A] |
| 6 | File tree, folders, tags | Thylas | Thylas | Thylas | Full — *unless* the storage service already has folders, in which case see N4 | **Core** | [?] |
| 7 | Note body, blocks, versions | Thylas | Thylas | Thylas | Full | **Core** | [P] |
| 8 | Board objects, layout, edges | Thylas | Thylas | Thylas | Full | **Core** | [P] |
| 9 | The user's instruction to a process | Thylas stores the submitted text verbatim; WAM owns its interpretation | WAM interprets | — | Collect, submit, keep the record | Shared — Thylas keeps the record, WAM keeps the meaning | [P] |
| 10 | Plan and plan revisions | WAM | WAM | WAM | Read-only render | Presentation | [C] |
| 11 | Run state and event stream | WAM | WAM | WAM | Subscribe, cache for display, discard freely | Presentation | [C] |
| 12 | Scheduling, retry, queueing, model choice | WAM | WAM | WAM | Nothing | External | [C] |
| 13 | Pause / stop / resume / answer / approve | WAM | WAM | WAM | Render a control only if WAM exposes it | Presentation | [C] |
| 14 | Artifact production (file, note, board card) | Thylas owns the object after it lands | WAM decides content and which artifact; Thylas assigns id, scope, placement | WAM, writing through Thylas | Accept the write, place it, keep provenance | Shared — see B2 | [P] |
| 15 | Lexical search over Thylas content | Thylas index | Thylas | Thylas | Full (names, extracted text, tags) | **Core** | [P] |
| 16 | Semantic / related search | WAM | WAM | WAM | An explicit action, labelled as a WAM call | Presentation | [P] |
| 17 | Credit consumption | WAM consumes; metering service counts | Metering | Metering | Display the returned number; warn, never block | Presentation | [?] |
| 18 | Invoicing, payment methods, tax | Billing provider | Provider | Provider | Link out; show plan name | External | [A] |
| 19 | API keys | Unresolved — platform-level or app-level | ? | ? | Manage UI only if Thylas issues them | Unresolved | [?] |
| 20 | In-app notifications | Thylas derives from WAM events | Thylas | Thylas | Full | **Core** | [P] |
| 21 | Email / push notification | External provider | External | External | Opt-in settings only | External | [?] |
| 22 | User preferences (density, panel widths, language) | Thylas | Thylas | Thylas | Full | **Core** | [C] |
| 23 | Open tabs, active tab, canvas viewport | Thylas (client session) | Thylas | Client | Full | **Core** | [C] |
| 24 | Real-time co-editing | Not in v1 | — | — | None | Out of scope (v1) | [P] |
| 25 | Rym model calls | Rym | Rym | Rym | Nothing — WAM is Rym's caller, not Thylas | External | [A] |
| 26 | Developer community | Knock | Knock | Knock | A link out, if anywhere | Out of scope | [C] |
| 27 | Quota *enforcement* | Metering / WAM admission | That service | That service | Show the refusal message it returns | External | [P] |

**Reading the matrix:** 27 rows — 8 Core, 4 Integration, 5 Presentation, 5 External, 2 Shared, 1 Unresolved, 2 Out of scope. If a proposed feature does not land in Core or fill a hole in Presentation, it is probably WAM's job or nobody's.

**Unresolved rows are the ones that will block work.** #2 and #6 block the workspace and file screens and map to N2 and N4 in `architecture/application.md` §9. #17 and #19 block the usage and API-key screens and have no counterpart anywhere yet — that absence is itself the finding.

---

## 9. Three boundaries that get violated first

Not principles. Predictions, with the failure that follows.

### B1 · Permissions will be checked in the UI and nowhere else

**The failure:** Thylas hides a workspace row for a member without access, the member crafts the URL or calls the same API, and WAM executes a run against files they cannot read. Nothing in the UI is wrong; the data is already leaked by the time it renders.

**The rule [C]:** authorisation is enforced by the owner of the resource, at execution time. Every request to WAM carries the acting user's identity; WAM (or the shared authz service) re-checks. Thylas also checks, for UX — a hidden row is a courtesy, never a control.

**Consequence:** Thylas never passes a service token that impersonates the user's authority. If the integration has no way to forward identity, that integration is not ready.

### B2 · WAM will write artifacts directly and bypass the object model

**The failure:** a run produces a summary. The obvious implementation writes a row into the notes table. It lands with no scope, no collection, no provenance, and cannot be found in the workspace's Notes group. Two months later nobody can answer "which run made this".

**The rule [P]:** WAM never writes Thylas tables. It calls one ingestion surface (`POST artifact`) or emits an event Thylas consumes. Thylas assigns the id, the scope, the placement, and the `produced_by` link. WAM supplies content and a proposed name.

**Consequence:** artifact ingestion is a first-class API on the Thylas side and a required item in the WAM integration contract. It is a bigger piece of work than it looks and it appears in M4 of the roadmap.

### B3 · Credit display will turn into credit enforcement

**The failure:** Thylas knows the plan limit and the current usage, so it disables "Start" when the balance is low. Now Thylas is an admission controller with a stale number, and two clients disagree about who may run.

**The rule [P]:** Thylas shows what the metering service returns and warns before an expensive action. It blocks only when the service returns a refusal, and it renders that refusal with the service's own reason.

**Consequence:** the "can I afford this" check is a request, not a computation.

---

## 10. Capability model — five activities, five areas

**[P]** The sidebar has five areas because there are five things a person does, not because five looked balanced. This mapping is the test for any new navigation request.

| Activity | Area | The question it answers | Owns | v1 |
| --- | --- | --- | --- | --- |
| **Orient** | Overview, Recently | Where was I, what moved, what needs me | Nothing — both are views over other objects | Yes |
| **Organise** | Workspace switcher, Files | What belongs where | Workspace, file metadata, folders | Yes |
| **Think** | Notes, Whiteboard | What do I make of this | Notes, boards | Yes |
| **Delegate** | Processes | What is the system doing | Only the submitted instruction and its presentation | Yes, read-heavy |
| **Administer** | Account | What am I paying for, what can I call | Preferences, plan display, keys | Yes (thin) |

Two consequences worth stating:

- **Recently is not an activity.** It is an index over the other four. It never owns content, which is why it can be capped at 50 rows and rebuilt at any time.
- **There is no sixth area for "Tools" or "Services".** A catalogue of what WAM can do is a picker inside the intent input, not a destination. If it ever needs a home, that is a sign the intent input is failing.

`design/…plan.md` §4–§10 specifies the internals of each area. The decisions that shape them (one note, one scope; context-scoped typed tabs; mirrored process controls) are argued there and are not reopened here.

---

## 11. What the first release has to close

**[P]** Five sentences. A release that satisfies all five is usable; one that satisfies four is a demo.

1. **Sign in, land, find yesterday.** A returning user reaches the object they were last editing in under 15 seconds, without typing a query.
2. **Put something in, take something out.** Upload a file, see it in the tree, open a preview, reference it from a note and from a board card, and have both references survive a reload.
3. **Delegate once, end to end.** Submit one process, watch its state change live, receive one artifact into the workspace with a provenance link back to the run.
4. **Know the cost.** See remaining credits and the plan's limits, and see what the last run consumed.
5. **Enter as a member.** An invited user lands in the org workspace, sees only what they may see, and cannot reach admin surfaces.

Explicitly **not** in the first release: real-time collaboration, mobile, dark mode, semantic search, board nesting, note sharing across scopes, process types beyond one, offline, public sharing links.

---

## 12. Open questions

Product-level only. Technical and integration unknowns are N1–N7 in `docs/architecture/application.md`; the twelve UI-level questions live in `design/…plan.md` §13.

| ID | Question | Why it blocks | Default if unanswered |
| --- | --- | --- | --- |
| O1 | Does a note belong to exactly one scope? | Decides the note table and the Notes list query | Yes, one scope (`design/…plan.md` Q1) |
| O2 | Is Recently global or per workspace? | Decides whether the index carries a workspace id | Global |
| O3 | Do the four process types change behaviour, or only the label? | Decides whether the run view is one layout or four | One type, label only |
| O4 | Does the sidebar show counts? | Small, but it changes every row's layout | No |
| O5 | Can an organisation workspace hold a board that references a personal file? | Cross-scope reference is the first place the ownership model leaks | No — reference requires a grant |
| O6 | What does a user with zero personal workspaces see on landing? | J8 depends on it; so does the org-member first run | An org workspace, with a "create a personal one" affordance |
| O7 | Is there a "trash", and who can restore? | Deletion semantics affect tabs, references, and every list | Soft delete, 30 days, owner restores |

---

## 13. What changed in this document relative to `AGENT.md`

Recorded so nobody has to diff two documents by hand.

| `AGENT.md` says | This document | Why |
| --- | --- | --- |
| Thylas is "a cloud service integration platform and a user-facing application" | Integration is the *mechanism*; application is the *form*. The identity is the application layer, defined by state ownership (§4) | "Platform" invites building a marketplace of services, which §5.3 and the capability model both reject |
| Rym's ownership "remains subject to further definition" | Rym is not called by Thylas at all; WAM is its caller (§8 row 25) | Avoids two components holding model credentials and two billing paths |
| Knock is "not assumed to belong inside Thylas" | Explicitly out of scope, link-out at most | Making it a row in the matrix stops it reappearing as a sidebar item |
| Boundaries are to be investigated | Three specific boundaries are predicted to break first, with rules (B1–B3) | A list of principles does not survive contact with an implementation |
