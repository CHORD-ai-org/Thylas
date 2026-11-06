# Component Guidelines

**Status:** implemented. Every component below exists in `src/` and is used by at least one surface. There are no components written "for later": the rule was that a component earns its file by having two or more real consumers, or by carrying a decision.
**Date:** 2026-11-07

---

## 1. The two component layers

| Layer | Directory | May import | Knows about |
| --- | --- | --- | --- |
| Primitives | `src/components/` | `lib/` only | presentation and state tone |
| Shell | `src/shell/` | primitives, `lib/`, `state/`, `data/` for navigation only | zones, tabs, palette |
| Surfaces | `src/pages/` | everything above | one product area each |

A primitive never imports `data/`. This was violated once during implementation — `Chip` imported its `Tone` type from `data/selectors` — and was fixed by moving `Tone` to `src/lib/tone.ts`. A primitive that knows what a run is cannot be reused for anything else.

Pages do not import each other. Shared pieces between pages are either in `components/` or they are not shared.

## 2. Inventory

### `components/ui.tsx` — primitives, one CSS module

| Component | Props | Rule |
| --- | --- | --- |
| `Button` | `variant: primary \| quiet \| ghost`, `size: sm \| md`, `icon` | `primary` for the one action a surface is about; `quiet` for everything else; `ghost` inside dense rows |
| `IconButton` | `label` (required), `active` | label is `aria-label` and `title`; there is no unlabelled icon button |
| `Chip` | `tone: live \| warn \| ok \| error \| idle \| plain` | pill, 18px, status only. Never a tag, never a category |
| `StatusDot` | `tone`, `pulse` | 6px; `pulse` only for `running`, two 600ms cycles then static |
| `Badge` | children | mono uppercase in a 16px box: `PERSONAL`, `ORG · MEMBER`, `14 CARDS`. Facts, not states |
| `Kbd` | children | keyboard hints. Only three exist: `⌘K`, `⌘\`, `esc` |
| `SectionLabel` | `aside` | the only "section header" pattern: caption + hairline + optional count |
| `EmptyState` | `title`, `hint`, `action` | must name where the thing would be, not "no data" |
| `Field` | `label`, children | 88 / 1fr grid; used in panels and account, never in tables |
| `TypeGlyph` / `NoteGlyph` / `ProcessGlyph` | kind | 18px bordered tile with a mono abbreviation |

### `components/icons.tsx`

16px, 1.2 stroke, current-colour. One file, named exports, no sprite, no library. Adding an icon is adding a path.

### `shell/`

| Component | Responsibility | Must not |
| --- | --- | --- |
| `AppShell` | the two-column application grid; renders rail, outlet, palette | know any route's content |
| `Rail` | five areas, workspace group with rooms, profile | fetch or compute permissions |
| `TabStrip` | rooms + object tabs for one context, panel toggle | mutate the tab set (it calls `useApp`) |
| `ContextPanel` | panel chrome, 280–480 drag handle, close | decide its own content |
| `CommandPalette` | `⌘K` overlay: go, workspaces, recent, view | search content; it navigates only |
| `layouts.tsx` | `PlainLayout`, `WorkspaceLayout` — zone composition | contain product logic |

`WorkspaceLayout` takes `panel` as a prop, not from context. A context provider would let any feature write into the panel from anywhere, which is how two surfaces end up fighting over one region.

## 3. Composition patterns worth copying

**A list row.** `<button>` full width, `aria-selected` when selected, glyph → title+meta → right-aligned state. Never a `<div onClick>`. Row height from the surface's density, not from a variant prop.

**A table.** Three tables exist (files, processes, recently) and there is deliberately no `Table` component: their column counts differ (5 / 6 / inline), their keyboard models differ, and their numbers align differently. Each is a CSS grid with `role="row"` / `role="gridcell"` and a shared header recipe (mono 10.5, tracking 0.1em, hairline).

**A detail panel.** Title row (glyph + name) → `Field` list → actions → one section with its own header → a caption that states the boundary (`References, not copies.`). Panels explain; they do not perform.

**An honest limiter.** When an action needs a service that does not exist, the click sets an inline notice that says so in one sentence, at the point of the attempt. This pattern appears in nine places; it is a pattern, not an accident. No dead button, no fake success, no modal apology.

## 4. Conventions

| Thing | Rule |
| --- | --- |
| Files | one component per file, PascalCase, named export matching the file |
| Styles | one `*.module.css` per directory, imported only there; class names kebab/camel as written |
| Tokens | never a raw hex in a component; if a value is missing, add a token to `src/styles/tokens.css` |
| State | route state in the URL; UI state in `state/app.tsx`; selection local to the surface |
| Types | domain types in `data/types.ts`; primitives' types local to the primitive |
| Accessibility | every interactive element is a `button`/`input`/`a`; every icon-only control has `aria-label`; `:focus-visible` is a single accent ring |

## 5. What was not built, and why

| Not built | Reason |
| --- | --- |
| `Table`, `Card`, `Modal`, `Tabs` generic components | one real implementation each; a generic one would have been configured, not used |
| A design-system package | two consumers do not exist yet |
| A toast system | feedback is inline where the action happened; toasts put the message away from the cause |
| A global store | the URL is the location; tabs and panel live in one small provider |
| A permission helper | B1: the client must not become the place where authorisation looks implemented |
| A chart component | no chart belongs in this product's v1; the Overview has none by design |
| An editor | notes are read-only in this build; TipTap is a milestone, not a primitive |

## 6. Where the boundary is for the next component

Add a component when the third surface needs the same behaviour **and** the behaviour has a decision in it (tone mapping, keyboard model, empty-state copy). Do not add one when the third surface merely repeats a CSS grid — copying three column templates is cheaper than a `columns` prop, and it keeps each table free to diverge.
