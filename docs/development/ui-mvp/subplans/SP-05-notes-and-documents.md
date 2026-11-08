# SP-05 · Notes and documents

**Status:** Blocked on Q-1 (D-002) · **Depends:** SP-04 · **Blocks:** SP-09
**Absorbs:** plan/05 and the editor half of `tech-stack.md` ADR-008 (superseded).

**Units:** [SP-05a](SP-05a-note-model.md) — note model, store, link parser, backlinks (1d) · [SP-05b](SP-05b-editor-and-save.md) — editor, save, conflict, dirty guard (1.75d) · [SP-05c](SP-05c-note-library.md) — library, search, panel (1.25d). Only SP-05b depends on Q-1; 05a is pure logic and can start now (see [SP-05-plan](../SP-05-plan.md)).

## A. Objective

A Markdown-first writing surface that can be lived in: type, save, link with `[[ ]]`, and find what links back. One engine; documents are a preset, not a second product.

## B. Scope

**In:** CodeMirror 6 editor with Markdown syntax; `[[wikilink]]` autocomplete + click-through; backlink index computed on save; note list with scope filter and folder grouping; search over titles and bodies; autosave (idle 800 ms); conflict review (version + 409-equivalent); dirty-tab guard; local persistence.
**Out (optional):** a separate Documents surface with a reading preset (only if SP-05 has slack); tables; images; collaborative editing; export.

## C. Dependencies

SP-04 (references), Q-1 approval, `interaction-contract.md` §3 (dirty tabs), `typography.md` (read step 16/26 at 660).

## D. UX specification

- New note starts as an empty title + body; the title is the first heading or the filename.
- Typing `[[` opens a picker of notes; the link renders as a chip in reading mode and is a plain token in edit mode.
- The panel shows: scope, edited time, outgoing links, and **backlinks** ("linked from N notes"), each clickable.
- Save is automatic; a failed save shows inline error under the title with retry. Closing a dirty tab asks save/discard/cancel in the strip, never silently.
- Reading mode is the default for a note you did not just edit.
- Search: a palette entry filters notes by title/body; no separate search page.

## E. Visual specification

Reading column 660, 16/26 (CJK +1% tracking). Editor uses the same measure and the same 16/26 so switching modes does not reflow. Title 32/40. Wikilink chip: 2px radius, 1px line, mono? No — UI 13/20 in a 2px-radius chip; unresolved link is dashed. No syntax colours beyond accent for links.

## F. Technical plan

- `src/pages/notes/NoteEditor.tsx` — CodeMirror 6 instance, markdown extension, keymap, update listener → draft state.
- `src/lib/markdown/links.ts` — parse `[[target]]`, `[[target|alias]]`; pure, tested.
- `src/lib/markdown/backlinks.ts` — build reverse index from note bodies; pure, tested.
- `src/features/notes/store.ts` (or `state/notes.tsx`) — notes in `localStorage` `thylas:notes:v1`; version per note; save mutation is local but shaped like a server call (so replacing it later is mechanical).
- `src/pages/Notes.tsx` — list, scope filter, editor/reader toggle, panel.
- Dependencies: `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`, `@codemirror/commands`, `@codemirror/autocomplete` (six packages, one engine).

## G. Implementation tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Link parser + tests | 8 cases incl. alias and dangling link |
| T2 | Backlink index + tests | Reverse map correct after rename |
| T3 | Editor mount, markdown, save loop | Text survives reload |
| T4 | Wikilink autocomplete + click-through | `[[` opens picker; click opens note |
| T5 | Backlinks in panel | "linked from 2 notes", navigable |
| T6 | Dirty guard + conflict review | Two-tab edit cannot lose text |
| T7 | List/filter/search | Palette finds a note by body text |

## H. Acceptance criteria

1. Create → type → reload: text identical, including `[[links]]`.
2. A note linked from two others shows exactly those two backlinks.
3. Two tabs editing one note: second save offers review, never silently overwrites.
4. Closing a dirty tab offers save/discard/cancel; `beforeunload` warns once.
5. Editor and reader share the 660/16-26 measure (no reflow on toggle).
6. `npm test` covers link parsing and backlinks; e2e covers create+link+reload.

## I. Validation

Unit tests for the two pure modules; e2e: create, link, reload, conflict; screenshots of editor and reader at 1440; keyboard: `⌘B`, `⌘K` link, `esc`.

## J. Risks and open questions

- **Six CodeMirror packages** is the largest dependency addition in the program; if the bundle exceeds budget, ship a textarea + preview first (documented fallback).
- Wikilinks are a syntax Thylas invents; write the rule down (`lib/markdown/README` comment) before shipping.
- Storage shape: one JSON blob vs one key per note — choose per-note to avoid rewriting everything on each save.
