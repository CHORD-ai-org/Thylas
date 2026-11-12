# Coworker configuration

## 1. The principle **[C]**

Configuration is what the user must decide **once** so the Coworker works **without
being re-explained**. Every field earns its place by answering: *does this change what
the Coworker does, may it touch, or how results are judged?* Everything else is
deferred, not designed.

Six sections, in the order users meet them:

## 2. Identity **[C]** — essential

| Field | Why | MVP |
| --- | --- | --- |
| **Name** | The handle everywhere — membership lists, attribution, conversations. | Required. |
| **Description** | The brief users read back; also the summary surfaces render. | Required. |
| **Visual mark** | A colour + two letters (house pattern); optional avatar later. | Auto-generated mark; upload deferred **[P]**. |

## 3. Responsibilities **[C]** — essential

The standing brief ([`IDENTITY-RESPONSIBILITIES.md`](IDENTITY-RESPONSIBILITIES.md) §2):
responsible-for / not-responsible-for / what good output looks like.

- **MVP:** three free-text blocks, editable any time, shown read-only to collaborators.
- **Deferred:** structured slots, acceptance-criteria checklists, brief templates, and
  per-workspace brief overrides beyond the membership role.

## 4. Knowledge and Context **[P]**

What the Coworker may draw on beyond per-conversation attachments.

| Item | What users configure | MVP? |
| --- | --- | --- |
| **Artifact access** | Granted artifacts/references (read, run, propose) — per [`ARTIFACT-RELATIONSHIP.md`](ARTIFACT-RELATIONSHIP.md) §4. | Grant list only — yes. |
| **Declared knowledge** | Pinned canonical artifacts it should always "know" (a standard, a glossary). | A short pinned list — yes, cheap and high value. |
| **External connections** | Notion/Obsidian scopes, if the user chooses to grant their connection | Deferred — connections are user-level today; Coworker-scoped external grants need the permission model. |

Ruling **[C]**: context is **declared and visible**, never ambient. The config screen
shows exactly what the Coworker can reach — the Chat context bar's honesty rule applied
to a persistent entity.

## 5. Workspace Access **[C]** — essential at add-time

Membership records with role + per-category grants
([`WORKSPACE-RELATIONSHIP.md`](WORKSPACE-RELATIONSHIP.md) §2).

- **MVP:** add/remove to workspaces; per-membership role text; grants in three toggles
  (resources / artifacts / toolsets) with explicit lists where possible.
- **Deferred:** grant templates ("reviewer preset"), negotiated access, access requests.

## 6. Toolsets **[C]** — essential as *grants*, deferred as *management*

- **MVP:** a simple grant list per membership — which toolsets this Coworker may call
  here. What a toolset *is* technically is WAM's runtime concern; Thylas records
  grants and renders usage.
- **Deferred:** toolset creation/editing in Thylas, per-tool fine-grained permissions,
  spend limits. The Coworker UI must not pretend to manage WAM's runtime registry.

## 7. Behavior and Working Preferences **[P]** — deferred, with one exception

- Verbosity, proactivity, tone: deferred — they are runtime behaviours WAM owns, and
  MVP has no runtime to observe them against.
- **The one exception (MVP):** nothing. Preferences stay out until WAM exposes them.
  A dropdown that changes nothing is a lie, and the product does not ship lies.

## 8. The config surface, as one screen **[P]**

```
── Coworker: Protocol Reviewer ──────────────────────── [ACTIVE]
   Name · Description · Mark
   Responsibilities   responsible for / not for / good output
   Workspaces         Research (reviews protocols) · Onda Lab (drafts tables)
   Context & Access   pinned artifacts · granted resources · toolsets
   Activity           recent work, config changes
```

One page, sections in that order, nothing tabbed — the Coworker is one entity and its
config should read like one brief, not a settings maze.

## 9. What this does not decide **[Q]**

- Model selection per Coworker (deferred with multi-model routing).
- Who may edit a Coworker's config (creator-only vs workspace maintainers) — org model.
- Config versioning: whether config changes are themselves attributed history entries —
  likely yes via the activity log; shape undecided.
