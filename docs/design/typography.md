# Typography

**Status:** contract. `[C]` = fixed by the brief; `[P]` = proposed refinement, safe to build; `[?]` = needs a human decision.
**Date:** 2026-11-07
**Supersedes:** the type section of `docs/design/visual-system.md` §3 and the ramps in `design/tokens.css:36-45`. Nothing else in those files changes.
**Why it changed:** the audit (`visual-audit.md` §1.1–1.3) found the shipped UI has no font of its own, synthesises weights 450/550, and carries hierarchy in 8–10.5px text. A palette cannot fix that; only a typeface contract can.

---

## 1. The three families `[C]`

| Role | Family | Weights loaded | Why this one |
| --- | --- | --- | --- |
| Latin UI + display | **IBM Plex Sans** | 400, 500, 600 | Drawn for interfaces and for technical products; a humanist skeleton with engineered details (flat terminals, low contrast, slightly narrow). It stays calm at 13px, which is where this product lives, and it has a matching mono, so the two families share proportions. |
| Chinese | **Noto Sans SC** | 400, 500 | Full GB18030 coverage, near-identical vertical metrics to Plex at the same size, no serif/sans mismatch with the Latin. Installed on this machine already (`NotoSansSC-VF.ttf`), which is why it renders acceptably today — but that cannot be relied on. |
| Technical | **IBM Plex Mono** | 400 | Same superfamily as the UI face: same x-height, same terminal angle. Ids, tabular numbers, shortcuts, durations. |

Licensing `[C]`: both IBM Plex and Noto are SIL Open Font License 1.1. Self-hosting, subsetting and web embedding are permitted; the OFL notice must ship. `[?]` Confirm whether the IBM Plex OFL carries a Reserved Font Name before shipping subset files under a modified name — if it does, keep the original file names and subset in place.

**No fourth family.** In particular: no serif. The "editorial" quality in this identity comes from measure (66–72 characters), a disciplined display step, and rules — not from a book face. `[?]` If note reading later needs a serif, the only acceptable candidate is IBM Plex Serif (same skeleton, one more family, +2 files); that is a separate decision, not a default.

## 2. Loading `[C]`

Nothing is loaded today; the identity resolves to Georgia + Segoe UI + Cascadia/Consolas on Windows and Iowan + Inter + SF Mono on macOS (`visual-audit.md` A1). Replace with self-hosted files. No CDN, no `@import`, no font package from npm at runtime.

```
public/fonts/                                 (shipped 2026-11-07)
  IBMPlexSans-Regular.woff2      400 · latin                    22.6 KB
  IBMPlexSans-Medium.woff2       500 · latin                    24.2 KB
  IBMPlexSans-SemiBold.woff2     600 · latin (reserved)         24.3 KB
  IBMPlexSans-Greek.woff2        400 · greek (the τ mark only)   9.9 KB
  IBMPlexMono-Regular.woff2      400 · latin                    14.7 KB
  NotoSansSC-Regular.woff2       400 · GB2312 (7,445) + punct    1.05 MB
  NotoSansSC-Medium.woff2        500 · same                     1.06 MB
  OFL.txt                        both families + subset notice
```

Measurements from the running build: `/overview` in English makes **4** font requests (Plex 400, 500, mono, greek) and **no** CJK request; typing Chinese adds `NotoSansSC-Regular` only. The one-preload plan was too optimistic — 500 is used above the fold (active tab, file names), so it loads on first paint too.

```css
@font-face {
  font-family: "IBM Plex Sans";
  src: url("/fonts/IBMPlexSans-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+2122, U+2191, U+2193;
}
/* 500 and 600 identical except weight */

@font-face {
  font-family: "Noto Sans SC";
  src: url("/fonts/NotoSansSC-Regular.woff2") format("woff2");
  font-weight: 400;
  font-display: swap;
  /* no unicode-range: the browser fetches this file only when a CJK glyph
     in the family list is actually rendered */
}
```

Rules:

1. **Preload exactly one file** — Plex Sans 400 — because it paints the shell. `<link rel="preload" as="font" type="font/woff2" crossorigin>` in `index.html`.
2. **`font-display: swap`** everywhere, with a metric-similar fallback (`Segoe UI`, `system-ui`) so the swap does not shift layout more than one line.
3. **Noto Sans SC loads on demand.** It sits after Plex *and* after the symbol faces (`Segoe UI Symbol`, `Apple Symbols`) in the stack, so an English-only screen requests nothing from it — symbol glyphs such as `⌘` or `▦` would otherwise pull 1 MB of hanzi for four characters.
4. **No `font-weight: 450/550` anywhere.** Only 400, 500, 600 exist; anything else resolves to the nearest and the design stops being reproducible.
5. **No synthetic bold or oblique** (`font-synthesis: none` on `html`).

## 3. The scale `[C]` — seven steps

| Token | Size / line | Weight | Tracking | Role | Used for |
| --- | --- | --- | --- | --- | --- |
| `--t-caption` | 11 / 16 | 500 | +0.06em, uppercase only for labels | metadata, counts, units | "2h ago", "3 cards", table headers |
| `--t-mono-s` | 11 / 16 | 400 mono | +0.04em | technical micro | ids, `⌘K`, run times, file sizes |
| `--t-ui` | 13 / 20 | 400 | 0 | interface base | rail, tabs, tables, fields, buttons |
| `--t-ui-strong` | 13 / 20 | 500 | 0 | interface emphasis | active tab, selected row, row titles |
| `--t-read` | 16 / 26 | 400 | 0 | reading | note body, run intent, empty-state hint at 15/24 |
| `--t-section` | 20 / 28 | 500 | -0.005em | section title | panel names, board index, account section |
| `--t-page` | 24 / 32 | 500 | -0.01em | page title | Recently, Account, run name, file name |
| `--t-display` | 32 / 40 | 500 | -0.015em | one per screen | Overview greeting only |

That is **eight** steps including the two 11px variants; no other size may be written in a component stylesheet. The current 15/17/22/26/28/30 declarations (`visual-audit.md` A4) collapse into these.

**Rules**

1. **Floor is 11px.** The only exception is the 9px abbreviation inside an 18px file-type tile — and that tile is a graphic, not text; if it cannot be read at 9px it becomes a 16px icon instead.
2. **Numbers that align are tabular.** `font-variant-numeric: tabular-nums` on `--t-ui` and `--t-read` whenever a number sits in a column; mono already is.
3. **Mono is never prose.** Allowed: ids, sizes, credits, durations, timestamps in a table, keyboard shortcuts, code. Forbidden: navigation labels, buttons, descriptions, empty-state sentences.
4. **Display is not a hierarchy substitute.** One display element per screen; if a screen feels flat without a 32px heading, the fault is the section rules, not the size.
5. **Two weights per screen region, maximum.** 400 + 500 is the default pair; 600 is reserved for the single most important action or the current location.
6. **No letter-spacing on mixed-case text**; tracking exists only for uppercase labels and for display sizes (negative).
7. **Serif is gone** from chrome and content. The previous "serif headings" rule in `visual-system.md` §3 is hereby retired.

## 4. Chinese and mixed text `[C]`

| Rule | Value |
| --- | --- |
| Stack (Latin first) | `"IBM Plex Sans", "Noto Sans SC", system-ui, sans-serif` |
| Reading line-height | 26px for 16px in both languages (1.62) — CJK at 1.5 looks cramped, Latin at 1.7 looks loose; 1.62 is the shared compromise |
| UI line-height | 20px (1.54) for 13px; Chinese chrome needs no separate rule because the box is fixed |
| Letter-spacing | `0` for Latin; `0.01em` only under `:lang(zh)` for reading text (`--t-read`), 0 elsewhere |
| Punctuation | Chinese copy uses full-width `，。：；`; Latin brand terms keep Latin punctuation. Do not mix in one sentence |
| No italics for Chinese | Noto Sans SC has no true italic; emphasis is weight 500 or a rule |
| Numbers inside Chinese | stay Latin figures from Plex; never full-width digits |
| Font smoothing | `-webkit-font-smoothing: antialiased` on `html`; no `text-shadow` tricks |

`[?]` If Chinese becomes a shipped locale, the `--t-read` step needs a 17/28 variant: Noto SC at 16px has a smaller apparent size than Plex at 16px. This is measurable in the specimen page and should be decided there, not guessed here.

## 5. What this replaces

| Old (in `design/tokens.css`) | New | Note |
| --- | --- | --- |
| `--serif` stack | removed | no fourth family |
| `--ui` = Inter/Segoe | `--ui` = Inter Variable → Noto SC (D-042, 11-09; was Plex for two days) | self-hosted |
| `--t-display` 28/34 serif | `--t-display` 32/40 Inter 500 | one per screen |
| `--t-section` 18/26 serif | `--t-section` 20/28 Inter 500 | |
| `--t-read` 16/26 serif | `--t-read` 16/26 Inter 400 | measure unchanged at 66ch |
| `--t-ui-strong` 550 | 500 | real weight |
| `--t-caption` 450 11/16 | 500 11/16 +0.06em | uppercase labels only |
| `--t-mono` 12/18 | `--t-mono` 12/18 (kept) + `--t-mono-s` 11/16 | |
| page titles at 15/17/22/24/26/30 | `--t-page` 24/32 | one page step |

## 6. Acceptance for the typography phase

1. `grep -rE "font-size: [0-9.]+px" src` returns only the seven token values; component CSS uses `font:` shorthand tokens exclusively.
2. `grep -rn "450\|550" src design` returns nothing.
3. With the network blocked, the app still renders Plex (proves self-hosting) and falls back to `system-ui` without a layout jump larger than one line.
4. On a 1440 wide window, the note reading column measures 660–680px and 66–72 characters of Plex at 16px.
5. A table of sizes and credits aligns on the decimal without mono (tabular numerals verified in the specimen page).
6. Chinese text pasted into the intent input and a note renders in Noto SC at the same line box as Latin — no baseline jump between scripts.
