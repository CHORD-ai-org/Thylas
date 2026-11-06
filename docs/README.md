# docs/ — product and technical definition for Thylas

**Date:** 2026-11-07
**State:** proposed, except `docs/design/` — those four documents describe the UI that now exists in `src/`. The product, architecture, file-plan and roadmap documents remain proposals; the implementation is smaller than the file plan and says where.
**What this directory is:** the layer above the design work. `design/` specifies what the product looks like; `docs/` specifies what it is, where its responsibilities end, how it is built, and in what order.

---

## 1. Read this in this order

| Order | File | Time | What you get |
| --- | --- | --- | --- |
| 1 | [`product/definition.md`](product/definition.md) | 20 min | What Thylas is, what it is not, who owns what, what v1 must close |
| 2 | [`../design/thylas-ui-design-plan.md`](../design/thylas-ui-design-plan.md) §1, §4, §7 | 15 min | The screens and the three structural decisions (notes, tabs, rooms) |
| 3 | [`architecture/application.md`](architecture/application.md) | 20 min | Stack, layering, where each piece of state lives, the WAM boundary |
| 4 | [`planning/file-plan.md`](planning/file-plan.md) | 20 min | Every file, its job, what it must not do, and what is deliberately absent |
| 5 | [`planning/roadmap.md`](planning/roadmap.md) | 10 min | Milestones, gates, the two blocking unknowns |
| 6 | [`design/visual-system.md`](design/visual-system.md) | 10 min | Colour, type, geometry, density — as implemented |
| 7 | [`design/spatial-language.md`](design/spatial-language.md) | 8 min | Zones, nesting, scrolling, responsive rules |
| 8 | [`design/interaction-model.md`](design/interaction-model.md) | 8 min | Routes, tabs, keyboard, what is real vs sample |

If you read only one: `product/definition.md` §8 (responsibility matrix). If you read two: add §9 (the three boundaries that break first).

---

## 2. Map

| Document | Owns | Does not own |
| --- | --- | --- |
| `product/definition.md` | Identity, positioning, responsibility matrix, capability model, v1 exit criteria, product open questions | Screens, components, code |
| `architecture/application.md` | Stack and its costs, layering rules, state ownership, routes, WAM interface, failure handling, test strategy, technical unknowns | Visual design, milestone timing |
| `planning/file-plan.md` | Repository tree, per-file responsibilities, dependency graph, build order, files not to create | What each screen looks like |
| `planning/roadmap.md` | Milestones, scope in and out, acceptance tests, risks, what invalidates the plan | File-level detail |
| `design/*.md` (new) | The visual system, spatial rules, component inventory and interaction contract **as built** | Product boundaries, milestones, anything about WAM |
| `design/` (existing) | Visual system, IA, tabs, rooms, canvas, notes, settings, journeys, wireframes, prototype | Why the product exists; anything technical |
| `AGENT.md` (existing) | The reasoning protocol and the classification framework used above | Any conclusion; it deliberately refuses to decide |

Nothing here duplicates `design/`. Where a decision is already argued there, these documents cite the section instead of restating it.

---

## 3. Audit findings

What the repository actually contains, and the inconsistencies worth fixing.

| # | Finding | Consequence | Recommendation |
| --- | --- | --- | --- |
| A1 | **`thinking.md` does not exist.** `AGENT.md` §6 requires reading it before every session; the user's standing instruction says the same. `find` returns nothing, and no commit ever contained it | Every session starts by violating its own protocol, or by improvising what the file would have said | Either write it (the unresolved questions of the moment, 20 lines) or delete the requirement from `AGENT.md` §6. A rule that is always skipped stops being read |
| A2 | **No application code.** No `package.json`, no `src/`, no framework. `design/` is 4 files, 220KB, all documentation and prototypes | The stack is a greenfield decision, not a migration. This roadmap starts from zero | Confirmed in `architecture/application.md` §1; the choice needs a sign-off, not a discovery |
| A3 | **The working tree has uncommitted work.** `design/README.md` and `design/thylas-ui-design-plan.md` are modified, `hi-fi.html` and `tokens.css` are untracked, and `research/` (Lemma voice material, unrelated) is staged for deletion | A `git checkout` or a bad merge loses the prototype, which is the only artifact with real design content | Commit before starting M0. The prototype has no other copy |
| A4 | **The positioning is stated two ways.** `AGENT.md` §2.2: "a cloud service integration platform and a user-facing application". `design/…plan.md` §1.1: "the application layer". "Platform" invites a service catalogue; "application layer" forbids it | Two documents, two products. A service marketplace and a workspace are different roadmaps | Resolved in `product/definition.md` §4: integration is the mechanism, application is the form. `AGENT.md` should be amended or annotated |
| A5 | **31 claims are marked `[C]` confirmed, with no named confirmer.** The design plan's own key says `[C]` means "decided; reopening requires an argument". Nobody signed | `[C]` on a note-scope decision reads as settled fact when it is one person's reasoning. Implementers will not challenge it, which is the opposite of what the marker is for | Treat `[C]` in `design/` as "strongly argued by the designer" unless a product owner signs. This directory does not raise them to confirmed: see §4 |
| A6 | **All seven user journeys are for one persona.** J1–J7 in `design/…plan.md` §11 assume a user who owns workspaces and pays. The invited organisation member — the persona that makes organisation billing real — has no path | The org feature set can be built and be unusable on first contact | Added as J8 in `product/definition.md` §7, with the question it forces (O6) |
| A7 | **The Account screen shows an Organization block; the boundary says organisation administration is unresolved** | The prototype is ahead of the contract. That is fine for a prototype, dangerous if it becomes an estimate | M5 in the roadmap excludes seat management and gates the block on N2 |
| A8 | **The root README claims "operate agents" and "build with CHORD".** The first is WAM's responsibility, the second is Knock's | A tagline is where scope creep enters: someone will propose an agent builder next quarter | Flagged, not changed. It is brand copy and belongs to whoever owns it. See D15 |
| A9 | **Twelve open questions, zero evidence.** `design/…plan.md` §13 lists them with "how to resolve" plans and no results | The defaults are being treated as answers by default, because the table is the only thing that exists | The three that block screens are restated as O1–O3 with an explicit "default if unanswered" |

---

## 4. Decision register

Four states. A decision may move up (proposed → confirmed) but never silently.

### 4.1 Confirmed — treat as settled

| # | Decision | Source |
| --- | --- | --- |
| D1 | Thylas is the application layer. WAM owns intent, planning, and execution; Thylas never reimplements them | `design/…plan.md` §1.2; `AGENT.md` §2.3 |
| D2 | Five sidebar areas: Overview, Recently, Workspace, Notes, Account. No sixth | `design/…plan.md` §4.2 |
| D3 | Visual direction is Quiet Computationalism; the palette and type ramps in `design/tokens.css` are the source | `design/…plan.md` §3 |
| D4 | One object, one scope. Cross-object relationships are references by id, never copies | `design/…plan.md` §4.1 |
| D5 | Tabs are context-scoped and typed; room tabs pinned and not closable; object tabs closable. One strip per context | `design/…plan.md` §7.1–7.2 |
| D6 | Process controls mirror WAM capabilities. No control exists without a capability | `design/…plan.md` §8.3 |
| D7 | No real-time collaboration, no mobile, no dark mode in v1 | `design/…plan.md` Q3, Q7, Q10 |

### 4.2 Proposed — needs a sign-off, safe to build against

| # | Proposal | Why it is not confirmed | Where argued |
| --- | --- | --- | --- |
| D8 | Vite + React 19 + React Router 7 + TanStack Query + CSS Modules | No stack decision exists anywhere. It is mine, with costs stated | `architecture` §1 |
| D9 | Hand-built canvas; no tldraw or Excalidraw | Licence and visual-control arguments are strong but not decisive; it is the largest estimate in the plan | `architecture` §1.2; `roadmap` M3b |
| D10 | URL is the only location truth; no navigation in a store | Contradicts the reflex to put everything in one store | `architecture` §3 |
| D11 | One narrow WAM interface with a `capabilities()` call | The interface does not exist; WAM may expose something quite different. It is written down to have something to reject | `architecture` §5 |
| D12 | The three boundary rules B1 (authorise at execution), B2 (WAM writes through Thylas), B3 (show quota, never enforce) | They constrain WAM's implementation, which is not ours to constrain alone | `product/definition.md` §9 |
| D13 | Five capabilities map to five activities: orient, organise, think, delegate, administer | This is the test for future navigation requests, so it should be agreed before someone requests a sixth area | `product/definition.md` §10 |
| D14 | Build order puts live Processes (M4) before the board (M3b) | Inverts the intuitive order. Correct if the delegation hypothesis is the product; wrong if boards are the draw | `roadmap` §1 |
| D15 | Root README tagline should drop "operate agents" and "build with CHORD" | Brand copy, not my call | Audit A8 |

### 4.3 Unresolved

Grouped by what they block. Details in the referenced documents.

| Group | IDs | Blocks |
| --- | --- | --- |
| Product | O1–O7 (`product/definition.md` §12) | Notes list, Recently query, run layout, first-run for members |
| Technical | N1–N7 (`architecture/application.md` §9) | Event streaming, auth forwarding, upload, folder ownership, deployment shape, concurrent edits |
| Design | Q1–Q12 (`design/…plan.md` §13) | Overlaps with the above; Q4 and Q11 have no counterpart here and remain design-only |

### 4.4 Rejected — with the reason, so it is not re-proposed

| Rejected | Reason | Where |
| --- | --- | --- |
| Next.js | No public surface; server data layer creates a second authorisation path; the app is client-heavy | `architecture` §1.1 |
| Tailwind | A second numeric scale beside `tokens.css`; drift is guaranteed | `architecture` §1.2 |
| tldraw / Excalidraw | Freeform model, own visual identity, override cost exceeds reuse | `architecture` §1.2 |
| A global (Chrome-like) tab strip | Sidebar and strip would hold two sources of truth for location; cross-workspace tabs leak org content into a personal context | `design/…plan.md` §7.2 |
| Notes as global-only, workspace-only, or two stores | Each breaks either ownership or first-run | `design/…plan.md` §4.3 |
| A global store holding navigation | Duplicates the URL | `architecture` §3 |
| A client-side permission module | B1: the client would become where the real check is forgotten | `file-plan` §7 |
| A generic `Table` component | Three lists with different behaviour; the generic version grows 14 props and gets forked | `file-plan` §7 |
| A sixth sidebar area for tools/services | A catalogue is a picker inside the intent input, not a destination | `product/definition.md` §10 |
| A `[C]` marker as evidence | See A5. Argued is not confirmed | This file, §3 |

---

## 5. What is still missing from this documentation set

Deliberately not written, so their absence is a decision rather than an oversight:

| Not written | Because | When it becomes necessary |
| --- | --- | --- |
| A pricing or packaging document | No pricing exists, and inventing it would harden guesses into requirements | Before M5 |
| An organisation administration spec | Blocked on N2 (who owns authz). Writing it now would describe a service that may not exist | After N2 is answered |
| A canvas interaction spec with numeric thresholds as tests | The thresholds exist in `design/…plan.md` §8.2; turning them into acceptance tests needs the canvas to exist | M3b gate |
| An API contract for Thylas's own backend | Thylas may have no backend. §5 of the architecture doc is the client-side proposal; a server contract depends on N5 | After N3/N5 |
| A migration or data model document | There is no database yet, and the entity model is 5 objects in `design/…plan.md` §4.1 | M1, if a backend is confirmed |
| An i18n plan | No language requirement has been stated. Chinese typography is not free: line heights, punctuation, and a serif with CJK coverage | Before M3, per `file-plan` §7 |

---

## 6. Change log

| Date | Change |
| --- | --- |
| 2026-11-07 | Created. Four documents: product definition, application architecture, source file plan, roadmap. Audit of the existing repository in §3. Decision register in §4 |
