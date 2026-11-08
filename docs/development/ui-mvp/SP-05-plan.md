# SP-05 execution plan

**Date:** 11-08 · **Status:** ready to start · **Supersedes** the "Blocked on Q-1" status of SP-05a
**Reader's decision:** editor = **A, CodeMirror 6** (unless countermanded; the fallback is written into step 3).

## 1. What exists, measured

| Thing | Today | Consequence for this plan |
| --- | --- | --- |
| Notes | 6 notes, 18 blocks (`p` 9, `h2` 3, `quote` 2, `list` 4, `code` 0) in `data/mock.ts` | small enough to migrate by conversion, not by hand |
| `Note` type | `body: NoteBlock[]`, `minutes`, `updated: string`, `refs` | replaced by a Markdown `body`; `refs` and `minutes` move out of the type |
| Surface | read-only reader + 6-row list; **New** apologises after the click | this plan replaces both |
| Storage | none | new: per-note key + index |
| Editor deps | none | +5 packages, +105–120 KB gzip (budget 300 KB) |

The word "18" counts blocks; the list has **six** rows.

## 2. Data contract

```ts
// src/data/types.ts  (replaces the current Note)
export type Note = {
  id: string;              // 'n-method' … stable, never derived from the title
  title: string;           // unique per scope, trimmed
  scope: 'personal' | 'workspace';
  wsId?: string;           // required when scope === 'workspace'
  body: string;            // Markdown; the source of truth
  version: number;         // +1 on every successful save
  updatedAt: number;       // epoch ms
};

export type NoteIndexEntry = { id: string; title: string; scope: 'personal' | 'workspace'; wsId?: string; updatedAt: number };
```

| Key | Shape | Written by |
| --- | --- | --- |
| `thylas:note:v1:<id>` | `Note` | one save |
| `thylas:notes:v1` | `{ version: 1, entries: NoteIndexEntry[] }` | every create/rename/delete, never on body save |

Per-note keys, not one blob: a save rewrites 4 KB, not the whole library. `version` is the conflict detector, not a timestamp — two saves in the same millisecond must still collide.

**Markdown is the storage format.** No block array is persisted; blocks exist only while rendering (`parseBlocks`), so the reader and the editor agree by construction.

## 3. Files

| File | New/changed | Exports |
| --- | --- | --- |
| `src/data/types.ts` | changed | `Note`, `NoteIndexEntry`; `NoteBlock` kept as `LegacyBlock` for seeds only |
| `src/data/mock.ts` | changed | `LEGACY_NOTES: LegacyNote[]` — content untouched, 6 entries |
| `src/data/note-seed.ts` | new | `legacyToMarkdown(n): string`, `NOTE_SEEDS: Note[]` |
| `src/lib/markdown/blocks.ts` | new | `parseBlocks(md: string): Block[]`, `Block = {kind:'p'\|'h2'\|'quote'\|'list'\|'code', text?, items?}` |
| `src/lib/markdown/links.ts` | new | `parseLinks(md): {target, alias, start, end}[]`, `resolveLinks(md, titles): ResolvedLink[]` |
| `src/lib/markdown/backlinks.ts` | new | `buildBacklinks(notes): Map<id, id[]>`, `outgoing(note, notes): id[]` |
| `src/state/notes.ts` | new | `loadNotes()`, `saveNote(id, body, expectedVersion)`, `createNote(input)`, `renameNote(id, title)`, `removeNote(id)`, `resetNotes()`; `useNotes()` via `useSyncExternalStore` |
| `src/state/app.tsx` | changed | `dirty: Set<string>`, `markDirty(id, bool)` — the tab strip consults it |
| `src/pages/Notes.tsx` | rewritten | list + reader/editor + panel |
| `src/pages/notes/NoteEditor.tsx` | new | CM6 mount, theme, keymap, idle save, error surface |
| `src/pages/notes/NoteReader.tsx` | new | `parseBlocks` + chip rendering; no `dangerouslySetInnerHTML` |

## 4. Steps

### Step 1 · Types, blocks, links, backlinks (0.5 day) — **done 11-08**

Pure code, no UI, no storage. Everything below is a function with a table of cases.

`parseLinks` rules, all tested:

| Input | Expected |
| --- | --- |
| `[[Method]]` | one link, target `Method`, alias `null` |
| `[[method]]` | resolves to `Method` — case-insensitive match |
| `[[Method\|the method]]` | alias `the method`, target `Method` |
| `[[ Missing ]]` | target `Missing` (trimmed) |
| `[[A]] and [[B]]` | two links, offsets in order |
| `[[A\|B\|C]]` | one link, alias `B\|C` (split on the first `\|` only) |
| `[[]]` | no link (empty target is not a link) |
| `[[A]]` inside a fenced code block | not a link — fenced ranges are excluded, so the index cannot claim a link a reader never sees |

`buildBacklinks` rules: resolve per scope (a personal note cannot link into a workspace), ignore dangling targets, and stay correct after a rename because resolution is by current title at call time.

**Exit:** `npm test` with ≥ 14 new cases; `npx tsc --noEmit` clean.

### Step 2 · Store and migration (0.5 day) — **done 11-08**

`saveNote(id, body, expectedVersion)` returns `{ ok: true, note } | { ok: false, conflict: true, theirs: Note }`. It reads the stored note, compares `version`, and only then writes. No timers, no debounce here — that is the editor's job.

`loadNotes()` seeds on first run: if `thylas:notes:v1` is absent, write `NOTE_SEEDS` (the six legacy notes converted by `legacyToMarkdown`). `resetNotes()` rewrites the seeds and clears every per-note key.

`legacyToMarkdown` mapping: `p` → paragraph, `h2` → `## text`, `quote` → `> text`, `list` → `- item` per line, `code` → fenced with no language. One blank line between blocks.

**Exit:** `npm test` covers round-trip `legacy → markdown → parseBlocks` for all six notes (block count and text equal); a reload keeps an edit; `resetNotes()` restores the six.

### Step 3 · Editor (1.75 days) — **done 11-08**

Packages: `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-markdown`, `@codemirror/language`.

| # | Requirement | Implementation detail |
| --- | --- | --- |
| 1 | 660 measure, 16/26 | `EditorView.theme` reading the same CSS variables as the reader; `line-height: 26px`, `max-width: 660px`, `margin: auto` |
| 2 | Caret and selection in `--accent` | theme, no syntax rainbow |
| 3 | **Esc leaves the editor** | highest-precedence keymap binding `Escape` → `onEscape()` → focus the title input; a persistent line under the body says `Esc leaves the editor` |
| 4 | Tab indents, never traps | default `indentMore`; the only exit is Esc — documented, and asserted in e2e |
| 5 | Idle save | 800 ms after the last change, unless a save is in flight; a second edit during a save queues exactly one retry |
| 6 | Silent on success | no spinner; failure shows an inline banner under the title with the reason and a retry |
| 7 | Conflict | banner with keep mine / load theirs / show both (two scrollable panes); never auto-resolve |
| 8 | Dirty registry | `markDirty(id, true)` on first change, cleared on successful save |
| 9 | Tab close | `TabStrip` calls `confirmClose(id)` → save / discard / cancel, inline in the strip |
| 10 | `beforeunload` | one prompt while `dirty.size > 0` |
| 11 | Accessible | `aria-label="Note body"`, `aria-multiline="true"`; the editor is not a `contenteditable` mystery |

**Fallback if the bundle passes 300 KB gzip:** drop CM6 for a `<textarea>` + preview toggle (step 1's functions still apply; `[[` autocomplete moves to step 4 and becomes caret arithmetic). Record the reversal in DECISIONS, do not silently shrink 05c.

**Exit:** type → wait 1 s → reload → identical text; two tabs → second save shows the conflict banner; close a dirty tab → the strip asks; `npm run e2e` covers all three.

### Step 4 · Library, search, panel, links (1.25 days)

| # | Requirement | Notes |
| --- | --- | --- |
| 1 | List rows 44 px, roving tabindex, ↑/↓ moves focus | fixes audit A8; `role="listbox"` or plain buttons with `aria-current` — pick one and stay consistent |
| 2 | Scope filter in the URL (`?scope=personal`) | same pattern as Processes |
| 3 | Search over title and body, 200 ms debounce | empty result names the scope that was searched |
| 4 | `[[` autocomplete | `@codemirror/autocomplete` source over current titles, triggered on `[[` |
| 5 | Reader chips | resolved = solid 1px chip; dangling = dashed, click offers "create note named …" |
| 6 | Panel | outgoing + backlinks ("linked from 2 notes"), each row opens that note |
| 7 | New / rename / delete | title uniqueness per scope refused inline; delete asks once; nothing silent |

**Exit:** `npm run e2e` covers create → link → reload → conflict → dangling-link create; screenshots of list, reader, editor, conflict.

## 5. Test table (the part that must not be skipped)

| Module | Cases |
| --- | --- |
| `links.test.ts` | the eight rows above + offsets + two links on one line |
| `blocks.test.ts` | each of the five kinds, adjacent lists, blank-line handling, code fence with and without language |
| `backlinks.test.ts` | two sources → two backlinks; dangling ignored; cross-scope ignored; rename changes resolution without rewriting bodies |
| `note-store.test.ts` | seed on first run; version bump; stale `expectedVersion` returns the stored note; bad JSON dropped; reset restores the six |
| `note-seed.test.ts` | round-trip of all six legacy notes |

## 6. Order against the visual pass, and cost

| Order | Days | Reason |
| --- | --- | --- |
| SP-10b type | 1.0 | The editor's 660 / 16-26 measure is typographic; measuring against a face that is about to change wastes the work |
| Step 1 + 2 (05a) | 1.0 | No UI, so it can run beside 10b |
| Step 3 (05b) | 1.75 | Needs the final type |
| Step 4 (05c) | 1.25 | Needs the editor and the type |
| SP-10c, 10d, 10e | 2.0 | Can interleave; 10e first because its findings are blocking |

Total 4.0 days, of which 1.0 is independent of every open decision.

## 7. What this plan refuses to do

- **No Markdown library.** Six block kinds, hand-written: 0 KB and no XSS surface, at the cost of ~120 lines.
- **No rich text.** The stored document is Markdown, so an export is a copy and a git diff is readable.
- **No collaboration, attachments, tables, images, tags, graph view, documents preset.** Each is a separate decision, none is in this plan.
- **No silent dedupe, no silent overwrite, no auto-resolved conflict.** The three ways this product could lose someone's writing are all in step 3 for a reason.
