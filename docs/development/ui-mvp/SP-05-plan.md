# SP-05 execution plan

**Date:** 2026-11-08 · **Status:** plan, not started · **Supersedes** the "Blocked on Q-1" status of SP-05a.

## 1. The dependency was drawn wrong

SP-05a is blocked on Q-1 in the index. It should not be. Q-1 asks *which editor*; SP-05a is a note type, a per-note store, a link parser and a backlink index. None of those four touch a DOM node, and none changes if the editor is CodeMirror, Tiptap or a `<textarea>`.

Correct order:

| Unit | Days | Blocked by Q-1? |
| --- | --- | --- |
| 05a model, store, links, backlinks, migration | 1.0 | **no** — pure logic, testable today |
| 05b editor, save loop, conflict, dirty guard | 1.75 | yes, but only the mount |
| 05c library, search, panel, link rendering | 1.25 | no |

So: start 05a now, decide the editor while 05a is being written.

## 2. Editor: pick one, with a number attached

| | A · CodeMirror 6 (recommended) | B · textarea + preview | C · Tiptap |
| --- | --- | --- | --- |
| Packages | `state`, `view`, `commands`, `lang-markdown`, `language` (+ `autocomplete` in 05c) | none | `@tiptap/react`, `starter-kit`, `markdown` |
| Bundle, gzip (est.) | +105–120 KB | +0 | +140–160 KB |
| Markdown | native, the document *is* Markdown | native | second-class; HTML is the model, MD is an import/export |
| `[[` autocomplete | a source function, position known | manual caret arithmetic | needs a custom node |
| Keyboard escape | **must be added**: Tab indents, so Esc has to leave | free | free |
| Cost | 1.75 d | 1.0 d | 2.0 d |

**Recommendation: A.** The product is Markdown-first (SP-05 §A), the link syntax is text, and 05c needs caret-aware autocomplete that B cannot do without re-implementing an editor. Budget: JS goes 153 → ≈ 270 KB gzip; if it exceeds 300 KB, ship B and record the reversal.

Q-1 needs one line from the reader: *A, B or C*. Everything below assumes A.

## 3. Phases

### 05a · Model (1.0 day, no UI)

| # | Task | Exit |
| --- | --- | --- |
| 1 | `Note` type: `id, title, scope, wsId?, body (Markdown), version, updatedAt` | compiles |
| 2 | Store `thylas:note:v1:<id>` per note + `thylas:notes:v1` index; `save(id, body, expectedVersion)` returns `{ok}` or `{conflict, theirs}` | a save survives a reload |
| 3 | `lib/markdown/links.ts` — `[[Target]]`, `[[Target|alias]]`, offset, dangling | 8 cases |
| 4 | `lib/markdown/backlinks.ts` — reverse map per scope, ignores dangling, survives rename | 6 cases |
| 5 | Migrate the 18 existing mock notes to Markdown seeds; write them on first run; `Reset` restores them | count matches, bodies round-trip |
| 6 | `useNotes()` hook: `list, get, search, save, create, remove, links, backlinks` | no component imports the store directly |

Pure and tested before a keystroke is possible. This is the unit that makes the rest safe to build.

### 05b · Editor (1.75 days)

| # | Task | Exit |
| --- | --- | --- |
| 1 | CM6 mount, Markdown language, theme from CSS variables | 660 measure, 16/26, caret in `--accent` |
| 2 | **Keyboard escape** — Tab indents; `Esc` moves focus to the title; a persistent line under the body says so | Tab cannot trap |
| 3 | Save on idle 800 ms; silent on success, inline error under the title on failure | typing never shows a spinner |
| 4 | Conflict review: banner with keep mine / load theirs / both panes | second tab cannot silently overwrite |
| 5 | Dirty registry + tab-close interception (save / discard / cancel, in the strip) | closing a dirty tab asks once |
| 6 | `beforeunload` once | reload with edits warns |
| 7 | `aria-label` on the editor, `aria-multiline`, readable with a screen reader | not a `contenteditable` mystery |

### 05c · Library (1.25 days)

| # | Task | Exit |
| --- | --- | --- |
| 1 | List rows 44 px with a **roving tabindex** and ↑/↓ (audit A8) | arrows move between notes |
| 2 | Scope filter in the URL, like Processes | `?scope=personal` is a link |
| 3 | Search over title and body, 200 ms debounce, empty result names the scope | finds a note by a body phrase |
| 4 | Reader renderer: `p, h2, quote, list, code, [[link]]` — hand-written, no markdown library, no `dangerouslySetInnerHTML` | chips render resolved vs dashed dangling |
| 5 | `[[` autocomplete in the editor | typing `[[` lists titles |
| 6 | Panel: outgoing + backlinks ("linked from 3 notes"), each row openable | matches 05a's index exactly |
| 7 | New / rename / delete with confirmation; title uniqueness per scope refused inline | no silent dedupe |

## 4. Acceptance (inherits SP-05 §H, plus what the audit added)

1. Create → type → reload: text identical, `[[links]]` included.
2. A note linked from two others shows exactly those two, and no others.
3. Two tabs, one note: the second save offers review, never overwrites.
4. Closing a dirty tab offers save/discard/cancel; `beforeunload` warns once.
5. Editor and reader share 660 / 16-26 — toggling does not reflow.
6. **Keyboard: from the list, Tab reaches the body, Tab indents, Esc leaves the editor, and the next Tab reaches the panel.** No focus trap (audit A1).
7. **The list is navigable with ↑/↓** and announces the note title, not the concatenated row (audit A4, A8).
8. `npm test` covers links and backlinks; `npm run e2e` covers create → link → reload → conflict.

## 5. Sequence against the visual pass

| Order | Why |
| --- | --- |
| SP-10b type first | The editor's measure (660 / 16-26) is a typographic decision; measuring it against a face that is about to change wastes the work |
| SP-10c icons | Independent; do it before the 05c screenshots |
| 05a | Can run in parallel with 10b — it has no UI |
| 05b, 05c | After 10b, before SP-09b (which audits the result) |

## 6. Risks

- **The editor is the first write path.** Data loss is the only unrecoverable failure in this program; hence 05a's store and conflict handling come before any UI. If time is short, cut 05c's search, never 05b's guards.
- **CM6 keyboard trap** is the single most likely accessibility regression, and the fix is a document-level keymap, not a CSS change.
- **Bundle**: 153 → ~270 KB gzip. Acceptable for an internal tool; not for a marketing page.
- **Markdown renderer** is hand-written on purpose. A library would add 30 KB and an XSS surface for six block types.
- **Seeds vs edits**: the 18 mock notes become seeds; if a reader edits one and resets, their edit is lost. The reset control must say that.
