# Coworker scope — decisions, MVP, and open questions

The closing register. Sections 1–3 are the decisions record (also in
`../ui-mvp/DECISIONS.md`, D-054); 4–6 are the build order.

## 1. Confirmed product decisions **[C]**

1. **The definition holds**: an independent, persistent AI work entity — not a chatbot,
   not a prompt, not a conversation, not a WAM agent wrapper.
2. **Identity ≠ a system prompt.** Responsibilities are structured, user-authored,
   visible configuration (responsible-for / not-for / good output).
3. **Responsibilities ≠ Toolsets ≠ Methodologies.** For / may-do / how-done-well —
   three different config concepts.
4. **Membership ≠ access.** Every access category is configured per membership;
   intersection with the Coworker's own config is the effective grant.
5. **Context is declared, never ambient.** The config screen and the working
   experience both render exactly what the Coworker may reach.
6. **Multiple Coworkers in one workspace ≠ a multi-agent system.** No global
   orchestration, no supervisor Coworker, no Thylas-side swarm planning.
7. **A2A belongs to WAM.** Thylas stores connection handles and renders what is
   delivered.
8. **Artifact verbs stay six and separate**: discover / reference / understand /
   apply / create / propose — apply never mutates the method, create never overwrites
   the authoritative version.
9. **Three status layers stay separate**: availability, runtime execution, current-work
   state.
10. **Attribution is permanent.** Removal, pause, and archiving never rewrite the work
    record.
11. **Config honesty**: a control that changes nothing ships nowhere (working
    preferences deferred until WAM exposes them).

## 2. Proposed decisions **[P]** — reviewed, ready to build against

1. Membership record = role + three grant categories (resources / artifacts /
   toolsets), per-workspace role override.
2. Responsibility brief = three free-text blocks at MVP.
3. Current Work items = `{objective, status, linked artifacts, linked runs, times}`,
   aligned with the Processes status vocabulary.
4. Lifecycle = active / paused / archived (single product state + the two runtime
   layers), archive reversible.
5. Config screen = one page, six sections, no tabs.
6. Visual identity = colour + two-letter mark at MVP.

## 3. Unresolved questions **[Q]**

| # | Question | Where it bites | Decider |
| --- | --- | --- | --- |
| Q1 | Coworker ↔ WAM agent mapping: persistent agent vs per-session instantiation | WAM contract; UI is agnostic | WAM team |
| Q2 | Permission model: who grants what (org roles), revocation semantics | Workspace access; cross-workspace reuse | Product + org model |
| Q3 | Can Coworkers hold authority over canonical artifacts? | Artifact governance | Product (leans: no, humans hold authority) |
| Q4 | Persistence: where Coworker records live once server-side | Everything server-side | D-052 sequencing |
| Q5 | Model preference per Coworker | Config; multi-model routing | Deferred |
| Q6 | A2A transport relay (if outages demand one) | A2A boundary | WAM team; transport-only if ever |
| Q7 | Sharing a Coworker between users (not just workspaces) | Org model | Deferred |
| Q8 | Structured responsibility slots vs free prose at MVP | Config UI | Product — lean prose |
| Q9 | Proactive artifact surfacing by Coworkers | Working experience | WAM capability call |

## 4. MVP capabilities **[P]** — the first build

1. **Coworker records**: create (name, description, responsibilities brief), edit,
   list — the config page, one screen, six sections.
2. **Workspace membership**: add/remove Coworkers to workspaces with a role text and
   simple grants; participant lists show paused/archived states.
3. **Coworker page**: conversation (chat dock reuse), Current Work (honest items only),
   Artifacts (produced/proposed, reusing library rows), Activity (the log).
4. **Artifact integration**: the detail-page Coworker action **[I]**; artifacts the
   Coworker creates land as attributed drafts/proposals via the B2 pattern.
5. **Status honesty**: three-layer status rendering; pause/archive with the rules of
   [`LIFECYCLE.md`](LIFECYCLE.md).

Not in MVP: runtime execution, A2A rendering, external connection grants, working
preferences, cross-user sharing, permission negotiation.

## 5. Deferred capabilities **[P]**

- Structured responsibility slots and brief templates.
- Grant presets, access requests, negotiated access.
- External connection scopes per Coworker (Notion/Obsidian behind the permission model).
- A2A transcript rendering; multi-Coworker runtime visualization.
- Model preferences; per-Coworker spend/limit reporting.
- Scheduled availability; Coworker "teams" or grouping.

## 6. Dependencies on WAM or other backend systems **[C]/[P]**

| Dependency | Blocks | Status |
| --- | --- | --- |
| WAM contract (agent mapping, run attribution, state feed) | Current Work truth; execution controls | Not yet — product model is agnostic (Q1) |
| Server-side persistence (D-052) | Coworker records beyond one browser; cross-workspace anything | Not yet — client envelopes first |
| Permission model (org roles) | Workspace grants; cross-workspace reuse | Not yet — Q2 |
| Connect-level scoped external grants | Coworker-scoped external access | Not yet — deferred |
| A2A protocol | Any coworker-to-coworker feature | WAM-owned; Thylas renders only |

The dependency order is the build order: records and config now; membership + honest
working surfaces on client state; the rest lands as its backend arrives — the product
model above does not move.
