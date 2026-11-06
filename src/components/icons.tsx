/* One icon set, 16px, 1.2px strokes, no fills.
   Geometric, not rounded-organic: this is what keeps the chrome quiet. */

type Props = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconOverview = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <circle cx="8" cy="8" r="5.6" />
    <path d="M8 4.6v3.4l2.2 1.4" />
  </svg>
);

export const IconRecently = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M2.6 3.8v3.4h3.4" />
    <path d="M2.9 7.2a5.3 5.3 0 1 1 1.2 4.2" />
    <path d="M8 5.4V8l2 1.4" />
  </svg>
);

export const IconFiles = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M3.4 2.4h5.2l3.4 3.4v7.8H3.4z" />
    <path d="M8.4 2.6v3.4h3.4" />
  </svg>
);

export const IconBoards = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <rect x="2.4" y="3" width="5" height="4.4" />
    <rect x="8.8" y="3" width="4.8" height="7" />
    <rect x="2.4" y="9" width="5" height="4" />
    <rect x="8.8" y="11.2" width="4.8" height="1.8" />
  </svg>
);

export const IconProcesses = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M4.2 2.8 12 8l-7.8 5.2z" />
  </svg>
);

export const IconNotes = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M3 3.4h10M3 6.6h10M3 9.8h10M3 13h6" />
  </svg>
);

export const IconAccount = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <circle cx="8" cy="5.6" r="2.4" />
    <path d="M3.4 13.4c.5-2.4 2.4-3.6 4.6-3.6s4.1 1.2 4.6 3.6" />
  </svg>
);

export const IconSearch = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <circle cx="7.2" cy="7.2" r="4.2" />
    <path d="M10.4 10.4 13.6 13.6" />
  </svg>
);

export const IconPlus = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M8 3.4v9.2M3.4 8h9.2" />
  </svg>
);

export const IconChevron = ({ size = 16, dir = 'right' }: Props & { dir?: 'right' | 'down' | 'left' }) => (
  <svg {...base(size)} aria-hidden style={{ transform: dir === 'down' ? 'rotate(90deg)' : dir === 'left' ? 'rotate(180deg)' : undefined }}>
    <path d="M6 3.8 10.2 8 6 12.2" />
  </svg>
);

export const IconClose = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8" />
  </svg>
);

export const IconPanel = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <rect x="2.4" y="3.2" width="11.2" height="9.6" />
    <path d="M10 3.4v9.2" />
  </svg>
);

export const IconRail = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <rect x="2.4" y="3.2" width="11.2" height="9.6" />
    <path d="M6 3.4v9.2" />
  </svg>
);

export const IconUpload = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M8 11.4V3.6M4.8 6.6 8 3.4l3.2 3.2" />
    <path d="M3 12.4v.2h10v-.2" />
  </svg>
);

export const IconFolder = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M2.4 4.4h4l1.2 1.6h5.9v6.4H2.4z" />
  </svg>
);

export const IconStop = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <rect x="4.4" y="4.4" width="7.2" height="7.2" />
  </svg>
);

export const IconPause = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M6 3.6v8.8M10 3.6v8.8" />
  </svg>
);

export const IconAnswer = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M2.8 8h10.4M9.4 4.4 13 8l-3.6 3.6" />
  </svg>
);

export const IconMore = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <circle cx="3.4" cy="8" r="0.9" />
    <circle cx="8" cy="8" r="0.9" />
    <circle cx="12.6" cy="8" r="0.9" />
  </svg>
);
