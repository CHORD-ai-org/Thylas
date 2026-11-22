# 02 — `@` Invocation System Specification

**Status:** [P] design. Reusable precedent in-tree: `[[wiki-link]]` completion
(`src/pages/notes/NoteEditor.tsx:28-50`) — trigger token → filtered candidates →
completion that **inserts a finished token**, never a half-written one.

## 1. Four things that must not be conflated

| Concept | Meaning | Effect | Example |
| --- | --- | --- | --- |
| **Object Invocation** | reference an existing object by name | adds a *reference* to the message/binding set; nothing is executed | `@Mira`, `@Q3-roadmap`, `@diary-2026-10.md` |
| **Action Invocation** | request an operation | schedules work; needs authorization + may need review before commit | `@extract artifacts from …`, `/summarize selection` |
| **Context Binding** | make information available to the current task | materializes a retrieval set the agent may read | binding `@diary-2026-10.md` + `@Elarie-conversations` to the thread |
| **Authorization** | grant permission to perform/commit | separate act; binding ≠ permission to write | approving a ProfileRecord, committing an Artifact |

Rules **[C]** for this spec:
- **Invocation ≠ execution.** Picking an object never mutates anything.
- **Binding ≠ injection.** Bound context is *available* to retrieval; the model does not automatically receive the whole object (GSC: "Accessible, Not Automatically Injected").
- **Authorization is never implied by invocation.** An agent acting on `@X` may read X (if permitted) but may not commit to X without the commit path (06).

## 2. Invocation categories

Not one flat menu — **grouped, progressively disclosed**. Categories confirmed to exist in
the domain model (audit §2): `workspace | file | note | board | process` (Reference kinds)
plus `integration` (ContextSource) plus coworkers and GSC objects.

| Group | Objects | Source of truth | Status |
| --- | --- | --- | --- |
| **Coworkers** | named coworker identities | `state/coworkers.ts` | [I] objects exist |
| **Workspaces** | workspace scope | `state/workspaces.ts` | [I] |
| **Artifacts** | canonical artifacts (7 kinds) | `data/artifacts.ts` / `state/artifacts.ts` | [I] client-side prototype |
| **Resources** | files, notes, boards, processes, connected apps | `data/types.ts`, `state/connect.ts` | [I] |
| **GSC objects** | Context Entries, Knowledge Objects (see 03) | GSC — **no code yet** | [P], blocked on GSC service |
| **Actions** | operations (extract, summarize, revise, update-profile… see §8) | new action registry | [P] |
| **Tools/capabilities** | deferred (no tool execution exists; WAM boundary) | — | **[Deferred]** |

Recommendation **[P]**: **two-level invocation**. `@` opens the *object* palette (grouped);
`/` opens the *action* palette. Reasons: keeps Object vs Action distinction visible at the
keystroke, avoids a 40-item flat menu, and mirrors the existing ⌘K command separation
(navigation commands only). Natural language remains available for both (see §8).

## 3. Trigger behavior

- Trigger char `@` typed in the composer (and `/` for actions) — the composer is the merged
  Home Conversation input (01 §1). Fires when the char is at
  token start (start of input or after whitespace) — `@` inside a word (email) does not trigger.
- On trigger: palette opens anchored to the composer, query = the token text after `@`.
- The token is **committed atomically** on selection → inserts a finished reference chip
  (precedent: `NoteEditor` `apply` inserts `${title}}]` and places the caret after the token).
- Esc closes and leaves the literal text; Backspace over the first char of the token dissolves it.

## 4. Search, ranking, filtering

- Match: prefix + substring over name, and over description/meta; case-insensitive; CJK-safe.
- Ranking `[P]`: recency of use → name-exactness → same-workspace-first → kind priority
  (coworkers and current-workspace artifacts first; integrations last).
- Filters: group tabs (All / Coworkers / Artifacts / Resources / Workspaces / GSC); scope chip
  shows the active workspace and allows "search all workspaces" explicitly (permission-filtered).
- Empty state: "No match for `q`" + "create a note named q" action + "search all workspaces".

## 5. Selection behavior & context binding

- Selecting an object inserts a **reference chip** in the composer: `{label, kind, id}`.
- A chip is **editable**: click → small popover with `Bind as context` / `Just reference` / `Remove`.
  - **Bind as context** → adds to `conversation.context` (existing `ContextSource`, `lib/chat.ts:18-24`).
  - **Just reference** → stays in the message text as a link/mention; not part of the retrieval set.
- Multiple selections are allowed (chips stack in a chip row above the input, reusing `ContextBar` chrome).
- Draft messages may hold chips before a conversation exists (today's `ContextBar` refuses drafts — fix this).

## 6. Permission awareness

- Per-object access is filtered by session/workspace membership **before display** (server is
  the only authority: "the client never computes access", `src/lib/session.ts:1-11`).
- Non-member objects are not listed at all (no "you can't open this" teasers).
- Read-only vs writable is shown on the chip only when relevant to an action (see 06).

## 7. Keyboard, mobile, progressive disclosure

- ↑/↓ move, Enter selects, Esc closes, ⌘←/→ jump token boundaries. Palette is `role="listbox"`,
  `aria-activedescendant` (pattern matches `CommandPalette.tsx`).
- Mobile **[Deferred]** (D7: no mobile in v1 — kept here as the future shape only): same
  trigger via the `@` key; palette becomes a bottom sheet; one column; 20-row cap with
  "Search more". v1 is desktop + responsive degradation only.
- Progressive disclosure: default shows 8 rows (recency); typing narrows; "Show all" reveals group sections. Never render the full taxonomy up front.

## 8. Actions: `@`, natural language, or both? **[P]**

Both — with different roles:

| Route | Best for | Example |
| --- | --- | --- |
| `/` action palette | discoverability, rare/expensive ops, ops needing parameters | `/extract artifacts`, `/revise artifact` |
| Natural language | frequent, ambiguous, intent-shaped requests | "pull the decisions out of last month's diary" |
| Both | every action must be reachable from NL; the palette is the *explicit* form | |

**Do not force operations into `@`.** `@` stays object-first. An "action" typed in NL is
resolved by the assistant into a **structured operation proposal** (an Intelligent UI block,
see 05/06) that the user approves — never silently executed.

## 9. Invocation vs operation (the boundary line)

```
@q3-roadmap                      → reference chip (object)      [no side effect]
bind it as context               → ContextSource added          [read scope only]
"compare it with the diary"      → assistant proposes an op     [needs review]
approve "extract artifacts"      → execution permission granted [may still need commit]
commit artifacts                 → commit authority (06)        [writes persistent info]
```

## 10. Contracts (sketch; no new DB)

`src/lib/invoke.ts` (pure):
```ts
type InvokeGroup = 'coworker'|'workspace'|'artifact'|'resource'|'gsc'|'action';
type InvokeItem = { id: string; group: InvokeGroup; kind: string; label: string; detail?: string; scope: string };
type InvokeQuery = { token: string; group: 'all'|InvokeGroup; scope: string };
function parseInvokeToken(text: string, caret: number): { start: number; query: string } | null;
function rank(items: InvokeItem[], q: InvokeQuery, usage: string[]): InvokeItem[];
function toReference(item: InvokeItem): Reference;
```
UI consumes these; retrieval/permissions remain server-side.

## 11. Missing today (must be built)

1. Token detection in the composer (textarea → needs caret-aware token parsing; see 10).
2. Palette component (reuse `CommandPalette` grammar; not the same component — different semantics).
3. Chip model for composer (extend `ContextBar` chips to draft conversations).
4. Action registry + operation proposal blocks (05/06).
5. Server-side search/ranking over objects the client cannot see (deferred until a search API exists).
