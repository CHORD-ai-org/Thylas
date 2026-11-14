# Thylas Coworker Avatar Visual System

**Version:** 1.0  
**Date:** 2026-11-14  
**Purpose:** Unify visual identity for Thylas Coworker avatars. Used by local agents and generation systems to enforce consistent, brand-aligned avatar creation.

---

## Overview

This document combines the visual style guide, generation skill, and usage instructions for Thylas Coworker avatars.

**Style Summary**  
**Fixed:** Minimalist elegant gold-on-black (or user color) silhouette with flowing dynamic hair.  
**Customizable:** Color, face shape, accessories (挂件), hair length, expression.

Reference: original golden silhouette profile image.

---

## 1. Core Style Overview

Coworker avatars follow a **minimalist elegant silhouette** style inspired by high-contrast gold-on-black profile portraits with dynamic flowing hair.

**Key Characteristics:**
- Solid dark (default black) background
- Subject rendered primarily in a single accent color (default warm gold/amber)
- Face as solid silhouette or negative space with thin elegant outlines for features
- Hair as the dominant, dynamic, wind-swept element
- Clean vector-like edges, flat design, no photorealism, no complex textures or gradients on the face
- Side profile or slight three-quarter view preferred for consistency
- Elegant, sophisticated, slightly mysterious mood

---

## 2. Fixed Elements (Strong Constraints — Non-Negotiable)

These must be enforced by the generation system regardless of user customizations:

| Element              | Requirement                                      | Rationale                          |
|----------------------|--------------------------------------------------|------------------------------------|
| Background           | Solid black (#000000) or very dark solid color   | High contrast, brand consistency   |
| Rendering Style      | Flat silhouette + thin line features             | Avoid photorealism / cartoon chaos |
| Hair Treatment       | Flowing, dynamic, wind-swept volume              | Signature visual of the style      |
| Face Treatment       | Solid fill or negative space + minimal outlines  | Elegant, not busy                  |
| Composition          | Centered portrait, head & shoulders or head only | Consistent framing                 |
| Edge Quality         | Clean, sharp, vector-like                        | Professional, scalable             |
| Lighting             | No realistic lighting; flat or simple rim        | Maintain minimalist aesthetic      |

---

## 3. Customizable Elements

Users may customize the following while the system preserves the core style:

- **Primary Color**: Default `#D4A017` (gold). Any color allowed. Applied to hair and any accent outlines.
- **Face Shape**: Oval, round, square, heart, long, etc. Still rendered as silhouette/outline style.
- **Accessories (挂件)**: Earrings, glasses, hats, hair ornaments, necklaces, collars, etc. Must be rendered in the same flat elegant style and primary color (or subtle complementary).
- **Hair Length / Volume**: Short, medium, long, bob, etc., but must retain flowing dynamic quality.
- **Expression**: Neutral, slight smile, serene, confident. Avoid exaggerated cartoon expressions.
- **Gender Presentation / Age**: Adult range; masculine, feminine, androgynous all acceptable within style.
- **Secondary Color** (optional): For accessories if needed, limited use.

---

## 4. Generation System Constraints & Enforcement

To ensure strong style adherence during avatar generation:

### 4.1 Prompt Engineering Rules
- Always include a fixed style prefix/suffix in every generation prompt.
- Use negative prompts aggressively.

**Recommended Positive Style Anchor:**
```
minimalist elegant silhouette portrait, solid black background, [PRIMARY_COLOR] flowing dynamic wind-swept hair, face as solid black silhouette with thin elegant [PRIMARY_COLOR] outlines for eyes nose lips, clean vector style, high contrast, sophisticated, no photorealism, no texture, flat design
```

**Recommended Negative Prompt:**
```
photorealistic, realistic skin, detailed face, 3d render, cartoon, anime, chibi, low quality, blurry, gradient background, complex background, multiple colors on face, messy lines, noise, text, watermark
```

### 4.2 System-Level Controls
- Lock background to solid black via post-processing or model conditioning.
- Prefer image generation models with strong style adherence (or fine-tuned LoRA / ControlNet for silhouette).
- Optional: Use reference image as style seed or IP-Adapter.
- Validation step: reject generations that fail contrast, have complex backgrounds, or look photorealistic.

### 4.3 Dedicated Skill Recommendation

A separate skill (`thylas-coworker-avatar`) is recommended for the local agent / generation pipeline. The full skill definition is included below in Section 6.

---

## 5. Color & Accessibility Notes

- Default gold on black provides excellent contrast.
- When user selects light colors, ensure outlines remain visible; system may darken slightly or add thin stroke.
- Maintain WCAG-friendly contrast where possible for UI use (avatars may be small).

---

## 6. Generation Skill: thylas-coworker-avatar

```yaml
---
name: thylas-coworker-avatar
description: "Generate and enforce Thylas coworker avatar style. Use when creating or regenerating coworker profile avatars with strong visual constraints."
type: workflow
lifecycle: active
---
```

### When to Use
- Creating a new coworker avatar
- Regenerating avatar after user customization
- Validating that a generated avatar matches the Thylas style guide

### Core Workflow

1. **Collect Parameters**
   - Primary color (hex or name, default `#D4A017`)
   - Face shape (oval / round / square / heart / long / etc.)
   - Accessories (list of 挂件: earrings, glasses, hat, etc.)
   - Optional: hair length, expression, gender presentation

2. **Build Prompt**
   - Start with fixed style anchor (see below)
   - Inject user parameters as controlled fragments
   - Always append negative prompt

3. **Generate**
   - Call image generation model with constructed prompt
   - Prefer models strong at style adherence

4. **Validate**
   - Check for solid dark background
   - Check high contrast and clean edges
   - Reject if photorealistic or overly complex
   - Retry up to 2 times with stronger negative prompt if needed

5. **Output**
   - Save as square PNG (recommended 1024×1024 or 512×512)
   - Black background preferred

### Fixed Style Anchor (Always Include)

```
minimalist elegant silhouette portrait, solid black background, [PRIMARY_COLOR] flowing dynamic wind-swept hair, face as solid black silhouette with thin elegant [PRIMARY_COLOR] outlines for eyes nose and lips, clean vector style, high contrast, sophisticated flat design, no photorealism, no texture
```

### Negative Prompt (Always Include)

```
photorealistic, realistic, detailed skin, 3d, cartoon, anime, chibi, low quality, blurry, complex background, gradient, multiple colors on face, messy, noise, text, watermark, ugly
```

### Parameter Mapping

| User Input       | Prompt Fragment Example                          |
|------------------|--------------------------------------------------|
| Color            | `gold`, `emerald green`, `#FF6B6B`               |
| Face Shape       | `oval face`, `heart-shaped face`, `square jaw`   |
| Accessories      | `wearing elegant gold earrings`, `thin glasses`  |
| Hair             | `long flowing hair`, `short dynamic hair`        |

### Validation Checklist
- [ ] Solid black (or near-black) background
- [ ] Hair is flowing and dominant
- [ ] Face is silhouette / minimal outline only
- [ ] No photorealistic details
- [ ] Clean edges
- [ ] Primary color correctly applied

---

## 7. How to Use (for Local Agent)

1. Store this document as the official design system reference for Thylas Coworker avatars.
2. When building the coworker avatar generation feature, implement the skill workflow defined in Section 6.
3. All avatar generations must go through the constrained prompt + validation flow.
4. Use the fixed style anchors and negative prompts exactly as specified to enforce strong visual consistency.

---

**Document Owner:** Thylas Product / Design  
**Next Steps:** Implement generation pipeline based on the skill workflow; test with multiple face shapes, colors, and accessories.
