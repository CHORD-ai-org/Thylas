# Coworker and Workspace relationship

## 1. The model **[C]**

```
Workspace A ── membership (role: reviews protocols) ──┐
                                                      ├──▶ Coworker
Workspace B ── membership (role: drafts tables) ──────┘   (independent identity,
                                                         independent lifecycle)
```

- **[C]** A Workspace can contain **multiple Coworkers**.
- **[C]** A Coworker can participate in **multiple Workspaces**.
- **[C]** Coworker and Workspace have **independent identities and lifecycles** —
  deleting one does not delete the other.
- **[C]** **Membership does not imply unrestricted access.** Joining a workspace is a
  relationship; every access kind is configured separately.
- **[C]** Coworkers are **reusable across working environments** — that is the point of
  the independent entity.

## 2. What a membership consists of **[P]**

A membership record (workspace ↔ coworer) carries, per relationship:

| Element | Meaning | Default |
| --- | --- | --- |
| **Role** | The short statement of what this Coworker does *here* — may be narrower than its global responsibilities. | Inherits the Coworker's brief, editable per workspace. |
| **Resource access** | Which workspace resources it may read/use (files, notes, boards). | Explicit grants; nothing by default. |
| **Artifact access** | Which artifacts it can see, reference, or propose against. | Explicit grants; see [`ARTIFACT-RELATIONSHIP.md`](ARTIFACT-RELATIONSHIP.md). |
| **Tool access** | Which toolsets it may call *in this workspace*. | Explicit grants. |
| **Status** | Active / paused in this workspace — independent of the Coworker's global status. | Active on join. |

The per-workspace override is the key design move: the same reviewer Coworker can be
"a protocol reviewer" in one workspace and "a draft-table producer" in another, with
different access in each. **[C]** Access is always the *intersection* of what the
Coworker's configuration allows and what the workspace grants.

## 3. Access boundaries in practice **[C]**

- A Coworker sees **nothing** in a workspace it has not been granted — no auto-discovery
  of "every file", no inherited trust from a human member.
- A connection to an external system (Connect) is **the user's**; a Coworker does not
  automatically inherit its scope. If a Coworker needs Notion, that is a configured,
  reviewable grant **[P]**.
- Context boundaries are visible: the workspace's Coworker detail shows exactly what
  has been granted, per category — the same honesty the Chat context bar applies
  (declared context, not ambient access).

## 4. Adding and removing **[C] with [P] mechanics**

| Act | Effect on the Coworker | Effect on the Workspace |
| --- | --- | --- |
| **Add to workspace** | Gains a membership record (role + grants). Nothing else changes. | Gains a participant; the owner configures its grants at add time **[P]**. |
| **Remove from workspace** | Loses the membership and its grants. Its history *in that workspace* stays, attributed — work record is not rewritten. | Loses the participant. Artifacts it produced remain (provenance keeps its name). |
| **Workspace archived** | Memberships become inert; the Coworker is untouched and still works elsewhere. | Archived per the workspace lifecycle. |
| **Coworker archived** | All memberships become inert. Workspaces keep the history; the participant slot shows "archived". | Nothing is deleted. |

Rules:

- **[C]** Removal and archiving never delete the work record. Attribution is permanent
  — "produced by X" survives X's removal.
- **[P]** Re-adding a removed Coworker restores nothing automatically: grants are
  reconfigured; history is still readable because attribution is by record, not by
  live membership.

## 5. What this does not decide **[Q]**

- Whether membership grants are set by the workspace owner, the Coworker's creator, or
  negotiated — leans "workspace owner configures" but needs the org model.
- Whether a Coworker can request access (a proposal into the owner's activity) — likely
  yes later; deferred.
- Per-workspace Coworker naming overrides (same entity, different display name per
  workspace) — cheap if wanted, undecided.
