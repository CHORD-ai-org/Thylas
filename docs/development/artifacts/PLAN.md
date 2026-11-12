# Artifact page — audit + implementation plan

Written 2026-11-12, before code. Product foundation: `docs/product/artifacts/` (D-053).

## 1. Audit summary

- **No artifact page exists.** The only artifact persistence in code is chat's
  artifact block → Save-as-note (`state/notes.ts`, which already versions content —
  `version` + conflict review — the precedent this page generalises).
- **Reusable surface patterns** (verified in code): Notes page = sidebar + content
  (`PlainLayout`); Compute v2 = console shell + tabs + detail grid; User & Connect =
  library/list + detail with side column; Chat = dockable panel with context sources.
- **Navigation**: Rail has global nav (Overview, Recently, Compute, Connect, Chat) +
  library nav (Notes, User); palette "Go" group mirrors it. Artifacts belongs in the
  library group, between Notes and User.
- **State convention**: versioned localStorage envelopes (`thylas:<domain>:v1`),
  validated `read()`, seeds untouched, session facts only, deterministic simulation.
- **Coworker interaction**: the chat dock already renders any conversation with
  context sources. A detail-page "Open Coworker interaction" can open the dock and add
  the artifact as a context source — a real integration with shipped code, not a fake
  AI panel.

## 2. Information architecture (final)

```
Rail: Artifacts (library group)
/artifacts            Library  — hybrid: intro line + view chips + filters + list-first
/artifacts/new        Creation — 5 paths, progressive (name + kind first, details later)
/artifacts/:id        Detail   — type-adaptive sections + side column (relations/history/usage)
```

Library views: All · Recent · Created by me · External (source = external). Filters:
kind, status. List row: name · kind mark · summary · status · updated · source.

Detail: shared header (back, name, kind, status, author/source, updated; actions: Edit,
Coworker, More) + **type-adaptive sections** (kind → section template) + side column
(Relations, Versions, Usage & ownership). Edit is inline per section; saving creates a
new version (append-only, attributed). Status transitions: Accept / Deprecate under
More, with inline confirm.

Creation paths: Start with an idea · Create a methodology · Create a tool or asset ·
Create with a Coworker · Reference an external artifact. All ask name + kind + minimal
first content; "With a Coworker" is an honest prototype notice (no agent runtime); 
"Reference external" creates an external-source artifact (no fake sync).

## 3. Data model (prototype)

```ts
kind: 'concept'|'methodology'|'executable'|'product'|'empirical'|'structural'|'external'
section: { id, title, body }          // kind → section template; body is plain text (markdown-lite later)
artifact: { id, kind, name, summary, status, createdAt, updatedAt,
            author, source: 'native' | { system, location }, sections, relations, versions }
version: { v, at, by, note }          // append-only; edits create versions
```

Store `state/artifacts.ts`, key `thylas:artifacts:v1` — seeds + session facts (created,
edited → versions, status, tombstones), validated read, caps (100 artifacts / 50
versions each). Seven seeds across all kinds, one external.

## 4. Honesty rules carried over

External artifacts are references with a link; **no sync states** (none exist).
Coworker actions open the real chat dock; anything else an agent "would do" is labelled
a prototype. Runs of methodologies are not implemented — the Methodology detail shows
the method, not fake runs.

## 5. Out of scope

WAM, A2A, permissions, graph visualization, real persistence, sync. Unresolved items
land in `docs/product/artifacts/OPEN-QUESTIONS.md` where they already exist.
