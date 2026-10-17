/** Hand-drawn-feel line icons, sized by the parent font-size. */
type P = { className?: string };
const base = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const Paw = ({ className }: P) => (
  <svg {...base} className={className} fill="currentColor" stroke="none">
    <ellipse cx="6" cy="9.5" rx="2.1" ry="2.6" />
    <ellipse cx="10" cy="5.8" rx="2.1" ry="2.6" />
    <ellipse cx="14.4" cy="5.8" rx="2.1" ry="2.6" />
    <ellipse cx="18.3" cy="9.6" rx="2.1" ry="2.6" />
    <path d="M12.2 11.2c-3.3 0-6.2 3.4-6.2 6.1 0 2 1.6 2.9 3.2 2.9 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.6 0 3.2-.9 3.2-2.9 0-2.7-2.9-6.1-6.2-6.1Z" />
  </svg>
);
export const Bag = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 8h14l-1.2 12H6.2L5 8Z" />
    <path d="M9 10V7a3 3 0 0 1 6 0v3" />
  </svg>
);
export const Truck = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </svg>
);
export const Return = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);
export const Lock = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
export const Nose = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 4c4 0 7 3 7 7 0 3-2 5-4 6l-3 3-3-3c-2-1-4-3-4-6 0-4 3-7 7-7Z" />
    <path d="M9.5 10.5h.01M14.5 10.5h.01" strokeWidth="3" />
  </svg>
);
export const Clock = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </svg>
);
export const Spark = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </svg>
);
export const Drop = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
  </svg>
);
export const Check = ({ className }: P) => (
  <svg {...base} className={className} strokeWidth={2.4}>
    <path d="m5 12.5 4.2 4L19 7" />
  </svg>
);
export const Close = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const Minus = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 12h12" />
  </svg>
);
export const Plus = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 6v12M6 12h12" />
  </svg>
);
export const Arrow = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const Mail = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
export const Star = ({ className }: P) => (
  <svg {...base} className={className} fill="currentColor" stroke="none">
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
  </svg>
);
