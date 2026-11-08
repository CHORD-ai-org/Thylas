# SP-05a · Note model, local store, link parser, backlinks

**Parent:** [SP-05](SP-05-notes-and-documents.md) · **Days:** 1.0 · **Status:** Completed 11-08 · **Depends:** SP-04a

## Objective

Settle what a note *is* before any editor exists: a Markdown body with a version, a local store shaped like a future API, a link syntax, and a derived backlink index. All of it pure and tested.

## Scope

**In:** `Note` domain type; per-note storage keys (`thylas:note:v1:<id>`) plus an index (`thylas:notes:v1`); `lib/markdown/links.ts`; `lib/markdown/backlinks.ts`; migration from the current `data/mock.ts` notes; seed of 6 notes.
**Out:** editor (SP-05b), list UI (SP-05c), attachments, tags.

## UX

Parent §D. This unit defines the syntax that UX depends on:

- `[[Exact title]]` links by title, case-insensitive, trimmed.
- `[[title|shown text]]` keeps the alias for display.
- An unresolved target is a **dangling link**: dashed chip, click offers "create this note".
- Titles are unique per scope; renaming a note rewrites nothing, the link resolves by the new title because resolution is by name at render time.

## Visual

Not applicable in this unit; chip rendering rules are in SP-05c.

## Technical plan

```ts
type Note = {
  id: string; title: string;
  scope: 'personal' | 'workspace'; wsId?: string;
  body: string;            // Markdown, source of truth
  version: number;         // bumped on save
  updatedAt: number;       // epoch ms
};
```

- `parseLinks(body) → { target, alias, index }[]` — regex `/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g`.
- `buildBacklinks(notes) → Map<noteId, noteId[]>` — resolve targets per scope, ignore dangling.
- Store is an interface (`NotesStore`) with a local implementation; a future API adapter swaps in without touching the UI.
- Index is rebuilt on boot from note keys; it is a cache, not a second truth.

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Types + store interface | `list/get/save/remove` with versions |
| T2 | Link parser + 8 tests | alias, whitespace, empty, malformed, duplicate |
| T3 | Backlink builder + 4 tests | rename, dangling, cross-scope |
| T4 | Seed 6 notes from mock | Reader still works |
| T5 | Boot index rebuild | 200 notes rebuild < 50ms |

## Result

| # | Task | Result |
| --- | --- | --- |
| T1 | `Note` type | done — Markdown `body`, `version`, `updatedAt`; the old block array survives as `LegacyBlock`/`LegacyNote` for seeding only |
| T2 | Per-note store + index | done — `thylas:note:v1:<id>` per note, `thylas:notes:v1` index; `saveNote` compares `version` and returns the stored note on a stale one |
| T3 | Link parser | done — `[[Target]]`, `[[Target|alias]]` split on the first pipe, offsets kept, empty target rejected |
| T4 | Backlink index | done — built per call from bodies, scoped (personal cannot reach a workspace), self-links and dangling targets excluded |
| T5 | Seed and migration | done — six sample notes converted by `legacyToMarkdown`, written on first run, `resetNotes()` restores them |
| T6 | `useNotes()` | done — `useSyncExternalStore`; components do not touch storage |

**Beyond the plan, present:** links inside a fenced code block are skipped (the plan recorded this as a v1 limitation; it cost ten lines, and without it the backlink index would claim links a reader never sees). `titlesFor()` is exported so the reader and the index cannot disagree about who can link to whom. The Notes "New" control now really creates a note — the last post-click apology outside Account is gone.

**Deviations:** (1) The sample library is six notes, not eighteen — the earlier count was each row's three spans. (2) `refs` and `minutes` left the type: references are a property of a file, and reading minutes are now derived from the body. The panel's References block is replaced in 05c by outgoing links and backlinks.

## Acceptance

1. `npm test` covers parser and backlinks: 12 assertions, including two notes with the same title in different scopes (no cross-scope backlink).
2. Saving a note bumps `version` and `updatedAt`; reading returns the stored body byte-identical.
3. Deleting a note removes it from the index and from other notes' backlinks.
4. No UI imports the local implementation directly; only the store interface.
5. Reload with 50 seeded notes: index rebuild under 50ms (measured once, recorded).

## Validation

Unit tests; a throwaway script seeds 200 notes and times a rebuild; `npm run check && lint`.

## Risks

- Title-based linking is a product decision, not a technical one: it makes rename safe but makes duplicate titles ambiguous — uniqueness per scope is therefore a *rule* the UI must enforce (SP-05c).
- Per-note keys avoid rewriting everything on save but complicate the index; if the index drifts, rebuild beats repair.
