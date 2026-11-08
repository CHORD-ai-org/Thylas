# SP-05c · Note library, search, panel

**Parent:** [SP-05](SP-05-notes-and-documents.md) · **Days:** 1.25 · **Status:** Completed 11-08 · **Depends:** SP-05b

## Objective

Make 50 notes navigable: a list that groups by scope, a search that finds body text, a panel that shows backlinks, and wikilink chips that behave like links.

## Scope

**In:** list with scope filter and folder grouping; title uniqueness enforcement (rename conflicts inline); search over title+body; wikilink rendering (resolved/dangling) + `[[` autocomplete; panel with outgoing links and backlinks; empty states; new note; delete with confirmation.
**Out:** tags, graph view, export, documents preset.

## UX

- List 236px, rows 44px: title + "scope · edited".
- Search box filters as you type (200ms debounce), highlighting is not required; an empty result names the scope searched.
- A new note starts untitled and focused; saving without a title uses "Untitled" plus a counter, and the list shows it in `--ink-3`.
- Clicking a wikilink opens that note; a dangling link offers "create note named …".
- Renaming to an existing title in the same scope is refused inline, not silently deduplicated.
- Panel: outgoing (from the body) and incoming (backlinks), each row clickable; "linked from 3 notes".

## Visual

Parent §E. Chips: 2px radius, 1px line, 13/20, no fill; dangling = dashed border, `--ink-3`. Panel sections use `grammar.label`. No accent outside the link chip hover-free treatment.

## Technical plan

- `NotesPage.tsx` composes list + editor/reader + panel (existing three-column shell).
- `useNotes()` hook over the SP-05a store: `list`, `search`, `save`, `create`, `remove`, `links(id)`, `backlinks(id)`.
- Autocomplete: `@codemirror/autocomplete` with a source over note titles, triggered on `[[`.
- Rendering: reader mode replaces link tokens with chips (a small Markdown-to-React renderer for the subset: paragraphs, h2, lists, quote, code, links, `[[ ]]`).
- Search is a substring scan over the in-memory index; 50 notes needs no index structure.

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | List + filter + empty | 50 notes scannable |
| T2 | Search | Body text finds the note |
| T3 | Chip render + autocomplete | `[[` completes; click opens |
| T4 | Backlinks panel | Count and rows correct |
| T5 | Create/rename/delete rules | Unique titles, confirm delete |

## Result

| # | Task | Result |
| --- | --- | --- |
| T1 | List, filter, empty | done — rows carry `tabIndex` so a list costs one Tab, and ↑/↓ move between them (audit A8); the empty state names the search term and the scope |
| T2 | Search | done — 200 ms debounce over titles **and** bodies; the footer reads `2 of 6 notes` |
| T3 | Chip render + autocomplete | done — typed `[[` opens a picker over the titles this note may reach, and choosing one inserts the closing brackets too |
| T4 | Backlinks panel | done — `Links out (N)` and `Linked from (N)`, each row opens that note; built per render, so a delete updates the count without a reload |
| T5 | Create / rename / delete | done — the dangling chip creates the note it names; rename refuses a duplicate in the same scope; delete asks once and says there is no undo |

**Beyond the plan, present:** the panel is now `Links out` / `Linked from` / `Delete` instead of a `References` block that showed files; the list footer counts what is filtered against what exists.

**Deviations:** (1) Search is a field in the list rather than only a palette entry — the palette is a jump surface, and a reader looking for a phrase in a note wants to see the results as a list. (2) The delete confirmation is inline in the panel, not a dialog: same two-press pattern as a dirty tab. (3) `⌘K` does not yet index note bodies; the plan's validation line for that is open (see below).

## Acceptance

1. Search "tokenizer" returns every note containing it, including one where it appears only in the body.
2. `[[` shows a picker filtered by what follows; `esc` closes; `↵` inserts and the chip resolves.
3. Renaming to a duplicate title in the same scope is refused with a visible message; renaming in another scope succeeds.
4. A note linked from two others shows exactly two backlinks; deleting one source updates the count after reload.
5. Empty states: no notes, no results, no backlinks — each names the scope.
6. List rows and chips meet contrast on both grounds.

## Validation

e2e: create → link → backlink → search → delete. Screenshots of list with 12 notes, chip states, panel. Keyboard: `⌘K` palette finds a note by body text.

## Risks

- Markdown rendering subset must be explicit; stray HTML in a note must render as text, never as markup (no `dangerouslySetInnerHTML`).
- Title-based links make rename cheap but deletion leaves dangling chips; the "create this note" action is what keeps that from feeling broken.
