import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "play"
  | "pause"
  | "next"
  | "prev"
  | "volume"
  | "mute"
  | "search"
  | "plus"
  | "film"
  | "music"
  | "folder"
  | "clock"
  | "sliders"
  | "list"
  | "home"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "x"
  | "back"
  | "shuffle"
  | "repeat"
  | "pip"
  | "fullscreen"
  | "fullscreen-exit"
  | "trash"
  | "more"
  | "info"
  | "check"
  | "sun"
  | "moon"
  | "alert"
  | "expand"
  | "heart";

const PATHS: Record<IconName, ReactNode> = {
  play: <path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <path d="M7 5h3.4v14H7z" fill="currentColor" stroke="none" />
      <path d="M13.6 5H17v14h-3.4z" fill="currentColor" stroke="none" />
    </>
  ),
  next: (
    <>
      <path d="M5 4.5v15l11-7.5z" fill="currentColor" stroke="none" />
      <path d="M19 5v14" />
    </>
  ),
  prev: (
    <>
      <path d="M19 4.5v15L8 12z" fill="currentColor" stroke="none" />
      <path d="M5 5v14" />
    </>
  ),
  volume: (
    <>
      <path d="M11 5.5 6.5 9H3v6h3.5L11 18.5z" fill="currentColor" stroke="none" />
      <path d="M14.5 9.5a4.5 4.5 0 0 1 0 5" />
      <path d="M17 7.2a8 8 0 0 1 0 9.6" />
    </>
  ),
  mute: (
    <>
      <path d="M11 5.5 6.5 9H3v6h3.5L11 18.5z" fill="currentColor" stroke="none" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.6-4.6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  film: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </>
  ),
  music: (
    <>
      <path d="M9 18.5V6l11-2.5v12" />
      <circle cx="6.5" cy="18.5" r="2.5" />
      <circle cx="17.5" cy="15.5" r="2.5" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2.2" />
      <circle cx="15" cy="12" r="2.2" />
      <circle cx="7" cy="17" r="2.2" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
    </>
  ),
  "chevron-left": <path d="M14.5 6 8.5 12l6 6" />,
  "chevron-right": <path d="M9.5 6l6 6-6 6" />,
  "chevron-down": <path d="M6 9.5l6 6 6-6" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  shuffle: (
    <>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="M4 4h3" />
    </>
  ),
  repeat: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  pip: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <rect x="12" y="12.5" width="6" height="4" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  fullscreen: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  "fullscreen-exit": <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.01" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16v.01" />
    </>
  ),
  expand: <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />,
  heart: (
    <path d="M12 20.5S4.8 15.8 3 11.2a5.35 5.35 0 0 1 9.5-3.4A5.35 5.35 0 0 1 21 11.2c-1.8 4.6-9 9.3-9 9.3z" />
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
