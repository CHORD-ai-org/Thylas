/**
 * Coworker avatar — deterministic look, no generated image, no network.
 *
 * The 11-16 decision replaces the gold-on-black portrait in
 * AVATAR-VISUAL-SYSTEM.md: the ground is binary (dark theme → black, light and
 * warm → white) and only the stroke may take an arbitrary colour. Hair and
 * accessories are drawn, not generated. The same id always gets the same face.
 */

export const AVATAR_HUES = ['blue', 'green', 'clay', 'violet', 'teal', 'amber'] as const;
export type AvatarHue = (typeof AVATAR_HUES)[number];

export type AvatarStyle = {
  hair: 0 | 1 | 2;
  accessory: 0 | 1 | 2;
  hue: AvatarHue;
};

/** Three broad faces for the name under a plate: sans, mono, serif. */
export type AvatarFont = 0 | 1 | 2;

/** FNV-1a: small, stable, and independent of the cover module's hash. */
function hash(id: string): number {
  let value = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    value ^= id.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function avatarStyleOf(id: string): AvatarStyle {
  const value = hash(id);
  return {
    hair: (value % 3) as AvatarStyle['hair'],
    accessory: (Math.floor(value / 7) % 3) as AvatarStyle['accessory'],
    hue: AVATAR_HUES[Math.floor(value / 23) % AVATAR_HUES.length]!,
  };
}

/** The name under a plate uses one of three typefaces, derived from the id. */
export function avatarFontOf(id: string): AvatarFont {
  return (Math.floor(hash(id) / 13) % 3) as AvatarFont;
}

/** Accepts any CSS colour string the caller can supply; empty falls back to
    the derived hue token. Kept as a validator so a hand-edited store value
    cannot smuggle in arbitrary markup through an SVG attribute. */
export function avatarStroke(color: string | undefined, fallback: AvatarHue): string {
  if (!color) return `var(--cover-${fallback})`;
  const clean = color.trim();
  if (clean === '') return `var(--cover-${fallback})`;
  if (/^[a-zA-Z]{3,20}$/.test(clean)) return clean;
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(clean)) return clean;
  return `var(--cover-${fallback})`;
}
