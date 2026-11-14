import type { CSSProperties, ReactElement } from 'react';
import type { Artifact, ArtifactKind, ArtifactStatus } from '../../data/artifacts';
import { resolveCover } from '../../lib/cover';
import s from './artifacts.module.css';

/**
 * The cover system: one geometric glyph + one named hue per artifact.
 *
 * Glyphs are drawn here and nowhere else — 24 grid, 1.2 stroke, round caps,
 * no fills except dots, matching `components/icons.tsx` at a larger canvas.
 * Contract and drawing rules: design/artifacts-gallery.md §2.1.
 *
 * aria-hidden: the link's own name carries the identity; the cover is texture.
 */
const GLYPHS: Record<ArtifactKind, ReactElement> = {
  concept: (
    <>
      <circle cx="9" cy="12" r="5.4" />
      <circle cx="15" cy="12" r="5.4" />
    </>
  ),
  methodology: (
    <>
      <path d="M4.6 5v14" />
      <path d="M4.6 12h13.2" />
      <path d="M15 9.4 17.8 12 15 14.6" />
    </>
  ),
  executable: (
    <>
      <path d="M3.6 7.2v9.6" />
      <path d="M20.4 7.2v9.6" />
      <path d="M9.6 8.2 15.4 12l-5.8 3.8z" />
    </>
  ),
  product: (
    <>
      <path d="M12 3.2 19.6 7.6v8.8L12 20.8 4.4 16.4V7.6z" />
      <path d="M4.6 7.8 12 12l7.4-4.2" />
      <path d="M12 12v8.6" />
    </>
  ),
  empirical: (
    <>
      <path d="M4.2 3.8v16h16" />
      <circle cx="8" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12.4" cy="11.4" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="17.2" cy="7.2" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  structural: (
    <>
      <path d="M4.4 4.4h15.2v15.2H4.4z" />
      <path d="M4.4 12h15.2M12 4.4v15.2" />
    </>
  ),
  external: (
    <>
      <path d="M13.4 3.6h7v7" />
      <path d="M20.4 3.6 10.8 13.2" />
      <path d="M18 14.4v5.2a1.2 1.2 0 0 1-1.2 1.2H4.8a1.2 1.2 0 0 1-1.2-1.2V7.2A1.2 1.2 0 0 1 4.8 6H10" />
    </>
  ),
};

type Props = {
  artifact: Pick<Artifact, 'id' | 'kind'> & { cover?: Artifact['cover'] };
  /** Glyph box in pixels. */
  size?: number;
  status?: ArtifactStatus;
  className?: string;
};

export function ArtifactCover({ artifact, size = 56, status, className }: Props) {
  const { symbol, hue } = resolveCover(artifact);
  return (
    <div
      className={[s.cover, className ?? ''].filter(Boolean).join(' ')}
      style={{ '--cover': `var(--cover-${hue})` } as CSSProperties}
      data-cover-hue={hue}
      data-cover-symbol={symbol}
      aria-hidden
    >
      <svg
        className={s.coverGlyph}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GLYPHS[symbol]}
      </svg>
      {status ? <span className={s.coverDot} data-status={status} /> : null}
    </div>
  );
}
