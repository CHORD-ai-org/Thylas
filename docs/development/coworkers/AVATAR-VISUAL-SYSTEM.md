# Thylas Coworker Avatar Visual System

**Version:** 2.0  
**Date:** 2026-11-16  
**Supersedes:** v1.0 (2026-11-14, gold-on-black generated portrait)  
**Purpose:** One drawn portrait system for Coworkers. The ground follows the
user's display setting; only the stroke may carry colour.

---

## 0. Decision (2026-11-16)

The user resolved the v1.0 colour conflict:

- **Confirmed:** the background can only be black or white, chosen by the
  active palette (`--avatar-ground`: black in `dark`, white in `warm`/`light`).
- **Confirmed:** the border / stroke may be any colour.
- **Confirmed:** avatars are drawn, not generated. No model, no prompt, no
  network, no stored image asset. This supersedes v1.0's generation skill and
  resolves `DESIGN.md §10 Q-B` in favour of a mark-only system with a richer
  drawn face.
- **Deferred:** generated portraits, uploaded images, LoRA / IP-Adapter,
  per-face custom shapes, expression controls.

---

## 1. Fixed elements (non-negotiable)

| Element | Requirement | Why |
| --- | --- | --- |
| Ground | `var(--avatar-ground)` — `#000000` in dark, `#FFFFFF` in warm/light | Follows the person's display setting; never a tinted fill |
| Colour placement | Stroke only. The ground is never tinted and the face is never colour-filled | The old gold-on-black fill was the defect |
| Rendering | Drawn SVG, flat 1.1px lines, vector-clean edges | Deterministic, scales from 28px to 108px |
| Face | Minimal outline; eyes / nose / lips as thin lines at 0.62 opacity | Silhouette register without photorealism |
| Hair | Flowing, wind-swept strokes; one of three derived shapes | Signature of the original style, kept |
| Composition | Centred head and shoulders inside a square plate | Consistent in rows, grids and detail views |
| Lighting | None. No gradient, no rim light, no shadow | Quiet computationalism |

---

## 2. Customizable elements (shipped)

- **Stroke colour** — any CSS colour string (name or `#hex`). Omitted: a hue
  from the shared six-colour cover palette, derived from the Coworker id.
- **Hair shape** — three variants derived from the id.
- **Accessory** — none, earring, or glasses; derived from the id.

Not exposed: face shape, expression, gender presentation, secondary colour.
They are not implemented, so no control for them ships.

---

## 3. Determinism and safety

`src/lib/coworker-avatar.ts` derives `hair`, `accessory` and `hue` from a
stable FNV-1a hash of the Coworker id. The same id always draws the same face;
the three seed Coworkers get three distinct stroke colours.

`avatarStroke()` validates a caller-supplied colour: plain names and `#hex`
pass, everything else falls back to the derived hue. This keeps a hand-edited
store payload from injecting markup into SVG attributes.

**Validation checklist**
- [ ] Ground resolves to black only in dark, white only in warm/light
- [ ] No coloured fill on the ground or face
- [ ] Stroke is visible against the ground
- [ ] Hair is present and flowing
- [ ] No network request and no image asset for the avatar

---

## 4. Where it is used

- `src/components/CoworkerAvatar.tsx` — the only drawing site.
- Coworker directory list: 28px plate.
- Coworker directory grid: 108px plate.
- Planned: Coworker detail header and first-encounter surfaces reuse the same
  component; no separate avatar renderer.

The `thylas-coworker-avatar` generation skill from v1.0 is **retired**, not
implemented. Nothing in the codebase calls an image model for avatars.
