/** Jednoduché čiarové ikony rozhrania (žiadne emoji, farba z `currentColor`). */
const PATHS = {
  people:
    'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M17 11.5a2.5 2.5 0 1 0 0-5M16 14.2c3 .2 5.5 2.3 5.5 5.8',
  workers: 'M14.5 6.5l3 3M4 20l8.5-8.5M15 4l5 5-3 3-5-5z',
  smile:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 14.5c1 1.4 2.3 2 4 2s3-.6 4-2M9 9.5h.01M15 9.5h.01',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  research: 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7.5 14h9',
  milestones: 'M5 21V4M5 4h11l-2 4 2 4H5',
  trade: 'M12 3v18M5 7h14M5 7l-3 7h6zM19 7l-3 7h6zM8 21h8',
  statistics: 'M4 20h16M7 16v-5M12 16V7M17 16v-8',
  saves: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  lock: 'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3',
  close: 'M6 6l12 12M18 6L6 18',
  pause: 'M8 5v14M16 5v14',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 18,
  label,
}: {
  name: IconName;
  size?: number;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="square"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
