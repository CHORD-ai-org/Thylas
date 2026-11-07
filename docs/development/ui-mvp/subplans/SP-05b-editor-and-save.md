# SP-05b · Editor, save loop, conflict, dirty guard

**Parent:** [SP-05](SP-05-notes-and-documents.md) · **Days:** 1.75 · **Status:** Blocked on Q-1 · **Depends:** SP-05a

## Objective

The first write path in the application, and therefore the first place data can be lost. Ship it with the guard rails before the styling.

## Scope

**In:** CodeMirror 6 mount with Markdown; typography matching the read step (16/26 at 660); save on idle 800ms; version check; conflict review; dirty registry; tab-close interception; `beforeunload`; error surface under the title.
**Out:** wikilink autocomplete (SP-05c), collaboration, offline queue, attachments.

## UX

Parent §D. Additional detail:

- Typing never shows a spinner. Saving is silent; only failure is visible.
- A conflict shows an inline banner at the top of the editor with three actions: **keep mine**, **load theirs**, **review** (side-by-side text diff is out of scope — the review shows both bodies in two scrollable panes).
- Closing a dirty tab opens the strip-level save/discard/cancel — not a modal.
- Reload with unsaved changes triggers one native `beforeunload` prompt.

## Visual

Editor and reader share the same measure so toggling does not reflow: 660px column, 16/26, headings from the Markdown, code in `--t-mono`. Caret and selection use `--accent`; no syntax rainbow.

## Technical plan

- Packages: `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-markdown`, `@codemirror/language`. (Autocomplete comes in SP-05c.)
- `NoteEditor.tsx` owns the doc; React state holds `{ version, saving, error, conflict }`.
- Save: `store.save(id, body, expectedVersion)` returns `{ ok }` or `{ conflict, theirs }`; the store compares versions.
- Dirty registry in `state/app.tsx`: `dirty: Set<noteId>`; `TabStrip` consults it before closing.
- `useBeforeUnload(dirty)`.
- Editor theme: CSS variables through a theme extension so tokens stay the source.

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | CM6 mount + markdown + theme | Typing works, 16/26, 660 |
| T2 | Idle save + version bump | Text survives reload |
| T3 | Conflict path | Two-tab edit cannot silently lose text |
| T4 | Dirty registry + tab close | Save/discard/cancel |
| T5 | Error surface | Failed save is visible and retryable |
| T6 | `beforeunload` | One prompt, only when dirty |

## Acceptance

1. Type 500 words, wait 1s, reload → identical text.
2. Two tabs on one note: save in A, save in B → B shows the conflict banner; choosing "keep mine" writes B's version+1; "load theirs" replaces B's buffer.
3. Closing a dirty tab offers three actions; discard loses text only after an explicit second confirm.
4. Save failure (simulated) shows the error under the title with retry; retry succeeds.
5. Typing latency at 8,000 words stays under 16ms per keystroke (measure once).
6. Editor and reader measure identical (no reflow on toggle).

## Validation

e2e: type → reload; two-tab conflict; dirty close. Performance: 8k-word note, 20 keystrokes timed. Screenshots of conflict and error states.

## Risks

- **Highest data-loss risk in the program.** If version checks prove unreliable, fall back to pessimistic save (blocking inline spinner) — slower, never lossy.
- CodeMirror bundle is ~250 KB raw; if the budget breaks, lazy-load the whole notes route.
- Idle-save plus version check can produce a conflict with the user's own previous tab; the message must say "in another tab", not "someone else".
