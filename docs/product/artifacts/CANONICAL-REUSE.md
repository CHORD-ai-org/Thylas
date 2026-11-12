# Canonical artifacts and cross-workspace reuse

## 1. The problem **[C]**

A concept is defined in Workspace A. Coworkers in Workspaces B and C must discover and
use it — but **local use must never modify the original definition**. The model that
solves this, in one line:

> **One canonical artifact, one authority, many references. Local work happens on
> local objects; agreement happens through proposals.**

## 2. The model **[C] with [P] mechanics**

```
Workspace A (home)                     Workspace B                Workspace C
┌──────────────────────────┐   reference   ┌──────────────┐   reference  ┌──────────────┐
│ Concept "Noise Floor"    │◀───(pinned v3)─│  usage, notes │◀──(current)──│  usage       │
│ [ACCEPTED · authority:   │               └──────────────┘              └──────────────┘
│  ceaser · v3 current]    │◀──────────────── proposal: "add a counter-example" ────────┘
│  v1 ─ v2 ─ v3 (history)  │
└──────────────────────────┘
```

| Concept | Ruling |
| --- | --- |
| **Canonical artifact** **[C]** | Exactly one authoritative definition. Its home workspace + maintainers hold **authority** (see [`GOVERNANCE.md`](GOVERNANCE.md)). Identity is the canonical id. |
| **Reference** **[C]** | A pointer another workspace holds — *to the artifact*, optionally pinned to a version. A reference is not a copy: it renders the canonical content, read-only. |
| **Pinned vs current** **[P]** | A reference may track the **current** accepted version (it stays live) or be **pinned** to a specific version (results stay comparable). Choice belongs to the referencing workspace; runs pin by default (see [`METHODOLOGY.md`](METHODOLOGY.md)). |
| **Derived object** **[P]** | A local artifact that *builds on* a canonical one (a workspace-specific application). It carries a `derived-from` relation with the source version — it is a new artifact with provenance, never an edit of the original. |
| **Local copy** **[P]** | Detaches entirely: becomes a separate canonical artifact whose provenance names its origin. For when a workspace wants to fork. Deliberate, visible, rare. |

## 3. Discovery **[P]**

- Discovery spans workspaces the user's references and memberships reach — **not
  everything**. Access comes from permissions, and "a workspace can see every
  artifact" is false by construction (see
  [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §permissions).
- Discovery surfaces: search (title, spec fields, content), the relation graph
  ("what does this Product reference"), and explicit sharing (a maintainer offers a
  canonical artifact to a workspace, creating the reference).
- A canonical artifact's **spec travels with it** (see
  [`USER-DEFINED-OBJECTS.md`](USER-DEFINED-OBJECTS.md) §2) — discovering a Product
  means discovering its structure.

## 4. Identity format **[P]**

- Canonical ids are globally unique and location-independent; the home workspace is an
  attribute, not the identity's namespace. (Format — opaque id vs human-readable key —
  **[Q]**, see [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §identity.)
- A reference records: canonical id + version (pinned) or channel (current) + the
  referencing workspace. Rendering a reference requires the access check at read time.

## 5. Permissions **[P]**

| Level | Meaning |
| --- | --- |
| **Visible** | Can discover and read the canonical artifact through a granted reference. |
| **Usable** | Can create references, derived objects, and run/executable use in the referencing workspace. |
| **Proposer** | Can send change proposals back to the source. |
| **Maintainer** | Can change the canonical content and authority. |

Defaults: references grant Visible + Usable; Proposer/Maintainer are granted
explicitly. Every cross-workspace read is permission-checked at read time — access is
never inferred from "the coworker is in a workspace that once referenced this".

## 6. Change notifications **[P]**

When a canonical artifact moves (new accepted version, deprecation):

- **current** references surface an "artifact moved ahead" signal in their workspace's
  activity — the referencing workspace chooses when to re-read;
- **pinned** references get no content change but receive the deprecation signal if
  their pinned version is deprecated;
- notifications land in the workspace activity feed — no email, no push, in-product
  (consistent with the notifications posture in `product/definition.md`).

## 7. Local feedback: proposals, not edits **[C]**

A coworker in Workspace B who believes the canonical definition should change sends a
**change proposal** to the source maintainers — content, reasoning, provenance. The
proposal enters the source artifact's lifecycle as a review item
([`LIFECYCLE.md`](LIFECYCLE.md) §2); acceptance applies it as a new version attributed
to the proposer, *accepted by* the maintainers. B's own local work proceeds on a
derived object meanwhile.

## 8. What this does not attempt **[Q]**

- Global search across all of a company's workspaces (discovery is permission-bounded).
- Automatic propagation of changes into derived objects (derivation is a snapshot with
  provenance; staying in sync is the derivator's choice).
- Offline copies beyond what the export paths provide.
