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
  hash: 'M9.5 3.5 7.5 20.5M16.5 3.5l-2 17M4 8.5h16.5M3.5 15.5H20',
  list: 'M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  users: 'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 19.5c.6-3.2 3.2-5 6.5-5s5.9 1.8 6.5 5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .6 3.2 2.2 3.5 4.7',
  'more-h': 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM8 12h.01M12 12h.01M16 12h.01',
  feather: 'M5 19 15.5 8.5M19.5 4.5c-6 0-11 3.6-12 11.5l-1 3.5 3.5-1c7.9-1 11.5-6 11.5-12z',
  repost: 'M4.5 9.5V8a2.5 2.5 0 0 1 2.5-2.5h11.5M15.5 2.5l3 3-3 3M19.5 14.5V16a2.5 2.5 0 0 1-2.5 2.5H5.5M8.5 21.5l-3-3 3-3',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z',
  chart: 'M5 20V11M10 20V5M15 20v-7M20 20V8',
  quote: 'M10 7.5H6.5A1.5 1.5 0 0 0 5 9v3.5h4.5V17A1.5 1.5 0 0 1 8 18.5M19 7.5h-3.5A1.5 1.5 0 0 0 14 9v3.5h4.5V17a1.5 1.5 0 0 1-1.5 1.5',
  book: 'M4.5 5A1.5 1.5 0 0 1 6 3.5h5.5A1.5 1.5 0 0 1 13 5v15.5a2 2 0 0 0-2-2H4.5zM19.5 5A1.5 1.5 0 0 0 18 3.5h-3.5A1.5 1.5 0 0 0 13 5v15.5a2 2 0 0 1 2-2h4.5z',
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  density: 'M4 5h16M4 9.5h16M4 14h16M4 18.5h16',
  logout: 'M14.5 4.5h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4M10 16.5 14.5 12 10 7.5M14.5 12H3.5',
  sparkles: 'M10 4l1.5 4.5L16 10l-4.5 1.5L10 16l-1.5-4.5L4 10l4.5-1.5zM17.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  shorts: 'M9 3.5h6a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3zM10.5 9.5v5l4-2.5z',
  subs: 'M5 8.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1zM6.5 5.5h11M8.5 2.5h7M10.5 11.5v5l4-2.5z',
  video: 'M4 6.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM16 10.5l5-3v9l-5-3',
  thumb: 'M7.5 10.5v9H4.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7.5 10.5l3.5-7a2 2 0 0 1 2 2V9h5.2a1.8 1.8 0 0 1 1.8 2.1l-1.2 6.8a2 2 0 0 1-2 1.6H7.5',
  library: 'M4.5 4v16M8.5 4v16M12.5 5l5.5 14.5M15.5 4.5l1.5.5',
  music: 'M9 18V5.5l10-2V16M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  gamepad: 'M7 8.5h10a4 4 0 0 1 4 4v1.5a3 3 0 0 1-5.4 1.8L14.5 14.5h-5l-1.1 1.3A3 3 0 0 1 3 14v-1.5a4 4 0 0 1 4-4zM7.5 11v3M6 12.5h3M15.5 12h.01M17.5 13.5h.01',
  theater: 'M3.5 6.5h17v11h-17zM7 10l-2 2 2 2M17 10l2 2-2 2',
  help: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM9.6 9.5a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6M12 17h.01',
} as const;

const SOLID = new Set(['up', 'down', 'play', 'bookmark', 'pin', 'star', 'heart']);

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

/** The Orbit mark: a ring with a satellite — one product, many worlds. Follows the user's accent colour. */
export const ORBIT_RING = { cx: 58, cy: 70, r: 28, w: 13 };
export const ORBIT_MOON = { cx: 96, cy: 32, r: 12 };

let logoId = 0;
export function Logo({ size = 24, title }: { size?: number; title?: string }) {
  const id = `orb-logo-${++logoId}`;
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} style={{ flex: 'none' }}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".26" /><stop offset=".55" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="128" height="128" rx="30" fill="var(--accent)" />
      <rect width="128" height="128" rx="30" fill={`url(#${id})`} />
      <circle cx={ORBIT_RING.cx} cy={ORBIT_RING.cy} r={ORBIT_RING.r} fill="none" stroke="var(--accent-fg)" strokeWidth={ORBIT_RING.w} />
      <circle cx={ORBIT_MOON.cx} cy={ORBIT_MOON.cy} r={ORBIT_MOON.r} fill="var(--accent-fg)" />
    </svg>
  );
}

/** Small, recognisable platform glyphs for the switcher and settings. */
export function PlatformIcon({ id, size = 28 }: { id: 'reddit' | 'x' | 'youtube'; size?: number }) {
  if (id === 'youtube') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: 'none' }}>
        <rect width="32" height="32" rx="9" fill="#ff0033" />
        <rect x="5.5" y="9" width="21" height="14" rx="4.5" fill="#fff" />
        <path d="M14 12.6v6.8l5.8-3.4z" fill="#ff0033" />
      </svg>
    );
  }
  if (id === 'reddit') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: 'none' }}>
        <rect width="32" height="32" rx="9" fill="#ff4500" />
        <circle cx="22.6" cy="8.2" r="2.1" fill="#fff" />
        <path d="M16.2 11.2 17.6 6.3l5 1.4" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8.6" cy="15" r="2.2" fill="#fff" /><circle cx="23.4" cy="15" r="2.2" fill="#fff" />
        <ellipse cx="16" cy="18.6" rx="8.6" ry="6.4" fill="#fff" />
        <circle cx="12.6" cy="17.6" r="1.6" fill="#ff4500" /><circle cx="19.4" cy="17.6" r="1.6" fill="#ff4500" />
        <path d="M12.8 21.2c1.9 1.3 4.5 1.3 6.4 0" fill="none" stroke="#ff4500" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: 'none' }}>
      <rect width="32" height="32" rx="9" fill="#0f1012" />
      <rect x=".5" y=".5" width="31" height="31" rx="8.5" fill="none" stroke="#fff" strokeOpacity=".14" />
      <path d="M8.6 8h4.6l10.2 16h-4.6z" fill="#fff" />
      <path d="M22.6 8 17.2 14.2M14.6 17.4 9 24" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
