# External knowledge integrations — Notion and Obsidian

## 1. The frame **[C]**

Two questions decide everything about an external integration, and they are separate:

1. **Who owns the system of record?** — where the authoritative definition lives.
2. **What crosses the boundary?** — content, reference, or nothing.

The default answer is conservative: **external-owned assets keep their system of
record; Thylas holds references and, where asked, imports.** Not everything external is
copied in, and not every artifact type syncs out — both directions are explicit,
opt-in, and per-artifact.

## 2. The four kinds of presence **[C]**

| Kind | Meaning | Identity | Provenance |
| --- | --- | --- | --- |
| **Native artifact** | Born in Thylas; Thylas is the system of record. | Canonical artifact id | Authorship + lifecycle in Thylas |
| **External reference** | A link to a Notion page / Obsidian note, rendered in place. **[P]** | Stays with the external system | "External · Notion · last opened" — Thylas asserts nothing about its truth |
| **Imported artifact** | Content copied into Thylas once (or re-imported by hand); becomes a **native artifact** with external origin recorded. | New canonical id in Thylas | Provenance names source system, page, author, import date |
| **Derived artifact** | Built in Thylas *from* external content (e.g. an analysis of an Obsidian note). | Native id + `derived-from` external reference | Both worlds recorded |

Rulings:

- **[C]** An imported artifact never silently updates when the source changes. Re-import
  is an explicit action that creates a **new version** (or a new artifact) with the
  provenance noted — the lifecycle rules of [`LIFECYCLE.md`](LIFECYCLE.md) apply.
- **[C]** An external reference never becomes an artifact by existing. Turning it into
  one is the explicit "import" decision.
- **[P]** Round-trip sync (edit in Thylas → write back to Notion/Obsidian) exists only
  for artifacts whose **declared system of record is the external system**, is
  per-artifact, and marks every Thylas-side field read-only-in-Thylas. Syncing is
  deferred until the persistence layer exists (it cannot be honest before that).

## 3. Notion specifics **[P]**

- **Shape:** Notion is a structured system — pages, databases, properties. An import
  can therefore map more than text: database rows toward artifact instances, property
  values toward spec fields where a matching spec exists.
- **Lossiness:** Notion blocks → Thylas content is lossy in both directions (embeds,
  synced blocks, unknown block types). Imports record what was dropped **[P]**.
- **Connection:** rides the Connect surface (`development/user-connect/`) — a Notion
  integration is an authorized connection; **a connection grants access to what the
  user scopes, never to "everything Notion"** (the Connect honesty rule applies here
  unchanged).

## 4. Obsidian specifics **[P]**

- **Shape:** a vault of Markdown files the user owns locally. The natural unit is the
  **file**, which fits Thylas cleanly: an Obsidian note imports as a native artifact
  with the file's content, front-matter mapped where interpretable.
- **Links:** Obsidian `[[wikilinks]]` between imported notes map to artifact relations
  where both endpoints import; otherwise they are preserved as text.
- **A vault can be a live folder** — for users whose Obsidian vault *is* their system of
  record, the folder-connector pattern (read + watch) is the honest integration; the
  vault stays the record, Thylas indexes and references it.

## 5. Ownership and attribution rules **[C]**

1. Every imported or derived artifact carries source attribution, permanently — system,
   location, author, date. Provenance does not fade after import.
2. Deleting the external source does not delete an imported artifact; it marks the
   provenance "source no longer resolvable".
3. A native artifact synced outward is marked as **mirrored** in the external system —
   readers in Thylas see that the canonical copy lives elsewhere and that local edits
   are disabled.
4. Conflict handling for two-way mirrors **[P]**: last-writer-wins is never silent —
   conflicts surface for review, the same pattern as concurrent artifact editing
   ([`LIFECYCLE.md`](LIFECYCLE.md) §4).

## 6. What is deliberately out of scope **[C]**

- **Full-fidelity bidirectional sync** for arbitrary content — the block models differ
  too much, and pretending otherwise produces silent corruption.
- **Universal search across external systems** — search follows the same permission and
  connection scoping as everything in Connect.
- **Assuming Notion/Obsidian content is trustworthy** — external references and imports
  carry the source's provenance, and their trust posture is "external" until a human
  upgrades it (see [`GOVERNANCE.md`](GOVERNANCE.md) §2).
- Execution-type artifacts (scripts, apps) syncing outward — there is no honest home
  for them in either system **[C]**.

## 7. Sequencing **[P]**

1. **First:** Obsidian vault read/watch (folder-connector; file-native; lowest risk).
2. **Second:** Notion import (API; block mapping; provenance recording).
3. **Later:** external references rendered in-place; then selective two-way mirrors —
   only after persistence and the artifact registry exist.
