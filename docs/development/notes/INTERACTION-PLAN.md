# Notes — interaction evaluation and Obsidian-parity plan

**Date:** 2026-11-21 · **Status:** evaluation + **[P]** proposed plan. No code changed here.

Method: read the shipped Notes surface (`src/pages/Notes.tsx`,
`src/pages/notes/NoteEditor.tsx`, `src/pages/notes/NoteReader.tsx`,
`src/state/notes.ts`) and compared it against the two things Obsidian is
actually praised for — how it *feels to write in*, and the core loop around a
note. Everything below points at a real file, so the gaps are facts, not taste.

---

## 1. What exists today (honest inventory)

| Area | Today | Where |
| --- | --- | --- |
| Editor | CodeMirror 6, Markdown, line-wrapping, spellcheck, undo/redo | `NoteEditor.tsx:3-110` |
| Wiki-links | `[[` autocompletes to existing note titles | `NoteEditor.tsx:32, 139` |
| Save | Idle autosave 800 ms after typing stops, flush on exit, `beforeunload` guard | `Notes.tsx:32, 138-146, 163-173` |
| Concurrency | Optimistic `version` check; conflict shows "theirs" and offers a forced save | `Notes.tsx:106-118, 478-482`, `notes.ts` |
| Reader | Separate read view with rendered Markdown | `NoteReader.tsx` |
| Backlinks | Incoming + outgoing resolved per note | `buildBacklinks`, `Notes.tsx:226` |
| Find / search | In-note find + library search (title + body), 200 ms debounce | `Notes.tsx:33, 77` |
| Sidebar | Files / Search / Bookmarks, collapsible | `notesUi.ts`, `Notes.tsx:305-353` |
| Keys | `Ctrl+Shift+B` panel, `Ctrl+\` sidebar, `Esc` leaves editor, `Tab` indents, ↑/↓ list nav | `Notes.tsx:254-268`, `NoteEditor.tsx:116-130` |
| Store | Notes in the browser local DB (IndexedDB) + sync cache | `state/notes.ts`, `services/notes/localDb.ts` |

So the skeleton is there: wiki-links, backlinks, autosave, conflict safety,
search. What is missing is the *editor feel* and the *navigation loop* that
make Obsidian feel fast.

---

## 2. Evaluation — two axes

### 2.1 手感 (how it feels to write)

| Obsidian behaviour | Today | Gap | Priority |
| --- | --- | --- | --- |
| Live Preview: Markdown renders *as you type* (bold becomes bold, headers are styled inline) | Raw Markdown source; rendering only in the separate read view | **The single biggest feel gap.** Reading and writing are two modes, not one | **P0** |
| Brackets, quotes, and `[[` auto-close and wrap selections | `closeBrackets` not loaded | Every bracket typed by hand | **P0** |
| Enter continues a bullet/numbered list, Tab / Shift+Tab re-indent it | No `markdownKeymap` | Lists are typed manually, indentation fights the user | **P0** |
| `Ctrl+B` bold, `Ctrl+I` italic, `` Ctrl+E `` code, `Ctrl+K` link | Only generic `defaultKeymap` | No Markdown formatting shortcuts | **P0** |
| Save is silent and near-instant; no flicker | 800 ms idle debounce + a visible save-state line | Feels laggy; the label draws the eye | **P1** (faster + quieter) |
| Editor is open immediately on the note | CodeMirror lazy-loads on first Edit | First edit can hitch | **P1** (preload) |
| Tab / backlink hover previews | None | Leave the editor to see the target | **P2** |

### 2.2 功能 (the loop around a note)

| Obsidian behaviour | Today | Gap | Priority |
| --- | --- | --- | --- |
| Quick switcher / command palette (`Ctrl+O`, `Ctrl+P`) to jump anywhere | Only sidebar list + search box | Slow to reach a known note | **P1** |
| Open more than one note (tabs / split) | One note at a time | Can't compare or cross-write | **P1** |
| Outline of headings | None | Long notes are hard to navigate | **P1** |
| Tags `#tag` + a tag pane + click to filter | None | No lightweight grouping | **P1** |
| Full-text search that highlights and ranks matches | Title + body match, no ranking or highlight | Findable but not scannable | **P1** |
| Graph / local graph of links | Backlinks only, no view | Relationship is textual, not visible | **P2** |
| Embeds `![[note]]`, block refs `[[#^id]]` | None | Links are navigation only | **P2** |
| Frontmatter / properties pane | None | No structured metadata | **P2** |
| Daily notes, templates | None | No capture ritual | **P2** |
| Vim mode | None | Keyboard-author power users | **P2** |

---

## 3. Optimization plan

### P0 — make writing feel good (do first)

1. **Markdown feel extensions** in `NoteEditor.tsx`. Add the missing CodeMirror
   pieces — all already in the deps, no new library:
   - `closeBrackets` (from `@codemirror/autocomplete`) — auto-close `(`, `[`, `"`, and wrap selections.
   - `markdownKeymap` (from `@codemirror/lang-markdown`) — list continuation on Enter, Tab/Shift+Tab on list items, heading cycling.
   - Three small commands for `Ctrl+B` / `Ctrl+I` / `Ctrl+E` / `Ctrl+K` that wrap the selection in `**`, `_`, `` ` ``, `[[…]]`. ~40 lines.
2. **Live Preview** — the signature win. Two viable shapes:
   - **(a) Decorations, not a second view:** keep one CodeMirror document and add a
     `ViewPlugin` + `Decoration` layer that styles Markdown inline (bold, headings,
     `[[links]]` as links, code spans) while keeping the source text editable.
     No mode switch, no cursor loss. This is how Obsidian's Live Preview works.
   - **(b) Split read/edit:** keep the reader but render it inline beside the source.
     Cheaper, but reintroduces two surfaces.
   - Recommend **(a)**. Land bold/headings/links first; expand to lists/quotes later.
3. **Quiet, faster autosave** — drop the 800 ms idle to ~350 ms, and replace the
   always-on status line with a transient "Saved" that fades. Keep the conflict
   path exactly as it is (`Notes.tsx:106-118`).

### P1 — the navigation loop

4. **Command palette + quick switcher** (`Ctrl+P` / `Ctrl+O`): one fuzzy input that
   lists notes by title and runs actions (new, delete, toggle panel, open
   settings). New `components/CommandPalette.tsx`; reuses the existing list
   grammar. Biggest reachability win per line of code.
5. **Tabs (or "open in split")**: let more than one note stay open. Store the open
   set + active id in `notesUi.ts`. Start with tabs; split panes can follow.
6. **Outline panel**: derive headings from the current note's Markdown and make
   them jump the cursor. Cheap once the source is parsed for backlinks already.
7. **Tags**: render `#tag` in the live-preview layer, collect them per note, add a
   tag filter in the sidebar alongside scope. Clicking a tag filters the list.
8. **Search quality**: rank title matches above body matches, highlight the matched
   span in the result row, and surface the matching line as a snippet.

### P2 — advanced / deferred (do not start until P0/P1 land)

9. Graph / local-graph view (needs a small layout over the link graph).
10. Embeds `![[note]]` and block references.
11. Frontmatter / properties pane.
12. Daily notes + templates.
13. Vim mode (CodeMirror `@replit/codemirror-vim`).

---

## 4. Suggested order and effort

| Step | Work | Effort | Feel impact |
| --- | --- | --- | --- |
| 1 | closeBrackets + markdownKeymap + format shortcuts | small | high |
| 2 | Quiet/fast autosave + no first-edit hitch | small | high |
| 3 | Live Preview decorations (bold/heading/links) | medium | **highest** |
| 4 | Command palette + quick switcher | medium | high |
| 5 | Outline + tags + search ranking | medium | medium |
| 6 | Tabs | medium | medium |
| 7 | P2 items | large | varies |

Steps 1–3 are the "Obsidian feel". 4–6 are the loop around the note. 7 is
breadth.

---

## 5. Boundaries

- No new editor dependency — CodeMirror 6 already carries close-brackets,
  Markdown keybindings, and decorations.
- Live Preview must not lose the cursor, undo history, or `[[` completion; if a
  decoration approach breaks one of those, fall back to split view (§2.2b).
- Conflict detection and the local-DB store are already correct; this plan does
  not touch persistence.
- Graph, embeds, frontmatter and daily notes are **Deferred** — real features,
  but not what makes writing feel good today.
