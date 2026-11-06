# Thylas Branding Desk

**Status:** reference document. Constraints marked `[C]` come from the brief; `[P]` are proposals that need sign-off; `[?]` are open.
**Date:** 2026-11-07
**Applies to:** the product UI, documentation, and any surface that carries the Thylas name.
**Relationship to other documents — read this first:**

| Topic | Authoritative document | This desk adds |
| --- | --- | --- |
| Type sizes, weights, loading | `docs/design/typography.md` | why these faces are the brand |
| Interaction behaviour | `docs/design/interaction-contract.md` | how the brand behaves, not what it does |
| Timing and easing | `docs/design/motion-guidelines.md` | what motion may express |
| Zones and dimensions | `docs/design/spatial-language.md` | the graphic grammar inside those zones |
| What is wrong today | `docs/design/visual-audit.md` | the standard the fix is measured against |
| Implementation order | `docs/design/ui-redesign-roadmap.md` | — |

This document does not restate those specifications. Where it disagrees, it says so and names the section.

---

## 1. Brand philosophy

**Thylas is an instrument, not a dashboard.**

A dashboard reports on something happening elsewhere. An instrument is where the work happens: it has a fixed geometry, a readable scale, and no opinion about your mood. Thylas is the room where a person's material, the work done on it, and the work handed to a system sit together. The interface should feel like a well-made instrument printed on paper: warm to look at, exact to use.

The name of the direction is **Quiet Computationalism**. Each word is a constraint, not an adjective.

| Word | It means | It forbids |
| --- | --- | --- |
| **Quiet** | One accent, used only for state; everything else separated by tone and line | Coloured labels, gradient headers, status rainbows |
| **Warm** | Paper ground, brown-black ink, no cool grey chrome | `#FFFFFF`, `#F5F5F5`, blue-grey borders |
| **Tactile** | Surfaces you could put a hand on: raised is lighter, recessed is darker, edges are 1px | Glass, blur, floating cards, 12px radii |
| **Geometric** | A 4px grid, square corners, rules that run the full length of a region | Pills, circles-as-decoration, asymmetric whimsy |
| **Editorial** | Hierarchy from measure, scale and rules — not from a decorative face | Serif theatre, drop caps, pull quotes in chrome |
| **Precise** | Numbers aligned, units stated, ids monospaced, states named | Rounded numbers, "~", "about", emoji status |
| **Functional** | Every element either carries information or separates information | Ambient animation, decorative icons, illustration |

**The one-sentence test:** if a screenshot of Thylas had its logo removed, would a reader still know it is a computational workspace and not a project-management SaaS? If not, something in the surface is generic.

## 2. Visual principles, enforceable

| # | Principle | The test that enforces it |
| --- | --- | --- |
| P1 | **One accent per region.** Terracotta means running, selected, or primary — nothing else | Count accent-coloured elements in a 400×400 crop: ≤1, and never on hover |
| P2 | **Hue never encodes structure.** Structure is tone + 1px line | Remove all colour: the layout still reads |
| P3 | **Hairlines are continuous.** A boundary line runs unbroken from a region's start to its end | Zoom to 200%: no line stops mid-air, no double line at a corner |
| P4 | **Raised is lighter, recessed is darker.** Never the reverse | Sample two adjacent surfaces: the higher one has the higher luminance |
| P5 | **Type carries hierarchy; size carries attention.** One display element per screen | `grep` for display tokens: one per page file |
| P6 | **Numbers are facts.** Tabular, unit-bearing, mono when they align in a column | A column of sizes lines up on the decimal |
| P7 | **Motion is consequence.** Nothing moves before the user acts | Freeze-frame at t=0 and t=2s with no input: identical |
| P8 | **No fictional control.** A control acts, is disabled with a reason, or is absent | Click every control in a build where services are absent: zero apologies |

## 3. Typography — the brand's main voice `[C]`

The full specification is `docs/design/typography.md`. The brand argument:

- **IBM Plex Sans** is a humanist sans with engineered details: flat terminals, an even rhythm, a slightly narrow fit. It was drawn for interfaces and for a technology company, which is exactly the register Thylas wants — precise without being cold, warm without being friendly-for-no-reason. It is legible at 13px, which is where this product lives.
- **Noto Sans SC** covers Chinese without introducing a second personality: same vertical rhythm, similar apparent weight. Chinese must never look like an afterthought set in a fallback.
- **IBM Plex Mono** shares Plex's skeleton, so a mono value inside a sans row looks like a *material change*, not a font change. This is why numbers and ids read as instrument readouts.
- **No serif.** The editorial quality comes from measure (66–72 characters), a single display step, and rules. A serif in the chrome would be costume; a serif in the reading column is a real option but must be argued as a decision (`typography.md` §1, `[?]`).

```css
--ui:   "IBM Plex Sans", "Noto Sans SC", system-ui, sans-serif;
--mono: "IBM Plex Mono", "Cascadia Mono", Consolas, monospace;
/* 7 steps: 11 · 12 mono · 13 · 16 · 20 · 24 · 32 */
```

## 4. Colour system `[C]` palette, `[P]` semantics

The six given values are fixed. What has to be decided is **what may wear them**, and four of the current pairings fail WCAG AA for small text. Measured contrast ratios (sRGB, WCAG 2.1):

| Pair | Ratio | Verdict |
| --- | --- | --- |
| `#493626` on `#F1EBDD` | **9.61** | AA/AAA — body text on ground |
| `#493626` on `#FBF9F4` | **10.85** | AA/AAA — body text on surface |
| `#927B65` on `#F1EBDD` | 3.37 | **fails** for text < 18.7px; passes 3:1 for icons and lines |
| `#927B65` on `#EBE4D4` (rail) | 3.16 | fails for text; passes 3:1 non-text |
| `#B3A08C` on `#F1EBDD` | 2.12 | placeholder / disabled only |
| `#B56F50` on `#F1EBDD` | 3.30 | passes for marks, dots, rules, focus ring; **fails** for text |
| `#FDF8F1` on `#B56F50` | 3.71 | **fails** for a 13px button label |
| `#5E6B50` on `#FBF9F4` | 5.40 | AA for status text |
| `#A8792C` on `#FBF9F4` | 3.67 | **fails** for text; passes as dot/border |
| `#8C3A2B` on `#FBF9F4` | 7.24 | AA/AAA |

`[P]` Three derived values fix this without changing the palette's character:

| Token | Value | Ratio | Use |
| --- | --- | --- | --- |
| `--ink-2` | `#75604B` (darker taupe) | 5.00 on ground · 4.70 on rail | secondary **text** (metadata, inactive labels) |
| `--taupe` | `#927B65` (unchanged) | 3.37 / 3.16 | **non-text only**: icon strokes, hairlines, minimap |
| `--accent-strong` | `#A0553A` | 5.16 with `#FDF8F1` · 4.58 on ground | primary button fill, accent text |
| `--accent` | `#B56F50` (unchanged) | 3.30 | dots, 2px rules, focus ring, selected edge |
| `--warn-ink` | `#8F6420` | 4.98 on surface | "needs you" text on a surface |

Semantics, per surface:

| Surface | Ground | Text | Accent may appear as |
| --- | --- | --- | --- |
| Overview | `--bg-app` | ink, ink-2 | one primary button, one live dot |
| Files / Processes | `--bg-app` | ink, ink-2, mono for numbers | selected row edge or state dot — not both |
| Notes | `--bg-surface` page on `--bg-app` | ink, ink-2 | the reference rule only |
| Whiteboard | `--bg-paper` + dot grid | ink, ink-2, mono labels | live card edge, selection ring |
| Account | `--bg-app` | ink, ink-2 | nothing: settings are not a state |
| Rail | `--bg-rail` | ink, ink-2 | never — the rail shows location by tone, not colour |

**Dark mode `[?]`:** not an inversion. A paper metaphor has no dark equivalent worth having without a second palette investigation (ink becomes light, borders change meaning, the accent needs a different value to hold 4.5:1). Out of scope until the light system is stable.

## 5. Geometry and materials

| Element | Rule |
| --- | --- |
| Grid | 4px base; every padding, gap and row height is a multiple |
| Rule | 1px, `--line` for separation, `--line-strong` for control borders; never 2px except the active tab and focus |
| Radius | 0 (rules, tables, sections), 2 (controls, chips, glyph tiles), 4 (surfaces: panel, reader, sheet), 6 (overlays only), pill (status chips only), 50% (dots) |
| Elevation | Three levels: hairline (default), `e1` (board card, floating chrome), `e2` (palette). Nothing else floats |
| Material | Paper and ink. No glass, no blur, no inner shadow, no gradient except the board's 16px dot grid |
| Alignment | Left edges align across a region; numbers right-align in their column; labels align to the text baseline, not the box |

**The continuity rule (P3) makes the identity.** In the current build, panel and rail borders are already continuous; the strip, table header, and section rules are not all drawn to the same edge. When every boundary is a line that runs the length of its region, the interface reads as drawn rather than assembled — this is the single most recognisable structural trait after the type.

## 6. Spatial language and identity carriers

Zones, widths and scroll ownership are specified in `spatial-language.md`. What belongs here is what makes the zones *Thylas*:

1. **The index mark `[P]`.** Every section label is an 11px mono uppercase label preceded by a 6px horizontal tick at 50% opacity, sitting on the label's baseline. It reads as a technical annotation, not decoration, and it is the one graphic element that repeats on every surface. Current label style (bare uppercase) is the generic version.
2. **The continuous rule.** See P3.
3. **The τ mark `[P]`.** The brand mark is a lowercase `τ` set in Plex Sans 500 inside a 2px-radius square of `--line-strong`, used only in the rail header and documentation covers. It is never a decorative glyph, never a watermark, never repeated inside the app.
4. **Mono coordinates.** Where an object has a spatial identity (board card, process run, file version) the identifier is set in mono: `#12`, `rev 2`, `2026-11`. This is the instrument-readout voice and it must be consistent.
5. **Paper, not background.** The board's dot grid is the only pattern in the system; it marks "this is a surface you place things on". It must not appear anywhere else.

## 7. Iconography

| Property | Rule |
| --- | --- |
| Grid | 16×16, 1px safe margin |
| Stroke | 1.2px, round caps, joins round only at corners |
| Geometry | Constructed from horizontals, verticals and 45° diagonals; no organic curves except the two required (account, overview clock) |
| Fill | None. State is expressed by opacity or tone, never by filling |
| Active | Icon at `--ink`, stroke unchanged; active item is identified by its row, not by a second icon |
| Size | 16 chrome, 13 inside dense rows, 24 only for empty-state illustrations (none exist) |
| Forbidden | Icons as decoration, icons without labels in new surfaces, third-party icon sets, emoji as status |
| File types | Not icons: an 18px tile with a 9px mono abbreviation (`PDF`, `PQ`, `CSV`) — six drawn file glyphs at 16px are indistinguishable |
| Illustration | None in v1. If one is ever needed: single-weight line drawing, ink only, no gradients, no 3D |

## 8. Motion

Specification: `motion-guidelines.md`. The brand position: **motion is the sound an instrument makes when it operates** — short, mechanical, only on consequence.

| Allowed | Duration |
| --- | --- |
| Zone resize (rail, panel) | 160ms spatial easing |
| Overlay fade in | 90ms |
| Live-state pulse | 600ms × 2, then still |
| Board zoom by button | 120ms |
| Everything else | 0ms |

Forbidden without exception: entrance animation, hover lift, spring, shimmer, parallax, animated counters, page transitions. A calm product does not animate its calmness.

## 9. Brand voice

**Register:** a competent colleague writing a lab note. Short declaratives. No exclamation marks. No "AI", no "magic", no "supercharge", no "seamless", no "revolutionize". A capability is described by what it does; a limitation by what is missing and what to do instead.

| Do | Don't |
| --- | --- |
| "Needs the files service — not connected in this build." | "Oops! Upload isn't available yet 😅" |
| "Runs in Research · can be changed before it starts" | "Powered by intelligent context awareness" |
| "Nothing is waiting. The other runs are working on their own." | "You're all caught up! 🎉" |
| "References, not copies. Removing this file breaks these three." | "Heads up: this file is used elsewhere." |
| "This folder is empty. Files arrive by upload, import, or as the output of a process." | "No data" |
| "WAM is not connected in this build, so nothing was sent." (as a **disabled** reason) | "Something went wrong. Please try again." |

Labels: verb + object, sentence case, no terminal period on buttons. States: `queued` · `running` · `needs you` · `done` · `failed` · `stopped` — five words, used identically in chips, tables and panels. Units always stated (`1.2 GB`, `42 credits`, `12m`). Time is relative to now (`2h ago`) except when the exact month matters (`2026-11`).

Chinese `[?]`: if shipped, the same register applies — 说明事实、给出下一步、不用感叹号；技术名词保留英文（WAM、run、workspace）并在首次出现时给出中文解释。

## 10. Applications — one identity, seven densities

| Surface | Density | Hierarchy carrier | Accent budget | Correct / incorrect |
| --- | --- | --- | --- | --- |
| Shell | chrome | weight + tone, never colour | 1 (active tab rule) | ✔ 240px rail with a raised active row · ✘ accent icon for the current area |
| Overview | calm | one 32px display, then rows at 13/20 | 1 (Start) | ✔ greeting is the only large type · ✘ stat cards with big numbers |
| Files | operational | five-column table, tabular numbers | 1 (selected row OR a produced badge) | ✔ 32px rows, hairlines · ✘ thumbnail cards in a grid |
| Notes | reading | 16/26 at 66ch, one rule under the title | 1 (quote rule) | ✔ page on paper, no card · ✘ bordered card with rounded corners |
| Processes | instrument | mono state, 38px rows, filters as segmented labels | 1 (running dot) | ✔ state as text + dot · ✘ coloured row backgrounds per state |
| Whiteboard | spatial | mono section labels, card eyebrows | 1 (live card edge) | ✔ sections as tinted fields with a top rule · ✘ floating pill sections |
| Account | administrative | field rows, section rules | 0 | ✔ plain fields · ✘ pricing-table cards with accent highlights |

The rule that unifies them: **the same three type roles, the same hairline grammar, a different row rhythm.** Density changes; vocabulary does not.

## 11. Tokens — implementation reference

Consolidated view; authoritative values ship in `src/styles/`.

```css
:root {
  /* ground */
  --bg-app:#F1EBDD; --bg-paper:#F7F2E9; --bg-surface:#FBF9F4; --bg-rail:#EBE4D4;
  /* ink */
  --ink:#493626; --ink-2:#75604B; --ink-3:#B3A08C; --taupe:#927B65;
  /* line */
  --line:#E6DED1; --line-strong:#D8CCB9;
  /* accent */
  --accent:#B56F50; --accent-strong:#A0553A; --accent-weak:#F0E2D7;
  /* state */
  --ok:#5E6B50; --warn:#A8792C; --warn-ink:#8F6420; --error:#8C3A2B;
  /* type */
  --ui:"IBM Plex Sans","Noto Sans SC",system-ui,sans-serif;
  --mono:"IBM Plex Mono","Cascadia Mono",Consolas,monospace;
  --t-caption:500 11px/16px var(--ui);
  --t-ui:400 13px/20px var(--ui);
  --t-ui-strong:500 13px/20px var(--ui);
  --t-read:400 16px/26px var(--ui);
  --t-section:500 20px/28px var(--ui);
  --t-page:500 24px/32px var(--ui);
  --t-display:500 32px/40px var(--ui);
  --t-mono:400 12px/18px var(--mono);
  --t-mono-s:400 11px/16px var(--mono);
  /* space */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s6:24px; --s8:32px; --s12:48px;
  /* geometry */
  --r-chip:2px; --r-surface:4px; --r-overlay:6px;
  --e1:0 1px 0 rgba(73,54,38,.06);
  --e2:0 8px 24px -12px rgba(73,54,38,.25);
  /* zones */
  --w-rail:240px; --w-rail-collapsed:56px; --w-panel:340px; --w-read:660px;
  --h-strip:40px; --h-row:32px; --h-toolbar:44px;
  /* motion */
  --dur-1:90ms; --dur-2:160ms; --dur-pulse:600ms;
  --ease-spatial:cubic-bezier(.2,0,0,1); --ease-fade:cubic-bezier(.4,0,.2,1);
}
```

File map after the redesign: `src/styles/fonts.css` (faces), `src/styles/typography.css` (ramps), `src/styles/tokens.css` (colour/space/geometry/motion), `src/styles/grammar.css` (shared recipes: label, table head, banner, index mark). Component styles consume tokens only; a raw hex in a component is a defect.

## 12. Anti-patterns

| Anti-pattern | Why it conflicts with Thylas | Detection |
| --- | --- | --- |
| Rounded card grids as the default container | Thylas separates by rule and tone; cards hide the grid and fake depth | count `border-radius: 4px+` + shadow in a page CSS file |
| Purple/blue gradients, "AI" aurora | an instrument has no mood lighting; also the palette is fixed | any hex outside the token set |
| Glassmorphism / backdrop blur | the paper metaphor is opaque | `backdrop-filter` |
| Shadows as separation | hairlines are the separator; shadows imply floating layers that do not exist | `box-shadow` outside `e1/e2` |
| Accent as decoration | accent is reserved for state; using it for hover text destroys selection | `color: var(--accent)` on a hover rule |
| Icon-only navigation without labels | labels are the primary identity; icons are support | icons in the rail without a text sibling |
| Text under 11px | the audit found 8–10.5px carrying hierarchy | `font-size` < 11 outside glyph tiles |
| Monospace for prose | mono is a material change, not a style | `--t-mono` on a paragraph or a button |
| Emoji status | state has five exact words | emoji in `.tsx` strings |
| Stat cards, streaks, "insights" | Overview orients; it does not report on you | new component named `Stat*` / `Insight*` |
| Animation on mount | nothing moves before the user acts | `@keyframes` outside the pulse |
| Fake controls / fake success | the product's contract is honesty about state | any `onClick` whose only effect is a message |
| Mixed radius language | geometry is the identity | more than 3 radius values in CSS |

## 13. Quality checklist — run before shipping a surface

1. Type: every size is one of the seven steps; smallest text ≥11px; monospace only where technical.
2. Weight: 400/500/600 only; two per region; one display element.
3. Colour: one accent per region, on state or action; secondary text uses `--ink-2`, not `--taupe`; measured contrast ≥4.5 for text, ≥3 for marks.
4. Lines: every boundary is 1px and continuous; no shadow separating two regions.
5. Geometry: all paddings and row heights are multiples of 4; radii from the three-value set.
6. States: hover, active, focus, disabled defined for every interactive class; no control without a state.
7. Honesty: every control acts, is disabled with a stated reason, or is absent.
8. Motion: nothing animates on mount or hover; the only loop is the live pulse; reduced motion kills all of it.
9. Copy: sentence case, verb-first labels, units stated, five state words.
10. Logo test: cover the mark — the surface is still recognisably Thylas.

## 14. Decisions awaiting a human

| # | Decision | Why it matters | Default |
| --- | --- | --- | --- |
| B1 | Adopt the darker secondary ink `#75604B` and `--accent-strong` `#A0553A` | four current pairings fail AA; this is a palette *extension*, not a replacement | adopt |
| B2 | Serif removal (no Plex Serif in the reading column) | changes the editorial character of Notes | remove; revisit after a reading test |
| B3 | Index mark (6px tick before labels) | the one new graphic element; identity vs decoration | adopt, review on two surfaces |
| B4 | Chinese in scope for rendering only, or as a translated locale | drives Noto SC subsetting and a 17px read step | rendering only |
| B5 | Dark mode | a separate palette investigation, not an inversion | out of scope |
| B6 | τ mark usage in documentation | brand consistency outside the app | rail header + doc covers only |
