/**
 * Artifact covers: which glyph and which hue an artifact gets.
 *
 * Pure functions, no React — the component only renders what this decides.
 * Contract: design/artifacts-gallery.md §2.
 *
 * Two rules, in order:
 *   1. An explicit selection on the artifact wins (validated against the
 *      whitelist; anything unknown is ignored, never rendered).
 *   2. Otherwise derive: symbol from the kind, hue from a stable hash of the id.
 *      Same artifact, same cover, on every reload and every device.
 */
import { COVER_HUES, type Artifact, type ArtifactCover, type ArtifactKind, type CoverHue } from '../data/artifacts';

const KINDS: ArtifactKind[] = ['concept', 'methodology', 'executable', 'product', 'empirical', 'structural', 'external'];

export function isCoverHue(value: unknown): value is CoverHue {
  return typeof value === 'string' && (COVER_HUES as readonly string[]).includes(value);
}

export function isCoverSymbol(value: unknown): value is ArtifactKind {
  return typeof value === 'string' && KINDS.includes(value as ArtifactKind);
}

/** FNV-1a, 32-bit. Small, stable, no dependency — the point is determinism,
    not distribution quality. */
export function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Kind first, hash second: each kind sits on its own point of the six-hue
    wheel, and the id shifts it by up to two steps. A pure id hash left the
    seven seeds on three hues — a gallery that looks like one colour. */
export function derivedHue(id: string, kind: ArtifactKind): CoverHue {
  const base = KINDS.indexOf(kind);
  const shift = hashId(id) % 3;
  return COVER_HUES[(Math.max(base, 0) + shift) % COVER_HUES.length]!;
}

/** Reads a stored cover selection, dropping anything outside the whitelist.
    Returns undefined when nothing valid was supplied. */
export function sanitizeCover(raw: unknown): ArtifactCover | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const input = raw as { symbol?: unknown; hue?: unknown };
  const cover: ArtifactCover = {};
  if (isCoverSymbol(input.symbol)) cover.symbol = input.symbol;
  if (isCoverHue(input.hue)) cover.hue = input.hue;
  return cover.symbol || cover.hue ? cover : undefined;
}

export type ResolvedCover = { symbol: ArtifactKind; hue: CoverHue };

export function resolveCover(artifact: Pick<Artifact, 'id' | 'kind'> & { cover?: ArtifactCover }): ResolvedCover {
  const cover = sanitizeCover(artifact.cover);
  return {
    symbol: cover?.symbol ?? artifact.kind,
    hue: cover?.hue ?? derivedHue(artifact.id, artifact.kind),
  };
}
