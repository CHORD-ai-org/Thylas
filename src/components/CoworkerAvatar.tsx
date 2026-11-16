import type { CSSProperties } from 'react';
import { avatarStroke, avatarStyleOf } from '../lib/coworker-avatar';
import s from './coworker-avatar.module.css';

/** Three flowing hair shapes; all stay inside the same 24×24 plate. */
const HAIR: Record<0 | 1 | 2, string[]> = {
  0: [
    'M9.8 11.4C9.2 7.8 10.6 6 12.4 6c2.1 0 3.4 1.9 3.2 5.1-.1 1.6-.7 2.6-1.3 3.2',
    'M9.8 11.4c-1.7 1.4-2.6 3.4-2.8 6.1',
    'M15.6 11.1c1.7 1.3 2.6 3.3 2.8 6',
  ],
  1: [
    'M9.6 12c-1.3-3.9.2-6 2.9-6 2.5 0 4 2 3.4 5.6',
    'M9.6 12c-1.9.6-3.2 2.3-3.5 4.8',
    'M15.9 11.6c1.5.9 2.3 2.6 2.3 4.8',
    'M11 6.6c1.4.6 2.6 1.6 3.4 3.1',
  ],
  2: [
    'M9.5 12c-.9-3.6.6-5.8 2.9-5.8 2.4 0 3.9 2 3.4 5.4',
    'M9.5 12c-1.4.7-2.2 1.9-2.5 3.6',
    'M15.8 11.4c1.2.6 1.9 1.7 2.1 3.2',
  ],
};

type Props = {
  id: string;
  /** Any CSS colour. Omitted → a colour from the shared cover palette. */
  color?: string;
  size?: number;
  className?: string;
};

/**
 * A drawn portrait, not a generated image. The ground is binary — black in
 * the dark palette, white in warm/light — and only the stroke carries colour.
 * Nothing is fetched, and the same id always draws the same face.
 */
export function CoworkerAvatar({ id, color, size = 28, className }: Props) {
  const style = avatarStyleOf(id);
  const stroke = avatarStroke(color, style.hue);

  return (
    <svg
      className={[s.avatar, className ?? ''].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ '--avatar-stroke': stroke } as CSSProperties}
      data-coworker-avatar
      data-avatar-hue={style.hue}
      data-avatar-hair={style.hair}
      data-avatar-accessory={style.accessory}
      aria-hidden
    >
      <rect className={s.ground} x="0" y="0" width="24" height="24" />
      <g className={s.ink}>
        {HAIR[style.hair].map((path) => <path key={path} d={path} />)}
        <path d="M9.6 13.6c0-2.9 1.1-4.9 2.8-4.9s2.8 2 2.8 4.9c0 2-1.1 3.4-2.8 3.4s-2.8-1.4-2.8-3.4z" />
        <path d="M11 16.8v1.2M13.4 16.8v1.2" />
        <path d="M6.4 21c.6-2.8 2.8-4.2 6-4.2s5.4 1.4 6 4.2" />
        <g className={s.features}>
          <path d="M10.4 12.5h.9M13.1 12.5h.9" />
          <path d="M12.2 13.2v1.1l.6.3" />
          <path d="M11.6 15.8c.5.3 1.3.3 1.8 0" />
        </g>
        {style.accessory === 1 ? <circle cx="15.9" cy="14.4" r="0.65" /> : null}
        {style.accessory === 2 ? (
          <>
            <rect x="9.8" y="11.5" width="2.3" height="1.8" rx="0.7" />
            <rect x="12.9" y="11.5" width="2.3" height="1.8" rx="0.7" />
            <path d="M12.1 12.3h.8" />
          </>
        ) : null}
      </g>
    </svg>
  );
}
