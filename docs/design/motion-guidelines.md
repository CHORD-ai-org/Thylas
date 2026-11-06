# Motion Guidelines

**Status:** contract. `[C]` fixed by the brief; `[P]` proposed.
**Date:** 2026-11-07
**Principle:** motion exists to explain that something changed, or that two things are spatially related. If it explains neither, its duration is zero.

---

## 1. What is allowed to move

| Event | Moves | Duration | Easing | Why |
| --- | --- | --- | --- | --- |
| Rail collapse / expand | grid column 240 ↔ 56 | 160ms | `--ease-spatial` | the work area gets wider; the user must see where the space came from |
| Panel collapse / expand | panel width → 0 | 160ms | `--ease-spatial` | same continuity; content must not jump |
| Panel resize by drag | panel width | 0ms | — | tracking must be 1:1 with the pointer |
| Tab switch | nothing | 0ms | — | a tab switch is not a transition; it is a different page |
| Palette open / close | opacity 0→1, `translateY(-2px)→0` | 90ms in, 0ms out | `--ease-fade` | an overlay needs to be distinguishable from the page; closing is instant so the user is not made to wait |
| Board zoom (button / key) | scene scale | 120ms | `--ease-spatial` | orientation: the user must keep their place |
| Board zoom (wheel) | scene scale | 0ms | — | tracking |
| Running state | dot opacity 1 → .35 → 1, twice, then static | 600ms × 2 | `linear` | the only motion that says "a system is working" |
| Selection | background change only | 0ms | — | selection is a state, not an event |

Everything else — page entry, list mount, hover, focus, filter results, skeletons — moves **not at all**.

## 2. Tokens `[C]`

```css
:root {
  --dur-0: 0ms;         /* state, hover, tab switch, wheel zoom */
  --dur-1: 90ms;        /* overlay fade, inline notice appear */
  --dur-2: 160ms;       /* zone resize: rail, panel */
  --dur-3: 220ms;       /* reserved: one motion per product, currently unused */
  --dur-pulse: 600ms;   /* live state, exactly two cycles */

  --ease-spatial: cubic-bezier(.2, 0, 0, 1);  /* decelerating, no overshoot */
  --ease-fade: cubic-bezier(.4, 0, .2, 1);
}
```

Two easings, four durations. No spring, no bounce, no elastic, no stagger. A new duration requires deleting one.

## 3. Rules that keep motion from becoming decoration `[C]`

1. **No entrance animation.** Content exists the moment the route resolves. A 120ms fade-in on every list is the single most reliable way to make an application feel like a template.
2. **Nothing loops.** Except a live state, and only for two cycles. No breathing, no shimmer, no ambient pulses.
3. **Nothing moves on hover.** Background tint only. Movement on hover shifts hit targets under the pointer.
4. **No motion may move the text being read.** Animating a zone boundary is allowed because content is clipped, not reflowed; animating a font-size or a line-height is forbidden.
5. **Animate two properties only** — `opacity` and `transform` — with one documented exception: zone resizing animates a layout dimension (`grid-template-columns`, `width`) for 160ms, because there is no transform that produces the same reflow and the region is simple enough to keep at 60fps. Anything else that animates layout is a defect.
6. **Interruptibility.** A resize in progress must be interruptible by the reverse action without queueing; both are CSS transitions on the same property, so the browser handles it. Never add a JS animation loop.

## 4. Reduced motion `[C]`

```css
@media (prefers-reduced-motion: reduce) {
  :root { --dur-1: 0ms; --dur-2: 0ms; --dur-pulse: 0ms; }
  * { animation: none !important; transition: none !important; }
}
```

The interface must remain fully comprehensible with zero motion: a live run still has a static accent dot, a collapsed rail still reads as 56px of icons, a closed panel is simply gone. Nothing may be communicated *only* by an animation.

## 5. Feedback without motion

Because most feedback is instantaneous, it must be legible without transitions:

| Feedback | Mechanism |
| --- | --- |
| Save in progress | 3 static bars in the button label, `aria-busy`, width preserved |
| Save failed | `--error` text under the field, plus a retry control |
| Selection changed | background + panel content change immediately |
| Action unavailable | disabled control with a stated reason; no shake, no bounce |
| Long operation | text ("running 12m"), not a spinner, because a process can run for an hour |

Skeletons `[P]`: static bars at `--line` tone, no shimmer, appearing only after 300ms — and not at all in this build, because nothing is async yet.

## 6. What is banned, and what it looks like

| Banned | Why it conflicts with Thylas |
| --- | --- |
| Page/section entrance fades | suggests the content arrived from somewhere; it did not |
| Hover lift (`translateY(-1px)`, shadow growth) | the paper metaphor has no floating layers |
| Spring / overshoot | a computational workspace should not feel playful |
| Skeleton shimmer | draws attention to absence |
| Toast slide-in | feedback belongs at the point of action, not at the corner |
| Animated counters / number tickers | numbers here are reported facts, not scores |
| Parallax, blur transitions, gradient sweeps | decoration without state |

## 7. Acceptance for the motion phase

1. `grep -rn "transition" src` returns only the zone-resize property, the overlay fade, and hover background — no `all`.
2. With `prefers-reduced-motion: reduce`, no element animates and every state remains distinguishable in a screenshot.
3. Switching tabs produces zero frames of animation (verified by a screenshot taken immediately after the click).
4. Rail and panel collapse hold 60fps on a 1440 window (Chrome performance panel, 4× CPU throttle) and never shift the tab strip.
5. The only looping animation in the product is the two-cycle live pulse, and it stops.
