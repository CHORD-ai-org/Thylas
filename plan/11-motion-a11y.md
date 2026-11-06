# 11 · Motion and accessibility

**Sprint:** S4 · **Estimate:** 1.75 days · **Gate:** G4 · **Depends:** 09
**Contract:** `motion-guidelines.md` (four allowed motions) · `interaction-contract.md` §7 · **Audit:** I9, I10

## Objective

Make motion the consequence of an action (and nothing else), and make the application operable without a pointer — then prove both, rather than assert them.

## Done when

- The only transitions in `src/` are: rail/panel width (160ms spatial), overlay fade (90ms), hover background (90ms). Everything else is `0ms` or absent.
- `prefers-reduced-motion: reduce` produces zero animation frames and every state still readable in a screenshot.
- Every route has a focus order that starts at the surface, not in the rail; a skip link reaches the surface in one press.
- `esc` closes exactly one thing per press, in the documented order.
- Error and empty surfaces use the page step and the shared banner.

## Steps

1. **Audit transitions** — `grep -rn "transition" src --include=*.css`. For each: either it is one of the four allowed, or delete it. Pay attention to `transition: all` (none should exist) and to the tab underline.
2. **Motion tokens** — ensure `--dur-1`, `--dur-2`, `--dur-pulse`, `--ease-spatial` are the only durations/easings referenced; remove `--dur-fast`/`--dur-zoom` aliases if unused.
3. **Reduced motion** — `base.css` block sets `--dur-1/2/pulse: 0ms` and kills `animation`/`transition` globally; verify the live dot becomes a static accent dot.
4. **Focus order** — add `src/components/SkipLink.tsx` (visually hidden until focus) in `AppShell` before the rail; `main` gets `id="main"` and `tabIndex={-1}`; on route change, move focus to `main` (`useEffect` on `pathname`, no scroll jump).
5. **Error/empty pass** — `app/routerror.module.css`: title `--t-page`, hint 13/20; `notfound.module.css` same; every `EmptyState` names its container and one action.
6. **Screen-reader basics** — `aria-current="page"` on the active rail item (exists), `aria-live="polite"` on the run-state row, `aria-busy` on loading buttons, `role="status"` on banners.
7. **Contrast spot-check** — DevTools on: rail label, caption, disabled button, warn chip, `not stored`. All ≥ 4.5 (text) / ≥ 3 (marks) per `branding-desk.md` §4.

## Files

| Action | Path |
| --- | --- |
| add | `src/components/SkipLink.tsx` |
| edit | `src/shell/AppShell.tsx` (skip link, main id, focus-on-route) |
| edit | `src/styles/base.css` (reduced motion, focus ring) |
| edit | `src/app/routerror.module.css`, `src/pages/notfound.module.css` |
| edit | page CSS files with stray transitions |

## Verify

```bash
grep -rn "transition:" src --include=*.css          # only the allowed declarations
grep -rn "transition: all" src                     # 0
grep -rn "@keyframes" src                          # 1 (pulse)
```

Runtime: with DevTools "Emulate prefers-reduced-motion: reduce", screenshot the running-state row — dot present, no animation. Keyboard-only run through J1 and J4. Lighthouse accessibility ≥ 95 on `/w/ws-research/files`.

## Risks

- Moving focus on every route change can fight the browser's back button; only move it when the path changes *and* focus is not already inside the new surface.
- Killing all transitions globally in reduced-motion also kills the panel resize — that is intended (it becomes instant).

## Handoff

12 turns these into assertions: reduced-motion screenshot, keyboard traversal, contrast list.
