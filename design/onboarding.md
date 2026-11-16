# Onboarding preview — visual contract

`/onboarding` sits outside the application shell, like `/login`. It begins after
"Create account" on the sign-in page and ends at `/overview`. A quiet
"Preview onboarding" link on the sign-in page opens it directly.

## Ground rules

- The sky continues from sign-in: fixed `#050505` ground with a slow, quiet
  star canvas (`lib/starfield.ts`, seeded and deterministic). Reduced motion
  gets a static sky.
- Black is local to the page. It overrides the palette on `.page` only; the
  user's stored app theme is never changed. White ink, grey secondary ink,
  white button.
- One sheet, `468px` wide and at most `628px` tall, centred in the sky. Its
  body scrolls; Back / Next stay fixed at the bottom.
- **One question per sheet.** Eleven questions are grouped into six visible
  phases. Each sheet carries a step title and exactly one answer control.
- **No explanatory copy.** No ledes, hints, asides, section notes, bottom note
  or helper paragraphs. Labels and placeholders only. The one honesty marker
  is the tiny `PREVIEW · NO MODEL` in the top bar.
- Hairlines only. No shadows, no gradients, no glass, no coloured accent.
  Inter Variable, three sizes, no serif, no synthetic italic.

## The route

Six phases stay visible above the sheet; future phases are disabled, never
hidden. The active phase shows `n/m` for the question inside it.

| Phase | Questions |
| --- | --- |
| Welcome | One statement, no input. |
| Profile | Name → current focus → interests. |
| Workspace | Starting point → workspace name. |
| Coworker | Template → coworker name → working style. |
| Collab | One scripted task, one retained output. |
| Enter | Four result rows, one action. |

The collaboration sheet keeps only the thread, the task, the composer and the
artifact with Keep / Copy. Its reply is scripted from the answers; the composer
adds a "Your direction" section to the same outline. Back and phase jumping
keep every answer. Nothing is written to a store, a server or a model.

Only four questions block progress: name, focus, starting point and workspace
name. Interests and the Coworker template/name/style have usable defaults.

## Preview and verification

```
npm run dev -- --port 5196
npm run onboarding:check
```

The script checks the sky, the black palette, the six visible phases, the
one-question-per-sheet rule, the absence of helper copy, validation, Back
retention, the simulated output, and the 390×844 layout. Screenshots land in
`design/reference/onboarding/`.
