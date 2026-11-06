# 01 · Typography foundations

**Sprint:** S1 · **Estimate:** 2.5 days · **Gate:** G1 · **Blocks:** 02 (and everything after)
**Contract:** `docs/design/typography.md` §1–§5 · **Audit:** `visual-audit.md` A1–A4

## Objective

Ship three real typefaces and one seven-step scale so that the interface no longer depends on which OS it is opened on, and so that hierarchy stops being carried by 8–10.5px labels.

## Done when

- Six font files are in `public/fonts/`, served locally, with the OFL notice beside them.
- `src/styles/fonts.css` declares exactly six faces; `src/styles/typography.css` declares the seven steps.
- `design/tokens.css` no longer defines serif or the 450/550 weights; nothing in `src/` uses either.
- An English screen makes **one** font request. A screen with Chinese text makes two.
- The specimen page renders both languages at every step and the numbers align without mono.

## Steps

1. **Acquire the files** (the only external input in the whole MVP).
   - IBM Plex Sans 400/500/600 and IBM Plex Mono 400: `github.com/IBM/plex` releases (OFL 1.1).
   - Noto Sans SC 400/500: `github.com/notofonts/noto-cjk` (OFL 1.1) — the `Sans/SubsetOTF` build is already smaller than the VF.
   - Put `OFL.txt` (concatenated, one block per family) in `public/fonts/`.

2. **Subset once, locally** (one-off CLI; do **not** add `fonttools` to `package.json`):

   ```bash
   pyftsubset IBMPlexSans-Regular.ttf \
     --output-file=IBMPlexSans-Regular.woff2 --flavor=woff2 \
     --unicodes=U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2122,U+2191,U+2193 \
     --layout-features='kern,liga,tnum,case'
   ```

   Same flags for 500/600 and Plex Mono. For Noto SC: `--unicodes=U+4E00-9FFF,U+3000-303F,U+FF00-FFEF,U+0020-00FF` gives ~1.1 MB at 400; the 500 weight is only needed if labels end up in Chinese (default: skip 500 until M6 is decided).

3. **`src/styles/fonts.css`** — six `@font-face` blocks, `font-display: swap`, `unicode-range` on the four Latin files only. No `@import`, no CDN.

4. **`src/styles/typography.css`** — the seven steps as `font` shorthands (`--t-caption` … `--t-display`), plus `--ui`/`--mono` stacks. Move them out of `design/tokens.css:36-45` (M3: that file is frozen as the prototype's archive).

5. **`src/styles/tokens.css`** — keep colour/space/geometry/motion; delete the type block; `@import './typography.css'` next to the existing design import.

6. **`src/styles/base.css`** — `font: var(--t-ui)`, `font-synthesis: none`, `-webkit-font-smoothing: antialiased`, `:lang(zh) { letter-spacing: .01em }`.

7. **`index.html`** — one preload for Plex 400, `crossorigin`; nothing else changes.

8. **`design/specimens/type-specimen.html`** — a static page (no build step) showing: the seven steps, Latin + 中文 mixed paragraph, a column of sizes/credits/durations to prove tabular numerals, and the same at 1280 width. This is the review artifact for G1.

## Files

| Action | Path |
| --- | --- |
| add | `public/fonts/*.woff2` (5–6), `public/fonts/OFL.txt` |
| add | `src/styles/fonts.css`, `src/styles/typography.css` |
| add | `design/specimens/type-specimen.html` |
| edit | `src/styles/tokens.css`, `src/styles/base.css`, `index.html` |
| edit | `design/tokens.css` (mark frozen; remove nothing yet — see risk R2) |

## Verify

```bash
npm run check
ls -l public/fonts | awk '{print $5, $9}'
grep -c "@font-face" src/styles/fonts.css                  # 6
grep -rn "450\|550" src design                             # only docs, no CSS/TS
grep -rE "font-size: [0-9.]+px" src --include=*.css        # 0 (all type comes from font:)
grep -rn "Iowan\|Palatino\|Inter\b" src                    # 0
```

Then: DevTools → Network → Font, English route = 1 request; paste 中文 into the intent input = 2. Specimen page screenshot at 1440 and 1280.

## Risks

- **R1 payload / CLS.** If the shell shifts > 0.02 CLS, add `size-adjust: 96%` (measure it) to the fallback face rather than delaying the swap.
- **R2 two token files.** `design/tokens.css` is imported by `design/prototypes/hi-fi.html`. Freezing it means the prototype keeps the old type — that is intended, but say so in the commit body.
- **R3 subsetting mistakes** are silent: a missing punctuation glyph falls back mid-sentence. Check `“”—–…·℃` and full-width `，。：；` in the specimen.

## Handoff

02 may start once `--t-ui` resolves to Plex on this machine. It does not need the specimen to be finished, but it does need the six faces present — otherwise it will tune spacing against Georgia.
