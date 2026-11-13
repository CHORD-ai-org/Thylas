# Interaction Contract

**Status:** contract. `[C]` fixed by the brief; `[P]` proposed; `[?]` open.
**Date:** 2026-11-07
**Scope:** every interactive element in the application. A component that violates a rule here is a defect, not a style difference.
**Companions:** `motion-guidelines.md` (timing), `spatial-language.md` (zones), `visual-audit.md` (current violations).

---

## 1. Four principles

1. **State is visible or it does not exist.** If a value can change, the change must be drawn: queued ≠ running ≠ needs-you ≠ done.
2. **One writer per state.** Location lives in the URL. Tabs are written only by `openObjectTab`. Selection belongs to the surface that displays it. Two writers is how a sidebar and a strip disagree.
3. **Feedback happens at the point of action.** Inline, next to the thing that changed. No toasts, no modals for outcomes, no global banners.
4. **No fictional control.** A control either performs its action, is disabled with a stated reason, or does not exist. A control that accepts a click and then explains it cannot act is forbidden — including the nine that do this today (`visual-audit.md` I4).

## 2. Navigation `[C]`

| Rule | Value |
| --- | --- |
| Persistence | The rail is present on every route. It never collapses into a hamburger, never becomes a page. |
| Location indicator | Exactly one per level: **area** = raised surface + 500 weight + 1px inset line; **workspace** = expanded group + 500 weight; **room** = raised surface. Terracotta is never a navigation indicator. |
| Depth | Three levels in the rail (area → workspace → room). Deeper structure is navigated in the surface, not the rail. |
| Dead rows | Forbidden. Every visible row maps to a mounted view. (Current state: satisfied — all rows route.) |
| Workspace switch | Switching keeps the *room* the user was in (`files` → `files`), restores that workspace's own tab strip, and never carries an object tab across scopes. |
| Back behaviour | Browser back walks the tab history, because tabs are routes. Closing a tab is *not* a history entry. |
| Rail collapse | Two widths only (240 / 56), persisted. Icons keep their positions; nothing reflows except width. |

`[P]` Add one thing the current build lacks: arrow-key traversal inside the rail (`↑/↓` between siblings, `→` expands a workspace, `←` collapses), with roving `tabindex` so Tab leaves the rail in one press. Without it, keyboard users tab through eleven buttons to reach content.

## 3. Tabs `[C]`

**What opens a tab:** an object detail — file, board, run, note. Nothing else.

**What never opens a tab:** the command palette, filters, panel sections, hover previews, settings dialogs, empty states.

| Event | Behaviour |
| --- | --- |
| Open an object already open | Focus the existing tab; do not duplicate |
| Close the active tab | Return to the room index of that tab's type (`file → files`, `run → processes`, `board → boards`, `note → notes`) |
| Close an inactive tab | No navigation |
| Close a tab whose object was deleted | The tab is a tombstone until dismissed; the surface states the loss |
| Switch context (workspace / notes) | Each context keeps its own ordered set; ordering is insertion order, stable across reloads |
| Reload | Set and active tab restored from `sessionStorage`; entries whose object no longer resolves are dropped |
| More than 8 object tabs `[P]` | Overflow menu `+N` (specified in `design/…plan.md` §7.3, not built). The strip stops scrolling horizontally |
| Room tab | Pinned, not closable, one per context |

**States** — all four must be distinguishable without colour alone:

| State | Treatment |
| --- | --- |
| Active | raised surface, 500 weight, 2px accent rule under the label |
| Inactive | transparent, 400 weight, `--ink-2` |
| Hover | `--tint-hover` background only; label unchanged; **no accent, no underline** |
| Focus-visible | 1px accent ring inside the tab, same geometry as active so focus does not shift the row |
| Dirty `[P]` | 4px accent dot before the close affordance; close becomes “save / discard / cancel” |
| Live | dot left of the label, 2px accent, static after two pulses |

**Unsaved work `[C]`:** a tab may never be lost silently. Until the editor exists the rule is unexercised; it is still binding: closing, switching workspace, or navigating away with a dirty buffer opens an inline confirm in the tab strip (not a modal). The current build has no mechanism (`visual-audit.md` I8) — it must exist before the editor ships.

**Typed tabs `[P]`:** an object tab carries its type (file / board / run / note) as a 12px glyph in `--ink-3`, at 60% opacity when inactive. Today object tabs show only a label (`TabStrip.tsx:96-97`), so four kinds of object are indistinguishable in the strip. This is the cheapest single fix to how the chrome reads.

## 4. Panels `[C]`

| Rule | Value |
| --- | --- |
| Count | One per surface. Never a panel inside a panel |
| Ownership | The route supplies the content; the panel never fetches on its own initiative |
| Width | 340 default, 280–480 drag, remembered per app (not per object) |
| Collapse | `⌘\` or the strip toggle; width animates 160ms, content does not reflow mid-flight |
| Boundary | 1px `--line` on the left; the panel is never a floating card, never rounded |
| Content | Details of the current selection, or a scope explanation when nothing is selected. Actions allowed, editing generally not |
| Empty | A panel is never shown empty: if there is no selection, it shows the board/run/scope summary, or it is closed |
| Mobile | Not in v1 |

`[P]` Two additions: (a) panel widths per *context* (workspace 340, notes 300) rather than one global value — the current build applies 340 everywhere; (b) a resize that shows a 1px guide only, not a live layout reflow at 60fps.

## 5. State matrix `[C]`

Every interactive class must define the states in its row. “Not applicable” must be justified in a comment.

| Component | Default | Hover | Active / pressed | Focus-visible | Disabled | Loading | Error |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Button` | surface, `--line-strong` | `--bg-paper` + `--ink-3` border | `--accent-weak` fill, 0ms | accent ring | 40% ink, no border change, `cursor: not-allowed`, `title` = reason | label → 3 static bars, width preserved, `aria-busy` | accent-free: `--error` text + retry at the point of failure |
| `Button primary` | accent fill, `#FDF8F1` text | `#A9613F` (token `--accent-press`) | same, darker 4% | accent ring 2px offset | `--bg-paper` + `--ink-3` text | as above | as above |
| `IconButton` | transparent | `--tint-hover` | `--accent-weak` | ring | 30% opacity | — | — |
| Row / list item | transparent | `--tint-hover` | `--accent-weak` (selected) | 1px accent ring inset | 40% ink | 3 static bars `[P]` | inline `InlineError` on the row |
| Tab | see §3 | tint only | — | ring | — | — | tombstone |
| Input | `--bg-surface`, `--line-strong` | same | — | border → `--ink-3` + 1px accent ring | 50% ink, no caret | — | `--error` border + message below |
| Chip (status) | tone text + tone border | none (not interactive) | — | — | — | pulse on `live` | — |
| Disclosure (folder) | `--ink-2` | `--tint-hover` | — | ring | — | — | — |

Gaps today: `:active` appears once, `:focus-visible` once, `:disabled` once across the codebase (`visual-audit.md` I6). The matrix is the checklist for closing that.

## 6. Feedback and the honest limiter `[C]`

Four levels, in order of proximity:

1. **Field** — the control that failed, with a message under it.
2. **Inline banner** — at the top of the surface region that failed, dismissible, one sentence, no icon needed.
3. **Empty state** — inside the container, naming where the thing would be and what creates it.
4. **Route error** — `RouteError` via `errorElement`; the rail stays usable.

**Forbidden:** toasts, modals for success, alert dialogs, auto-dismissing messages for anything the user must act on.

**The honest limiter, corrected.** The current build lets the user click nine controls and then says the action was not sent (`I4`). The intent is right; the timing is wrong: **the reason must be visible before the click**. Rules:

| Situation | Correct form |
| --- | --- |
| Capability absent because a service is missing (upload, create, submit, run control) | Render the control **disabled** with `title` = "Needs the files service — not connected in this build". Nothing happens on click because nothing can |
| Service exists but the UI is not wired to it (P1-6 files API, D-057) | Keep the control **disabled** with `title` = "Files service is running — upload is not wired in this UI yet", plus one caption saying the UI still reads seed data. Never claim the service is missing |
| Capability absent because WAM does not expose it | Render **nothing** (mirrored-control rule) |
| Action valid in principle but out of scope for this build (new board, upload) | Do not render the affordance. Absence is honest; a disabled button invites a support request |
| Action would leave the app (billing, invoices) | Render as a link that says where it goes |

Consequence for the current UI: `Overview` intent Start, `Files` Upload / New folder, `Boards` New board / canvas tools, `Processes` Start a process, run Controls, `Notes` New / Move to…, and `Account` Manage plan / Create key all change from *click → apology* to *disabled with reason* or *absent*. Workspaces left this list in SP-11: creating one is in scope, so the card creates one (D-045).

## 7. Keyboard `[C]`

| Scope | Keys |
| --- | --- |
| Global | `⌘K` palette · `⌘\` panel · `esc` closes the topmost overlay |
| Rail `[P]` | `↑↓` siblings, `→` expand, `←` collapse, `↵` open |
| Tabs | Close via the tab control; switch via the palette. `⌘W` / `⌘⇧[` / `⌘⇧]` are **not bound** (browser-reserved, D-013) |
| Tables | `↑↓` selection, `↵` open, `esc` clear selection |
| Palette | `↑↓`, `↵`, `esc`, type-to-filter |
| Board | `+/-` zoom, `0` fit, `esc` deselect |

**Changed 2026-11-07 (D-013):** the tab shortcuts originally proposed here are not bound. Chrome consumes `⌘W` and `⌘⇧[`/`]` before the page sees them, so a handler would either never fire or fight the browser. Closing uses the tab control; cycling uses the palette.

Forbidden: single-letter shortcuts outside the palette, shortcuts that shadow browser tab switching (`⌘1/2/3`), and any shortcut that is not discoverable in the palette.

## 8. Small rules that prevent large inconsistencies

1. **Every clickable thing is a `button`, `a`, or `input`.** No `span`/`div` with `onClick` — the folder disclosure (`Files.tsx:168`) is the current violation.
2. **A row is selected by one mechanism** (`aria-selected`), never by colour alone and never by a hidden input.
3. **Hover never changes text colour.** Background tint only (`visual-audit.md` A5).
4. **A control's label states the verb** (“Upload”, “Start a process”), and the object is implied by context; no “Submit”, no “OK”.
5. **No control is created for a feature that cannot act.** The number of controls decreases in this redesign; expect it.

## 9. Current violations to close

| # | Violation | File | Required change | Phase |
| --- | --- | --- | --- | --- |
| V1 | `span` disclosure inside a button | `Files.tsx:168` | split into a real disclosure button + row button | 3 |
| V2 | Object tabs without type | `TabStrip.tsx:96` | add glyph, keep label | 1 |
| V3 | No overflow menu | `TabStrip.tsx` | `+N` menu after 8 | 4 |
| V4 | 9 post-hoc apologies | see §6 | disabled-with-reason or absent | 4 |
| V5 | "New workspace" opens palette | `Overview.tsx` | closed twice: the card was removed in SP-02, then returned in SP-11 as a form that creates the workspace (D-045) | 2 |
| V6 | Accent on hover text | `overview:151`, `recently:69`, `processes:115/315/370` | tint only | 2–3 |
| V7 | No pressed state for buttons | `ui.module.css` | `:active` per matrix | 0 |
| V8 | No loading language | — | static bars, `aria-busy` | 4 |
| V9 | No dirty-tab guard | — | build with the editor | 4 |
| V10 | Rail has no arrow keys | `Rail.tsx` | roving tabindex | 4 |
