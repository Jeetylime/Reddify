import type { CSSProperties } from 'react';

/** Hand-drawn 24px stroke icon set (1.7px stroke, round joins). Shapes marked SOLID fill when `fill` is set. */
const P = {
  home: 'M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z',
  flame: 'M12 3c.6 3 5 5.2 5 10.2A5 5 0 0 1 7 13.2c0-2 1-3.3 2-4.2.2 1.6 1 2.7 2 3.2C11 9.6 10.6 6 12 3z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18',
  bookmark: 'M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4.5 20.5c.7-3.6 3.8-5.5 7.5-5.5s6.8 1.9 7.5 5.5',
  bell: 'M6 10a6 6 0 0 1 12 0c0 5 2 6.5 2 7H4c0-.5 2-2 2-7zM10 20.5h4',
  mail: 'M4 5.5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM3.5 7l8.5 6 8.5-6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  up: 'M12 4 4.5 12.5H9V19.5h6V12.5h4.5z',
  down: 'M12 20 4.5 11.5H9V4.5h6v7h4.5z',
  comment: 'M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5z',
  share: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  'chev-down': 'M6 9.5l6 6 6-6',
  'chev-up': 'M6 14.5l6-6 6 6',
  'chev-right': 'M9.5 6l6 6-6 6',
  'chev-left': 'M14.5 6l-6 6 6 6',
  pin: 'M12 16v5M8.5 3.5h7l-1 5.5 3 3V14h-11v-2l3-3z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  settings: 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM10.3 3.5h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.6v1.9l1.8 1.6-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9 1.8-1.6v-1.9L4.2 8.9l1.7-2.9 2.3.8 1.6-.9z',
  comfortable: 'M4.5 4.5h15v6.5h-15zM4.5 14h15v5.5h-15z',
  compact: 'M4 5.5h16M4 10h16M4 14.5h16M4 19h16',
  gallery: 'M4 4h7v9.5H4zM13 4h7v6h-7zM13 12h7v8h-7zM4 15.5h7V20H4z',
  minimal: 'M4 6.5h16M4 12h11M4 17.5h14',
  sidebar: 'M4.5 4.5h15a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM9.5 4.5v15',
  menu: 'M4 7h16M4 12h16M4 17h16',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z',
  external: 'M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  image: 'M4.5 4.5h15a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM9 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM3.5 17l5-5 4 4 3-3 5 4.5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1',
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M8.5 5.5v13M15.5 5.5v13',
  'eye-off': 'M3.5 3.5l17 17M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.5 9.5 0 0 1 12 5c5 0 8.5 4 9.5 7a12.5 12.5 0 0 1-2.8 4.2M6.5 6.6C4.4 8 3 10.3 2.5 12c1 3 4.5 7 9.5 7 1.6 0 3-.4 4.2-1',
  eye: 'M2.5 12C3.5 9 7 5 12 5s8.5 4 9.5 7c-1 3-4.5 7-9.5 7s-8.5-4-9.5-7zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  refresh: 'M19.5 11A7.5 7.5 0 0 0 6 7.2L4.5 9M4.5 4.5V9H9M4.5 13A7.5 7.5 0 0 0 18 16.8l1.5-1.8M19.5 19.5V15H15',
  command: 'M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9zm0 0h6m-6 0v6m6-6V6.5A2.5 2.5 0 1 1 17.5 9H15zm0 0v6m0 0h2.5a2.5 2.5 0 1 1-2.5 2.5V15zm0 0H9m0 0H6.5A2.5 2.5 0 1 0 9 17.5V15z',
  keyboard: 'M3 6.5h18a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7.5 14h9',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z',
  top: 'M5 4h14M12 20V8.5M6.5 13.5 12 8l5.5 5.5',
  trend: 'M3.5 16.5l6-6 4 4 7-7M15 7.5h5.5V13',
  zap: 'M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z',
  sparkle: 'M12 3.5l1.7 5 5 1.7-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7zM18.5 16l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z',
  swap: 'M7 4 3.5 7.5 7 11M3.5 7.5h13M17 13l3.5 3.5L17 20M20.5 16.5h-13',
  trash: 'M4.5 7h15M10 11v6M14 11v6M6.5 7l1 13h9l1-13M9 7V4h6v3',
  'arrow-up': 'M12 19V5M5.5 11.5 12 5l6.5 6.5',
  'arrow-left': 'M19 12H5M11.5 5.5 5 12l6.5 6.5',
  collapse: 'M8 3.5v5H3M16 3.5v5h5M8 20.5v-5H3M16 20.5v-5h5',
  expand: 'M3.5 8.5v-5h5M20.5 8.5v-5h-5M3.5 15.5v5h5M20.5 15.5v5h-5',
  filter: 'M4 5h16l-6 7.5V19l-4 1.5v-8z',
  lock: 'M6.5 11h11a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 11v5M12 7.8h.01',
  alert: 'M12 4 2.8 19.5h18.4zM12 10v4.5M12 17h.01',
  volume: 'M4 9.5v5h3.5l5 4v-13l-5 4zM16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  mute: 'M4 9.5v5h3.5l5 4v-13l-5 4zM16.5 9.5l4.5 5M21 9.5l-4.5 5',
  maximize: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  layers: 'M12 3.5 3 8l9 4.5L21 8zM3 12.5l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5',
  edit: 'M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16zM13 7l4 4',
  copy: 'M9 9h10.5v11.5H9zM15 9V4.5H4.5V15H9',
} as const;

const SOLID = new Set(['up', 'down', 'play', 'bookmark', 'pin', 'star']);

export type IconName = keyof typeof P;

export function Icon({ name, size = 18, fill = false, style, className }: { name: IconName; size?: number; fill?: boolean; style?: CSSProperties; className?: string }) {
  const solid = fill && SOLID.has(name);
  return (
    <svg className={`ic ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill={solid ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: 'none' }}>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M10.5 23V9h6.4c3 0 4.9 1.7 4.9 4.3 0 1.9-1.1 3.3-2.9 3.9L22.4 23h-3.6l-3.2-5.5h-1.8V23zm3.3-8.3h2.9c1.2 0 1.9-.6 1.9-1.5s-.7-1.5-1.9-1.5h-2.9z" fill="var(--accent-fg)" />
    </svg>
  );
}
