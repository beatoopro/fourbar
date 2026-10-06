import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 16, ...rest }: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...rest,
});

export const Play = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
  </svg>
);
export const Stop = (p: P) => (
  <svg {...base(p)}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
  </svg>
);
export const Heart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p)}>
    <path
      d="M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.4 5c2 0 3.6 1.2 4.6 2.7h2C14 6.2 15.6 5 17.6 5 21 5 22.7 8.4 21.2 11.4 19 15.6 12 20 12 20z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </svg>
);
export const Download = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" />
  </svg>
);
export const Remix = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h11l-3-3m3 3l-3 3M20 17H9l3 3m-3-3l3-3" />
  </svg>
);
export const Undo = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />
  </svg>
);
export const Redo = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" />
  </svg>
);
export const Pencil = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3" />
  </svg>
);
export const Cursor = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 3l14 7-6 2-2 6z" />
  </svg>
);
export const Chord = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="5" width="10" height="3" rx="1" />
    <rect x="4" y="10.5" width="10" height="3" rx="1" />
    <rect x="4" y="16" width="10" height="3" rx="1" />
    <path d="M18 8v8M14 12h8" />
  </svg>
);
export const Ghost = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 20V10a7 7 0 0114 0v10l-2.5-2-2.3 2-2.2-2-2.2 2L7.5 18z" />
    <circle cx="9.5" cy="10.5" r="0.8" fill="currentColor" />
    <circle cx="14.5" cy="10.5" r="0.8" fill="currentColor" />
  </svg>
);
export const Scale = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 10h16M4 14h16M4 18h16" opacity="0.4" />
    <path d="M4 6h8M4 14h12" />
  </svg>
);
export const ZoomIn = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5M8.5 11h5M11 8.5v5" />
  </svg>
);
export const ZoomOut = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5M8.5 11h5" />
  </svg>
);
export const Save = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" />
  </svg>
);
export const Upload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M5 19h14" />
  </svg>
);
export const Plus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const Trash = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
  </svg>
);
export const Search = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4-4" />
  </svg>
);
export const Sliders = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);
export const Keyboard = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
  </svg>
);
export const Wand = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20L15 9M13 4v3M18 9h3M17 5l2-2M17 13l1.5 1.5M9 5L7.5 3.5" />
  </svg>
);
export const Speaker = ({ muted, ...p }: P & { muted?: boolean }) => (
  <svg {...base(p)}>
    <path d="M4 9h4l5-4v14l-5-4H4z" />
    {muted ? <path d="M17 9l4 6M21 9l-4 6" /> : <path d="M17 9a4 4 0 010 6" />}
  </svg>
);
export const Wave = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 12h2l2-6 3 12 3-9 2 5 2-2h4" />
  </svg>
);
export const Close = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const Copy = (p: P) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
  </svg>
);
export const Magnet = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 4v8a6 6 0 0012 0V4h-4v8a2 2 0 01-4 0V4z" />
  </svg>
);
export const ArrowUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);
export const ArrowDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);
export const Metronome = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 21h8l-2-17h-4zM12 15l5-8" />
  </svg>
);
export const Comment = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 5h14a1 1 0 011 1v10a1 1 0 01-1 1h-8l-4 3v-3H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
  </svg>
);
export const Share = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 15V4m0 0L8 8m4-4l4 4M6 12v7a1 1 0 001 1h10a1 1 0 001-1v-7" />
  </svg>
);
export const Flag = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 21V4m0 0h11l-2 4 2 4H6" />
  </svg>
);
export const ArrowLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const Pin = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21s-6-5.3-6-10a6 6 0 0112 0c0 4.7-6 10-6 10z" />
    <circle cx="12" cy="11" r="2" />
  </svg>
);
