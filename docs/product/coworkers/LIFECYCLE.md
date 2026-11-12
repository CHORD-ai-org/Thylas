# Coworker lifecycle and management

## 1. Three statuses that are not one **[C]**

The most common Coworker-status mistake is merging three different facts into one
badge. They stay separate:

| Status layer | Question it answers | Who owns it | Values |
| --- | --- | --- | --- |
| **Availability** | Is this Coworker *enabled* as an entity? | Thylas (product state) | active · paused · archived |
| **Runtime execution** | Is WAM *executing something for it right now*? | WAM | idle · running · waiting · failed (WAM's vocabulary, rendered as reported) |
| **Current-work state** | Where does each *work item* stand? | Thylas record, fed by real signals | in progress · waiting · done · failed |

A paused Coworker has no runtime status at all. An active one may be idle. A running
one may have three work items in different states. The UI never collapses them.

## 2. The lifecycle **[C]**

```
   CREATE ──▶ CONFIGURE ──▶ ACTIVE ──▶ PAUSED ──▶ ARCHIVED
                 │             │  ▲        │
                 │             │  └────────┘  (resume / re-pause freely)
                 │             │
                 │             └── works across memberships
                 │                 (add/remove workspaces anytime)
                 └─ configuration is editable in every state except ARCHIVED
```

No deeper state machine is imposed: the lifecycle has **one product state
(availability)** plus the two runtime layers above. Everything else is activity-log
detail.

## 3. Stage-by-stage **[C] with [P] mechanics**

| Stage | What happens | Rules |
| --- | --- | --- |
| **Creation** | Name + description + responsibilities minimum (the config page's essential fields). | Created as **active**; a Coworker with no memberships works nowhere yet — and that is fine. |
| **Configuration** | Responsibilities refined; workspace memberships added with grants. | Editable any time; every change is an activity entry. |
| **Activation** | Automatic on creation; `paused` is a user choice, not a default state. | A paused Coworker keeps its record, history, and memberships — it only stops being a participant that can be engaged. |
| **Workspace participation** | Joins/leaves workspaces per [`WORKSPACE-RELATIONSHIP.md`](WORKSPACE-RELATIONSHIP.md) §4. | Removal never rewrites the work record. |
| **Ongoing work** | Conversations, runs, proposals accumulate under its attribution. | Current Work reflects real signals only. |
| **Pause** | Reversible, immediate: conversations can't start; existing memberships go inert. | Runtime executions in flight: WAM's call — Thylas renders what WAM reports **[C]**. |
| **Archival** | The terminal product state: read-only record, out of every picker, memberships inert. | Never deletes history or attribution. |
| **Restoration** | Archived → active, everything resumes as it was. | Allowed — archiving is a shelf, not a shredder. |

## 4. Deletion — deliberately constrained **[P]**

- Deleting a Coworker is possible only when it has no work record beyond conversations,
  or as an explicit two-step (archive → delete after review) **[P]**.
- Attribution is permanent: artifacts it produced keep "authored by" even if the
  Coworker is gone. The same rule as workspace members in the seed data
  (`data/mock.ts`'s Org · Member model).
- Deletion UX, if built, must show what will dangle or be lost — the inline-confirm
  pattern the artifact detail uses **[I]**.

## 5. What pausing means, precisely **[C]**

| Paused blocks | Paused does not block |
| --- | --- |
| New conversations; new runs; new proposals | Reading its history; reading its artifacts; editing its config |
| Its memberships from engaging it | Its record in workspace participant lists (shown as paused) |
| Runtime engagement (WAM is told it is paused **[P]**) | Restoration of every setting on resume |

## 6. What this does not decide **[Q]**

- Whether archival cascades to memberships visually in every workspace or only on
  lookup — a render question, cheap either way.
- Whether paused Coworkers can be configured (lean yes: config is offline work) —
  default yes until it hurts.
- Scheduled availability ("this Coworker works only when engaged") — no scheduler
  exists; not designed.
