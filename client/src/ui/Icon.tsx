const P: Record<string, string> = {
  image: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 16l5-5 4 4 3-3 6 6M9 9.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0",
  video: "M3 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM15 10l6-4v12l-6-4z",
  audio: "M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  text: "M4 6h16M4 12h16M4 18h10",
  cube: "M12 2 21 7v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  close: "M18 6 6 18M6 6l12 12",
  check: "M20 6 9 17l-5-5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-5M12 8h.01",
  warn: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  star: "M12 2.5l2.9 5.9 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.3l6.6-.9z",
  copy: "M9 9h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  download: "M12 3v12M7 11l5 5 5-5M4 20h16",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4h6v3",
  pin: "M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z",
  layers: "M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2",
  play: "M7 4l12 8-12 8z",
  stop: "M6 6h12v12H6z",
  refresh: "M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6",
  book: "M4 4a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 1 2-2h13",
  save: "M5 3h11l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 3v6h8V3M8 21v-6h8v6",
  upload: "M12 17V5M7 9l5-5 5 5M4 20h16",
  wand: "M15 4V2M15 10V8M12 7h-2M20 7h-2M17.3 4.7l-1.4 1.4M14.1 7.9l-1.4 1.4M3 21l9-9",
  zap: "M4 14h7l-1 7 10-11h-7l1-7z",
  dollar: "M12 2v20M17 6.5c0-2-2.2-3.5-5-3.5S7 4.5 7 6.5 9.2 10 12 10s5 1.5 5 3.5-2.2 3.5-5 3.5-5-1.5-5-3.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  menu: "M4 7h16M4 12h16M4 17h16",
  external: "M14 4h6v6M20 4l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-5",
};

export type IconName = keyof typeof P;

export default function Icon({
  name,
  className = "",
  label,
  strokeWidth = 1.7,
}: {
  name: IconName | string;
  className?: string;
  label?: string;
  strokeWidth?: number;
}) {
  const d = P[name] ?? P.info;
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-[1.15em] shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}
