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

export const IconBookmark = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M4 2.6h8v10.8L8 10.9l-4 2.5z" />
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

/* ---- canvas icons. Same 16px box and 1.2px stroke as the rest; a board
   toolbar that used text glyphs read as an unfinished prototype. ---- */

export const IconCursor = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M4 2.8 12 8l-3.4 1L7 12.6z" />
  </svg>
);

export const IconCard = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <rect x="2.6" y="3.6" width="10.8" height="8.8" rx="1" />
    <path d="M2.6 6.4h10.8" />
  </svg>
);

export const IconSection = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <rect x="2.4" y="4.4" width="11.2" height="8" rx="1" />
    <path d="M2.4 2.6h4.2" />
  </svg>
);

export const IconLink = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <circle cx="4" cy="11.6" r="1.6" />
    <circle cx="12" cy="4.4" r="1.6" />
    <path d="M5.2 10.4c2-2 4-4 5.6-5.2" />
  </svg>
);

export const IconUndo = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M3 6.6h5.6a3.4 3.4 0 0 1 0 6.8H6.8" />
    <path d="M5.2 4.2 3 6.6l2.2 2.4" />
  </svg>
);

export const IconRedo = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M13 6.6H7.4a3.4 3.4 0 0 0 0 6.8h1.8" />
    <path d="M10.8 4.2 13 6.6l-2.2 2.4" />
  </svg>
);

export const IconFit = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M2.6 6V2.6H6M10 2.6h3.4V6M13.4 10v3.4H10M6 13.4H2.6V10" />
  </svg>
);

export const IconMinus = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M3.4 8h9.2" />
  </svg>
);

export const IconTrash = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M3.4 4.6h9.2M6.4 4.6V3h3.2v1.6M4.6 4.6l.6 8.4h5.6l.6-8.4" />
  </svg>
);

export const IconFold = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M3 4.4h10M3 11.6h10M6.6 8 8 6.6 9.4 8" />
  </svg>
);

export const IconAlign = ({
  size = 16,
  dir = 'left',
}: Props & { dir?: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom' }) => {
  const bars: Record<string, string> = {
    left: 'M3 3.4h10M3 6.2h6M3 9h10M3 11.8h6',
    centerH: 'M8 3.4h0M3 3.4h10M5 6.2h6M3 9h10M5 11.8h6',
    right: 'M3 3.4h10M7 6.2h6M3 9h10M7 11.8h6',
    top: 'M3.4 3v10M6.2 3v6M9 3v10M11.8 3v6',
    centerV: 'M3.4 3v10M6.2 5v6M9 3v10M11.8 5v6',
    bottom: 'M3.4 3v10M6.2 7v6M9 3v10M11.8 7v6',
  };
  return (
    <svg {...base(size)} aria-hidden>
      <path d={bars[dir] ?? bars.left} />
    </svg>
  );
};

export const IconDistribute = ({ size = 16, axis = 'h' }: Props & { axis?: 'h' | 'v' }) => (
  <svg {...base(size)} aria-hidden>
    {axis === 'h' ? (
      <>
        <path d="M2.8 2.6v10.8M13.2 2.6v10.8" />
        <rect x="6.4" y="4.6" width="3.2" height="6.8" rx="0.6" />
      </>
    ) : (
      <>
        <path d="M2.6 2.8h10.8M2.6 13.2h10.8" />
        <rect x="4.6" y="6.4" width="6.8" height="3.2" rx="0.6" />
      </>
    )}
  </svg>
);

export const IconArrow = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M2.8 8h9.6M8.8 4.4 12.4 8l-3.6 3.6" />
  </svg>
);

export const IconDisclosure = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M6.4 4.4 10.2 8l-3.8 3.6" />
  </svg>
);

export const IconNote = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M4 2.6h5.4L12 5.2v8.2H4z" />
    <path d="M9.2 2.8v2.6h2.6M6 8.4h4M6 10.8h2.8" />
  </svg>
);

export const IconFile = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M4 2.6h5.4L12 5.2v8.2H4z" />
    <path d="M9.2 2.8v2.6h2.6" />
  </svg>
);

export const IconCheck = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M3.2 8.4 6.4 11.6 12.8 4.8" />
  </svg>
);

export const IconCompute = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M2.4 5.4 8 2.6l5.6 2.8L8 8.2z" />
    <path d="M2.4 8.4 8 11.2l5.6-2.8" />
    <path d="M2.4 11.2 8 14l5.6-2.8" />
  </svg>
);

export const IconCoworker = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <circle cx="6" cy="5.4" r="2.6" />
    <path d="M1.8 13.4v-1.6a3.4 3.4 0 0 1 3.4-3.4h1.6" />
    <circle cx="11.4" cy="9.4" r="2.2" />
    <path d="M8.6 13.6v-.4a2.8 2.8 0 0 1 2.8-2.8h.4a2.8 2.8 0 0 1 2.4 1.4" />
  </svg>
);

export const IconLayers = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M3.4 9.6 8 12l4.6-2.4" />
    <path d="M3.4 6.4 8 8.8l4.6-2.4" />
    <path d="M8 2.6 13 5.2 8 7.8 3 5.2z" />
  </svg>
);

export const IconConnect = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M6.6 9.4 9.4 6.6" />
    <path d="M7.2 4.8 8.8 3.2a2.83 2.83 0 0 1 4 4l-1.6 1.6" />
    <path d="M8.8 11.2 7.2 12.8a2.83 2.83 0 0 1-4-4l1.6-1.6" />
  </svg>
);

export const IconChat = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <path d="M2.6 3.4h8.2v5.4H6.2L3.4 11V8.8h-.8z" />
    <path d="M13.4 6.6v5.2l-2.4-1.8H7.4" />
  </svg>
);

export const IconCopy = ({ size = 16 }: Props) => (
  <svg {...base(size)} aria-hidden>
    <rect x="5.6" y="5.6" width="7.8" height="7.8" />
    <path d="M10.4 5.6V2.6H2.6v7.8h3" />
  </svg>
);
