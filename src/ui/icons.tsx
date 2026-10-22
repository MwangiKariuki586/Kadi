import type { JSX } from "preact";

export type IconName =
  | "home"
  | "play"
  | "book"
  | "settings"
  | "crown"
  | "trophy"
  | "users"
  | "user"
  | "dice"
  | "plus"
  | "check"
  | "chevronRight"
  | "chevronDown"
  | "arrowLeft"
  | "arrowRight"
  | "clock"
  | "flame"
  | "deck"
  | "power"
  | "pause"
  | "volume"
  | "sparkle"
  | "star"
  | "history"
  | "chart"
  | "shield"
  | "x"
  | "wifiOff"
  | "target"
  | "lock"
  | "trash"
  | "edit"
  | "copy";

const ICONS: Record<IconName, JSX.Element> = {
  home: (
    <>
      <path d="M3 10.6 12 3l9 7.6" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6.5h4V21h4a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  play: <path d="M8 5.4v13.2L19 12 8 5.4Z" fill="currentColor" stroke="none" />,
  book: (
    <>
      <path d="M4 19.2A2.8 2.8 0 0 1 6.8 16.4H20" />
      <path d="M6.8 3H20v18H6.8A2.8 2.8 0 0 1 4 18.2V5.8A2.8 2.8 0 0 1 6.8 3Z" />
      <path d="M8.5 7.5h7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.7h.01A1.7 1.7 0 0 0 10 3.14V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.7a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.3 9v.01A1.7 1.7 0 0 0 20.86 10H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
  crown: (
    <>
      <path d="M3 8.2 7.7 12 12 4.8 16.3 12 21 8.2l-2 11.3H5L3 8.2Z" />
      <path d="M7 16.5h10" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H4.5v1.5A3.5 3.5 0 0 0 8 10" />
      <path d="M16 5h3.5v1.5A3.5 3.5 0 0 1 16 10" />
      <path d="M12 12v4" />
      <path d="M8.5 20h7" />
      <path d="M10 16.5h4l.7 3.5H9.3l.7-3.5Z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" />
      <path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 20" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  check: <path d="m5 12.5 4.2 4.2L19 6.8" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronDown: <path d="m5 9 7 7 7-7" />,
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  flame: (
    <>
      <path d="M12 21c3.8 0 6.5-2.5 6.5-6 0-2.5-1.2-4.7-3.2-6.2.1 1.6-.8 2.8-2 3.1.4-3.4-1.4-6.2-4.2-7.9.2 2.7-3.6 4.8-3.6 9.5 0 4.4 2.8 7.5 6.5 7.5Z" />
    </>
  ),
  deck: (
    <>
      <rect x="7" y="3.5" width="11" height="16" rx="2" transform="rotate(8 12.5 11.5)" />
      <rect x="5.5" y="4.5" width="11" height="16" rx="2" />
      <path d="M9 9.5h4" />
    </>
  ),
  power: (
    <>
      <path d="M12 3v8" />
      <path d="M7.2 6.3a7.5 7.5 0 1 0 9.6 0" />
    </>
  ),
  pause: (
    <>
      <rect x="6.5" y="4" width="4" height="16" rx="1" />
      <rect x="13.5" y="4" width="4" height="16" rx="1" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9.5h3l4-3.5v12l-4-3.5H4v-5Z" />
      <path d="M15 9a4 4 0 0 1 0 6" />
      <path d="M17.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.5 13.8 9 19.5 11 13.8 13 12 18.5 10.2 13 4.5 11 10.2 9 12 3.5Z" />
      <path d="M18.5 16.5 19.3 19l2.2.8-2.2.8-.8 2.4-.8-2.4-2.2-.8 2.2-.8.8-2.5Z" />
    </>
  ),
  star: (
    <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5Z" />
  ),
  history: (
    <>
      <path d="M4 5.5V10h4.5" />
      <path d="M5.2 9A8 8 0 1 1 4.5 15" />
      <path d="M12 7.5V12l3.2 1.8" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16v-4" />
      <path d="M12.5 16V8" />
      <path d="M17 16v-6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.2c0 4.3-2.8 7.6-7 9.3-4.2-1.7-7-5-7-9.3V6l7-2.5Z" />
      <path d="m9 12 2.1 2.1L15 9.4" />
    </>
  ),
  x: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  wifiOff: (
    <>
      <path d="M3 4.5 21 20" />
      <path d="M8.5 15.5a5 5 0 0 1 7 0" />
      <path d="M5.5 12a10 10 0 0 1 3.6-2.3" />
      <path d="M14.9 9.7A10 10 0 0 1 18.5 12" />
      <path d="M2.5 8.5A15 15 0 0 1 8 5.2" />
      <path d="M16 5.2a15 15 0 0 1 5.5 3.3" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9 7V4.5h6V7" />
      <path d="M6.5 7 7.5 20h9L17.5 7" />
      <path d="M10.5 11v5" />
      <path d="M13.5 11v5" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4.5L19 9.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20Z" />
      <path d="m14.5 8 3 3" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
};

export function Icon({
  name,
  class: className = "h-5 w-5",
  strokeWidth = 1.8,
}: {
  name: IconName;
  class?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
