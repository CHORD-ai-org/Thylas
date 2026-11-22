import type { CSSProperties } from 'react';
import { avatarStroke, avatarStyleOf } from '../lib/coworker-avatar';
import s from './coworker-avatar.module.css';

/** Filled hair masses: a cap plus tapered locks with air between them. */
const HAIR: Record<0 | 1 | 2, string[]> = {
  0: [
    'M26 12c-2-6 4-9 9-7 5 2 7 7 6 13l-3-1c0-5-3-8-7-8-3 0-5 2-5 6z',
    'M26 12C18 7 10 8 4 12c6 0 13 3 20 7 1-3 2-5 2-7z',
    'M25 16C16 12 7 14 1 18c8-2 16 0 23 3 1-2 1-4 1-5z',
    'M24 20C15 17 6 20 1 26c8-5 16-3 22-1 1-2 1-4 1-5z',
    'M24 25C16 23 8 27 4 33c7-5 14-4 19-2 1-2 1-4 1-6z',
    'M24 30C18 29 12 33 9 39c6-5 11-5 15-4 0-2 0-3 0-5z',
    'M39 18c3 6 2 13-1 18 1-7 0-12-2-15 1-1 2-2 3-3z',
  ],
  1: [
    'M26 12c-2-6 4-9 9-7 5 2 7 7 6 13l-3-1c0-5-3-8-7-8-3 0-5 2-5 6z',
    'M26 12C17 8 9 10 3 15c8-2 15 0 21 4 1-3 2-5 2-7z',
    'M25 17C15 14 6 18 1 24c9-4 17-2 22 0 1-2 2-5 2-7z',
    'M24 23C15 22 7 27 4 34c8-5 14-5 19-3 0-2 1-5 1-8z',
    'M24 29C19 29 14 34 12 40c6-5 10-5 13-4-1-2-1-5-1-7z',
    'M39 19c3 6 2 12-1 17 1-6 0-10-2-13 1-1 2-3 3-4z',
  ],
  2: [
    'M26 12c-2-6 4-9 9-7 5 2 7 7 6 13l-3-1c0-5-3-8-7-8-3 0-5 2-5 6z',
    'M26 12C19 8 12 9 6 13c7 0 13 2 18 6 1-3 2-5 2-7z',
    'M25 18C17 15 9 18 4 24c8-3 14-2 20 1 1-2 1-5 1-7z',
    'M24 25C17 24 11 29 8 35c7-4 12-4 16-2 0-2 0-5 0-8z',
    'M39 20c2 5 1 10-1 14 1-5 0-8-2-10 1-1 2-3 3-4z',
  ],
};

/** Three-quarter face in the ground colour: negative space, not a filled mask. */
const FACE = 'M27 12c4-3 10-1 12 4 2 4 1 8 1 10l3 2-3 1c-1 3-4 5-7 5-4 0-6-4-6-8 0-6 0-11 2-14z';

type Props = {
  id: string;
  /** Any CSS colour. Omitted → a colour from the shared cover palette. */
  color?: string;
  size?: number;
  className?: string;
};

/**
 * A drawn silhouette portrait, not a generated image. The ground is binary —
 * black in the dark palette, white in warm/light — and the figure carries the
 * colour. No model, no prompt, no network, no image asset.
 */
export function CoworkerAvatar({ id, color, size = 28, className }: Props) {
  const style = avatarStyleOf(id);
  const stroke = avatarStroke(color, style.hue);

  return (
    <svg
      className={[s.avatar, className ?? ''].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      style={{ '--avatar-stroke': stroke } as CSSProperties}
      data-coworker-avatar
      data-avatar-hue={style.hue}
      data-avatar-hair={style.hair}
      data-avatar-accessory={style.accessory}
      aria-hidden
    >
      <rect className={s.ground} x="0" y="0" width="48" height="48" />
      <g className={s.figure}>
        {HAIR[style.hair].map((path) => <path key={path} d={path} />)}
        <path className={s.face} d={FACE} />
        <g className={s.line}>
          <path d="M30 19c1.5-.8 3-.8 4 0" />
          <path d="M39 22l2 5-2 1" />
          <path d="M33 29c2 1 4 .5 5-1" />
          <path d="M29 32c1 2 4 3 6 2" />
          <path d="M30 35l-1 4" />
          <path d="M23 45c5-2 9-3 13-2 3 0 5 1 7 2" />
        </g>
        <path className={s.eye} d="M30 21c2-1.5 3.5-1.5 4.5 0-2 1-3.5 1-4.5 0z" />
        <path className={s.eye} d="M36 21c1.2-1 2.2-1 3 0-1.2.8-2.2.8-3 0z" />
        {style.accessory === 1 ? <circle className={s.eye} cx="39" cy="26" r="1" /> : null}
        {style.accessory === 2 ? (
          <g className={s.line}>
            <path d="M28 19h7M35 19h7M35 19v3" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
