# Visual Audit — the implemented UI

**Status:** audit of commit `2171d90`, no code changed. **Historical snapshot** — the numbers below describe that commit, not the current tree. Resolved since: fonts and the 7-step scale (SP-00), tab states and rail keyboard (SP-01), and Overview's hard-coded lede / accent-on-hover / post-click apology / "New workspace" card (SP-02). The remaining findings (page-local `.notice` copies, 8px board labels, hardcoded scene dimensions, no loading language) still stand.
**Method:** read every file under `src/`; rendered all nine surfaces in headless Chrome at 1440×900 and 1280×800; measured the declarations rather than judging from screenshots alone (`grep -rhoE "font-size: [0-9.]+px"`, `border-radius`, selector counts); checked which fonts actually resolve on this machine.
**Verdict:** the layout decisions are sound; the *typographic and state systems* are not yet a system. That is what makes it read as an inexpensive template.

---

## 1. The three reasons it looks cheap

### 1.1 The product has no typeface of its own

`design/tokens.css:32-34` defines:

```
--serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, …;
--ui:    "Inter", "Segoe UI Variable Text", "Segoe UI", system-ui, …;
--mono:  "JetBrains Mono", "Cascadia Mono", "SF Mono", Consolas, …;
```

None of the first choices ship with the repository. On this machine (`/c/Windows/Fonts`): no Iowan, no Palatino, no Inter, no JetBrains Mono; Noto Sans SC *is* installed. So the rendered identity is **Georgia + Segoe UI + Cascadia/Consolas on Windows** and **Iowan + Inter + SF Mono on macOS**. Two different products, neither of them designed. Georgia at 13px with `font-weight: 550` is not an editorial voice; it is a fallback.

The same lines also declare weights 550 and 450:

```
--t-ui-strong: 550 13px/18px var(--ui);
--t-caption:   450 11px/16px var(--ui);
```

Segoe UI and Georgia have 400 and 700. 550 and 450 are **synthesised or snapped**, differently per platform and per size. A hierarchy that changes shape when the font does is not a hierarchy.

### 1.2 Micro-type carries the hierarchy, and micro-type is unreadable

Chrome labels are the smallest text on screen:

| Element | Declaration | Effective size |
| --- | --- | --- |
| file-type letters in the 18px tile | `ui.module.css:220` `font-size: 8px` | 8px |
| board edge labels | `boards.module.css` `.edgeLabel` 9px | 9px |
| section labels, board eyebrows | `--t-mono-s` 10.5px | 10.5px |
| captions, metadata | `--t-caption` 11px | 11px |

Meanwhile the *content* is 13px (`--t-ui`). Navigation, table cells, panel fields and buttons are all 13/18 at 400. So the only thing separating a rail item from a file row from a panel field is 10.5px uppercase mono with 0.1em tracking. When the hierarchy is carried by the least legible layer, the screen reads as grey noise with thin labels on it — which is exactly the "cheap" impression.

Twelve distinct `font-size` declarations exist in CSS (8, 9, 10, 11, 12, 15, 16, 17, 22, 24, 26, 30) plus 13/18/28/10.5 in tokens. Seven of them are display sizes between 15 and 30 with no rule that predicts which is used where: note title 30/36, greeting 28/34, Recently/Account 26/32, run title 24/30, board title 17/24, panel name 15/22.

### 1.3 Hue is spent on hover, so selection stops meaning anything

The accent is reserved in `design/…plan.md` §3.2 for "active tab rule, primary action, running state, focus". In the implementation it also colours hovered text:

- `overview.module.css:151-152` `.row:hover .rowTitle { color: var(--accent) }`
- `recently.module.css:69`, `processes.module.css:115/315/370` — same pattern

Coloured hover text is the visual grammar of a hyperlink list. It teaches the user that terracotta means "the mouse is here", which contradicts what terracotta means everywhere else (running, selected, primary). With the accent demoted to a hover effect, an actually running process no longer stands out, and the one distinctive colour in the palette stops being distinctive.

**A fourth cause worth naming:** the chrome and the content share one tone and one weight. `.railItem` (`shell.module.css:85`) is 13px/400 in `--ink-2`; the table cell is 13px/400 in `--ink-2`. There is no tonal or typographic difference between "where you are" and "what you are looking at", so the interface flattens into one plane. The four-zone layout is correct in geometry and invisible in appearance.

---

## 2. Evidence table

| # | Issue | Where | Effect | Severity |
| --- | --- | --- | --- | --- |
| A1 | No shipped webfont; identity depends on OS | `design/tokens.css:32-34` | two products, neither designed | **blocking** |
| A2 | Non-standard weights 450 / 550 | `design/tokens.css:40-41` | hierarchy changes per platform | **blocking** |
| A3 | 8–10.5px text carries hierarchy | `ui.module.css:220`, `boards.module.css` edge/section, `--t-mono-s` | illegible chrome, grey noise | **blocking** |
| A4 | 12+ unregulated display sizes | 15–30px across pages | headline sizes look arbitrary | high |
| A5 | Accent used for hover text | `overview:151`, `recently:69`, `processes:115` | selection/running loses meaning | high |
| A6 | Chrome and content share one type role | `shell.module.css:85` vs `files.module.css` rows | zones visually flat | high |
| A7 | Six copies of `.notice` | `overview:105`, `files:44`, `processes:56`, `boards:30`, `notes:59`, `account:78` | drift in padding/colour per page | medium |
| A8 | Three bespoke `.filters` blocks | `processes:22`, `recently:23`, `notes:41` | three slightly different chip metrics | medium |
| A9 | Hardcoded colours outside tokens | `ui.module.css:37,41`; `boards.module.css:77,143,328` | palette can no longer be changed in one place | medium |
| A10 | 5 radius values for boxes + pill + circle | `1px`, `2px`, `4px`, `6px`, `9px`, `50%` | the "geometric" claim is not enforced | medium |
| A11 | Scene dimensions hardcoded 9× | `Boards.tsx:11,12,210,293-296`; `boards.module.css:157` | one change breaks minimap/edges | medium |
| A12 | Monospace used for prose-like metadata | `.monoDim` source column, captions in run meta | tech-mono everywhere dulls its meaning | low |
| A13 | Two different "display" roles on one screen | Overview 28/34 + section 18/26, but Notes title 30/36 | editorial scale has no rule | low |

## 3. Interaction defects

| # | Issue | Where | Consequence |
| --- | --- | --- | --- |
| I1 | Folder disclosure is a `<span onClick>` inside a button | `Files.tsx:168-175` | not keyboard-operable, not announced; a nested interactive inside a button is invalid |
| I2 | Object tabs lose their type identity | `TabStrip.tsx:96-97` — only label + live dot; room tabs get icons | tabs cannot be told apart at a glance; the design plan's typed-tab rule is unimplemented |
| I3 | No overflow handling | `TabStrip.tsx` strip scrolls, `design/…plan.md` §7.3 specifies a `+N` menu | 12 tabs become a hidden horizontal list |
| I4 | 9 controls report "not connected" *after* the click | `Overview` intent Start, `Files` Upload/New folder, `Boards` New/Tools, `Processes` Start, run Controls, `Notes` New/Move, `Account` Manage/Create key | violates the required contract (3.4): a click that only produces an apology is a fake control |
| I5 | "New workspace" card opens the command palette | `Overview.tsx` `s.wsNew` + `openPalette` | label and action disagree — the worst kind of surprise |
| I6 | State coverage is one selector deep | `:active` ×1, `:focus-visible` ×1, `:disabled` ×1 vs `:hover` ×31 | no pressed/disabled/focus language for most controls |
| I7 | No loading state anywhere | no skeleton component in `src/` | with a real backend, every list will pop |
| I8 | No unsaved-work protection | notes are read-only, so unexercised — but no mechanism exists | tab close will silently drop edits the day the editor lands |
| I9 | Selection is not announced beyond `aria-selected` | files/processes tables | screen readers read rows but not the panel that changed |
| I10 | Rail has no arrow-key model | `Rail.tsx` (buttons only) | keyboard users must tab through every room |

## 4. Structural duplication

| Pattern | Copies | Risk |
| --- | --- | --- |
| Notice banner (markup + CSS) | 6 pages | six paddings, three borders, two colours |
| Filter chips | 3 | each has its own height/padding |
| Table header recipe | 3 (files, processes, recently) | justifies the "no generic Table" call, but the header *is* shared and should be one class |
| Section header | 5 (`SectionLabel`, `.panelHead`, `.bandHead`, `.listHead`, `.indexHead`) | five typographic treatments of the same idea |
| Field row | 2 (`Field`, `.panelFields`) | consistent today, will drift |
| Numeric alignment | 0 `tabular-nums` | columns align only because mono is monospaced |

Structural conclusion: the *component* count is right (41 files); the **style layer** is where duplication lives, because each page owns a private copy of shared visual grammar.

## 5. What must be preserved

1. **Zone geometry** — rail / strip / surface / panel, strip owned by work, panel as a slot: correct and already tested.
2. **Tab semantics** — rooms pinned, objects closable, one context strip, URL as location: correct.
3. **Tone system** — ground / recessed / raised, hairlines over shadows: correct direction, under-enforced.
4. **The honest-limiter pattern** — every unconnected action says what is missing. The *pattern* is right; its *trigger* (after the click) is wrong. Fix by moving the reason to the control's disabled state, not by deleting the honesty.
5. **Density per surface** — 32px tables, 44px orientation rows: correct.

## 6. Measurements to hold the redesign to

| Metric | Now | Target |
| --- | --- | --- |
| Font families shipped | 0 | 3 (Plex Sans, Noto Sans SC, Plex Mono) |
| Declared weights | 400, 450, 500, 550 (synthesised) | 400, 500, 600 |
| Distinct type sizes in CSS | 12 + 4 tokens = 16 | 9 steps, no exceptions |
| Smallest text | 8px | 11px (labels), 10px allowed only inside glyph tiles |
| Radius values | 5 + pill + circle | 3 (0/2/4) + pill for status only |
| Hardcoded colours | 6 | 0 |
| `:hover` / `:active` / `:focus-visible` / `:disabled` | 31 / 1 / 1 / 1 | every interactive class defines all four |
| Copies of the notice banner | 6 | 1 |

## 7. Audit checklist for the next review

A surface passes when: (1) its largest type is from the display ramp and its smallest is ≥11px; (2) its chrome is distinguishable from its content by weight and tone, not by colour; (3) terracotta appears at most once per region and never on hover; (4) every control is operable and every state it can be in is drawn; (5) no visual value appears that is not a token.
