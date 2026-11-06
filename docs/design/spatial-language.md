# Spatial Language

**Status:** implemented. Every dimension here is a CSS value in `src/shell/shell.module.css` or `design/tokens.css`.
**Date:** 2026-11-07

Thylas is one environment with fixed zones, not a set of pages that each invent a layout. This document defines the zones, what may be nested in what, and who owns scrolling.

---

## 1. The four zones

```
┌──────────┬──────────────────────────────────────────────┐
│          │ strip (40)                                   │
│  rail    ├───────────────────────────┬──────────────────┤
│  240     │ surface                   │ panel            │
│  (56)    │                           │ 340 (280–480)    │
└──────────┴───────────────────────────┴──────────────────┘
```

| Zone | Width | Lifetime | Owns |
| --- | --- | --- | --- |
| Rail | 240, collapsed 56 | every route except none | areas, workspace group, profile |
| Strip | full width of work, 40 tall | only inside a context | room tabs, object tabs, panel toggle |
| Surface | flexible, `min-width: 0` | every route | the work itself, and its own scroll |
| Panel | 340 default, 300 in Notes | per route, toggleable | details of the current selection |

**The strip belongs to the work column, not to the surface.** That is why a tab strip survives when a page changes and why a panel can be collapsed without moving the tabs. A global strip across the rail was rejected in the design plan (§7.2) and this layout encodes that decision.

**Nothing floats over the surface except:** the command palette, the board's floating chrome (tools, minimap, zoom), and context menus (not built). No drawers, no sheets, no toasts. Transient feedback is inline, at the place it happened.

## 2. Surfaces and tone

Three tones, one direction:

| Tone | Token | Use |
| --- | --- | --- |
| ground | `--bg-app` `#F1EBDD` | the work area, the strip, plain pages |
| recessed | `--bg-rail` `#EBE4D4` | the rail only — recessed zones are darker |
| raised | `--bg-surface` `#FBF9F4` | active rail row, tabs, panel, reader page, board cards |

The rule is that raised is lighter and recessed is darker, never the reverse, and a surface does not sit on a same-tone surface. The note reader is a raised page on the ground; it has no border and no radius, because it is a page, not a card.

## 3. Nesting and depth

| Container | May contain | Depth limit |
| --- | --- | --- |
| Rail | areas, workspace rows, room rows | three levels (area → workspace → room), never more |
| Strip | tabs | one strip per context; no nested strips |
| Surface | one index **or** one object, per route | one object per tab |
| Panel | details of the current selection | never a second panel |
| Board canvas | sections, cards, edges | one level; no nested boards |

Object tabs are one depth by construction: a room tab is an index, an object tab is a detail. There is no "detail of a detail" tab, so the strip cannot grow a hierarchy.

## 4. Per-surface geometry

| Surface | Composition | Numbers |
| --- | --- | --- |
| Overview | single column, max 880, centred, 72px top padding | Continue / Needs you split `1fr / 300px`, 48 gap |
| Recently | single column, max 1000 | 40px rows, one line per object |
| Files | tree 208 + table + panel | table columns `1fr 58 74 100 56`; name survives |
| Whiteboard index | heading + 3-up card grid | card min 232 |
| Board | header, then full-bleed canvas, 1032×560 logical scene | scale-to-fit, clamp 1.0 max at 1440 with panel open ≈ 0.73 |
| Run detail | scrolling bands, 24px side padding | plan `28 / 1fr / auto`, events `44 / 14 / 1fr / auto` |
| Notes | list 236 + reading 660 + panel 300 | at 1440: 236 + 664 + 300 = 1200 |
| Account | nav 176 + content, inside 1000 | sticky nav, section max 560 |

## 5. Scrolling: exactly one owner per region

| Region | Scrolls? |
| --- | --- |
| `body` | never (`overflow: hidden` on html/body) |
| rail section | yes, when workspaces exceed the height |
| strip tabs | horizontally, with the scrollbar hidden |
| surface | per route: Files and Processes scroll the table only; the board never scrolls (it scales); Run detail scrolls its band column |
| panel | yes, independently |

Two consequences that are easy to break and were fixed during implementation:

1. `.app` sets `grid-template-rows: 100%` and `.work` sets `min-height: 0`. Without both, content grows the grid and the whole window scrolls — the failure looks like a 26px-wide strip of dead space.
2. A sticky table header requires the scroll container to be the table wrapper, not the surface. Files and Processes therefore own their own `overflow: auto` and their toolbars are outside it.

## 6. Responsive behaviour

There is no mobile layout in v1. Two breakpoints exist, both about not lying:

| Width | Change | Reason |
| --- | --- | --- |
| ≤ 1160 | Overview's two columns become one | 300px side column would squeeze the intent input below usability |
| container < 640 (table width) | Files hides the Source column | Source is derivable from the row badge; the file name is not |

At 1280 with the panel open, the file table has ~512px. It keeps name, size, updated, used-by and drops source. Nothing else collapses: a cramped table is better than a hidden one.

## 7. The board is the exception that proves the rules

The canvas is the only full-bleed surface: no padding, no scroll, its own paper tone with a 16px dot grid. It still obeys the zone rules — the strip stays above it, the panel stays to its right, floating controls are the only things inside it.

Scene scaling is measured, not guessed: a `ResizeObserver` computes `min(1, (w−72)/1032, (h−104)/560)` and the scene is scaled from its top-left inside a stage box of the scaled size. Scaling with `transform-origin: center` inside a flex container was the bug that clipped the left column; the stage wrapper exists so the layout box matches the painted box.

## 8. What is deliberately absent

- **No global navigation strip.** Navigation lives in the rail; location lives in the URL.
- **No breadcrumb bar in the strip.** Breadcrumbs are part of the surface they describe (Files, file detail) because they name *content*, not *location*.
- **No floating action button.** Primary actions sit in the surface's toolbar, where their scope is visible.
- **No resizable rail.** Two widths, both chosen; a third drag state would need its own persistence rules and buys nothing.
- **No board-in-board.** Nested canvases would make the tab model and the scale-to-fit rule ambiguous.
