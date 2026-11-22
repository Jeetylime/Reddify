/** Persistent preferences (chrome.storage.sync) and per-device history (chrome.storage.local). */

export type Theme = 'dark' | 'light' | 'system';
export type Layout = 'comfortable' | 'compact' | 'gallery' | 'minimal';
export type Density = 'cozy' | 'regular' | 'tight';
export type SidebarMode = 'expanded' | 'compact';
export type SectionId = 'feeds' | 'pinned' | 'quick' | 'recent' | 'subs' | 'you';

export interface QuickLink { id: string; label: string; url: string }

export interface HideOptions {
  voteScore: boolean;
  awards: boolean;
  flairs: boolean;
  subIcons: boolean;
  domain: boolean;
  layoutSwitcher: boolean;
  backToTop: boolean;
  rail: boolean;
}

/* ---------- X (Twitter) ---------- */

export type XPostStyle = 'cards' | 'list';
export type XMediaSize = 'compact' | 'balanced' | 'full';
export type XDefaultFeed = 'remember' | 'foryou' | 'following';

/** Preferences that only affect X. Kept in their own object so Reddit choices never leak into X and vice versa. */
export interface XSettings {
  postStyle: XPostStyle;
  mediaSize: XMediaSize;
  defaultFeed: XDefaultFeed;
  hidePromoted: boolean;
  hideWhoToFollow: boolean;
  hideTrends: boolean;
  hidePremium: boolean;
  hideRail: boolean;
  hideViews: boolean;
  hideComposer: boolean;
  lightbox: boolean;
  threadFocus: boolean;
}

export const DEFAULT_X: XSettings = {
  postStyle: 'cards',
  mediaSize: 'balanced',
  defaultFeed: 'remember',
  hidePromoted: true,
  hideWhoToFollow: false,
  hideTrends: false,
  hidePremium: true,
  hideRail: false,
  hideViews: false,
  hideComposer: false,
  lightbox: true,
  threadFocus: true,
};

/* ---------- YouTube ---------- */

export type YTGrid = 'comfortable' | 'compact' | 'editorial';
export type YTThumb = 'small' | 'medium' | 'large';
export type YTRecs = 'sidebar' | 'grid' | 'list';
export type YTWatchWidth = 'standard' | 'wide' | 'immersive';
export type YTComments = 'threaded' | 'compact';
export type YTShorts = 'focused' | 'classic';
export type YTSection = 'pinned' | 'main' | 'you' | 'subscriptions' | 'explore' | 'more';

/** Preferences that only affect YouTube. */
export interface YouTubeSettings {
  grid: YTGrid;
  thumbSize: YTThumb;
  recommendations: YTRecs;
  watchWidth: YTWatchWidth;
  comments: YTComments;
  shorts: YTShorts;
  descriptions: boolean;
  hideShortsShelves: boolean;
  hideNewsShelves: boolean;
  hideChips: boolean;
  collapseComments: boolean;
  /** Sidebar customisation: pinned item ids, hidden item ids, section order and collapsed sections. */
  navPinned: string[];
  navHidden: string[];
  navOrder: YTSection[];
  navCollapsed: YTSection[];
}

export const DEFAULT_YOUTUBE: YouTubeSettings = {
  grid: 'comfortable',
  thumbSize: 'medium',
  recommendations: 'sidebar',
  watchWidth: 'wide',
  comments: 'threaded',
  shorts: 'focused',
  descriptions: true,
  hideShortsShelves: false,
  hideNewsShelves: false,
  hideChips: false,
  collapseComments: false,
  navPinned: [],
  navHidden: [],
  navOrder: ['pinned', 'main', 'you', 'subscriptions', 'explore', 'more'],
  navCollapsed: ['explore'],
};

export type FontChoice = 'system' | 'rounded' | 'serif';
export type Motion = 'system' | 'full' | 'reduced';
export interface PlatformToggles { reddit: boolean; x: boolean; youtube: boolean }

/**
 * Everything Orbit remembers. The storage shape is flat for backwards compatibility:
 * - Shared (every platform): enabled, platforms, theme, accent, font, fontSize, lineHeight, density, motion,
 *   sidebarMode, sidebarWidth, contentWidth, keyboard, rememberState, externalInNewTab.
 * - Reddit only: everything else at the top level (layout, filters, sidebar sections, …).
 * - X only: the `x` object. YouTube only: the `youtube` object.
 */
export interface Settings {
  enabled: boolean;
  platforms: PlatformToggles;
  theme: Theme;
  accent: string;
  font: FontChoice;
  motion: Motion;
  rememberState: boolean;
  layout: Layout;
  density: Density;
  sidebarMode: SidebarMode;
  sidebarWidth: number;
  contentWidth: number;
  fontSize: number;
  lineHeight: number;
  readingMode: boolean;
  compactMedia: boolean;
  autoplayVideo: boolean;
  hidePromoted: boolean;
  blurNsfw: boolean;
  blurSpoilers: boolean;
  dimVisited: boolean;
  hideCrossposts: boolean;
  keyboard: boolean;
  externalInNewTab: boolean;
  defaultCommentSort: string;
  autoCollapseDepth: number;
  badge: boolean;
  navOrder: SectionId[];
  navHidden: SectionId[];
  pinnedSubs: string[];
  quickLinks: QuickLink[];
  mutedSubs: string[];
  mutedKeywords: string[];
  hide: HideOptions;
  x: XSettings;
  youtube: YouTubeSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  platforms: { reddit: true, x: true, youtube: true },
  theme: 'dark',
  accent: '#7c83ff',
  font: 'system',
  motion: 'system',
  rememberState: true,
  layout: 'comfortable',
  density: 'regular',
  sidebarMode: 'expanded',
  sidebarWidth: 244,
  contentWidth: 760,
  fontSize: 14,
  lineHeight: 1.55,
  readingMode: false,
  compactMedia: false,
  autoplayVideo: false,
  hidePromoted: true,
  blurNsfw: true,
  blurSpoilers: true,
  dimVisited: true,
  hideCrossposts: false,
  keyboard: true,
  externalInNewTab: true,
  defaultCommentSort: 'confidence',
  autoCollapseDepth: 0,
  badge: true,
  navOrder: ['feeds', 'pinned', 'quick', 'recent', 'subs', 'you'],
  navHidden: [],
  pinnedSubs: [],
  quickLinks: [],
  mutedSubs: [],
  mutedKeywords: [],
  hide: { voteScore: false, awards: false, flairs: false, subIcons: false, domain: false, layoutSwitcher: false, backToTop: false, rail: false },
  x: DEFAULT_X,
  youtube: DEFAULT_YOUTUBE,
};

export const SECTION_LABELS: Record<SectionId, string> = {
  feeds: 'Feeds',
  pinned: 'Pinned',
  quick: 'Quick access',
  recent: 'Recent',
  subs: 'Your communities',
  you: 'You',
};

export const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: 'Indigo', value: '#7c83ff' },
  { name: 'Ember', value: '#ff6a3d' },
  { name: 'Emerald', value: '#2fc58a' },
  { name: 'Sky', value: '#4aa8ff' },
  { name: 'Rose', value: '#ff5c8a' },
  { name: 'Amber', value: '#f0b429' },
  { name: 'Violet', value: '#b074ff' },
  { name: 'Graphite', value: '#c9ccd6' },
];

export function mergeSettings(raw: Partial<Settings> | undefined | null): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) } as Settings;
  s.hide = { ...DEFAULT_SETTINGS.hide, ...(raw?.hide ?? {}) };
  s.x = { ...DEFAULT_X, ...(raw?.x ?? {}) };
  s.youtube = { ...DEFAULT_YOUTUBE, ...(raw?.youtube ?? {}) };
  const ytKnown = new Set(DEFAULT_YOUTUBE.navOrder);
  const ytOrder = (Array.isArray(s.youtube.navOrder) ? s.youtube.navOrder : []).filter((x) => ytKnown.has(x));
  for (const id of DEFAULT_YOUTUBE.navOrder) if (!ytOrder.includes(id)) ytOrder.push(id);
  s.youtube.navOrder = ytOrder;
  s.platforms = { ...DEFAULT_SETTINGS.platforms, ...(raw?.platforms ?? {}) };
  const known = new Set(DEFAULT_SETTINGS.navOrder);
  const order = (Array.isArray(s.navOrder) ? s.navOrder : []).filter((x) => known.has(x));
  for (const id of DEFAULT_SETTINGS.navOrder) if (!order.includes(id)) order.push(id);
  s.navOrder = order;
  return s;
}

const hasChrome = () => typeof chrome !== 'undefined' && !!chrome.storage;

export async function loadSettings(): Promise<Settings> {
  if (!hasChrome()) return DEFAULT_SETTINGS;
  try {
    const [sync, local] = await Promise.all([chrome.storage.sync.get('settings'), chrome.storage.local.get('settingsFallback')]);
    return mergeSettings((sync.settings ?? local.settingsFallback) as Partial<Settings> | undefined);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  if (!hasChrome()) return;
  try {
    await chrome.storage.sync.set({ settings: s });
  } catch {
    // sync quota exceeded (e.g. very long filter lists) — keep working with local storage
    await chrome.storage.local.set({ settingsFallback: s });
  }
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  if (!hasChrome()) return () => {};
  const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
    const c = changes.settings ?? changes.settingsFallback;
    if (c?.newValue) cb(mergeSettings(c.newValue as Partial<Settings>));
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/* ---------- Local, per-device history ---------- */

export interface RecentSub { name: string; icon?: string; at: number }
export interface RecentPost {
  id: string; title: string; sub: string; permalink: string; thumb?: string; at: number; score?: number; comments?: number;
}
export interface LocalData {
  recentSubs: RecentSub[];
  recentPosts: RecentPost[];
  recentSearches: string[];
  visited: string[];
}
export const DEFAULT_LOCAL: LocalData = { recentSubs: [], recentPosts: [], recentSearches: [], visited: [] };

export async function loadLocal(): Promise<LocalData> {
  if (!hasChrome()) return DEFAULT_LOCAL;
  try {
    const got = await chrome.storage.local.get('local');
    return { ...DEFAULT_LOCAL, ...(got.local as Partial<LocalData> | undefined) };
  } catch {
    return DEFAULT_LOCAL;
  }
}

export async function saveLocal(d: LocalData): Promise<void> {
  if (!hasChrome()) return;
  try { await chrome.storage.local.set({ local: d }); } catch { /* quota: history is best-effort */ }
}

export function onLocalChanged(cb: (d: LocalData) => void): () => void {
  if (!hasChrome()) return () => {};
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes.local) cb({ ...DEFAULT_LOCAL, ...(changes.local.newValue as Partial<LocalData>) });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/* ---------- Theme helpers (shared by app, options and popup) ---------- */

export function resolveTheme(t: Theme): 'dark' | 'light' {
  if (t === 'system') return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  return t;
}

export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111216' : '#ffffff';
}

export const FONT_STACKS: Record<FontChoice, string> = {
  system: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue", system-ui, sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Quicksand", -apple-system, "Segoe UI", system-ui, sans-serif',
  serif: '"Iowan Old Style", "Charter", "Source Serif Pro", Georgia, ui-serif, serif',
};

/** True when Orbit should drop animations (explicit preference, or the OS asks for reduced motion). */
export function reducedMotion(s: Settings): boolean {
  if (s.motion === 'reduced') return true;
  if (s.motion === 'full') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** CSS custom properties derived from settings. */
export function themeVars(s: Settings): Record<string, string> {
  const d = { cozy: ['14px', '1.12'], regular: ['10px', '1'], tight: ['6px', '0.86'] }[s.density];
  const vars: Record<string, string> = {
    '--accent': s.accent,
    '--accent-fg': readableOn(s.accent),
    '--fs': `${s.fontSize}px`,
    '--lh': String(s.lineHeight),
    '--content-w': `${s.contentWidth}px`,
    '--sidebar-w': `${s.sidebarMode === 'compact' ? 64 : s.sidebarWidth}px`,
    '--pad-y': d[0],
    '--density': d[1],
  };
  // The serif choice is a reading font: it applies to post bodies only (--font-read), never to UI chrome.
  if (s.font === 'rounded') vars['--font'] = FONT_STACKS.rounded;
  vars['--font-read'] = s.font === 'serif' ? FONT_STACKS.serif : 'var(--font)';
  if (reducedMotion(s)) { vars['--t-fast'] = '0ms'; vars['--t'] = '0ms'; }
  return vars;
}

/** Is Orbit active for this platform at all? */
export function platformEnabled(s: Settings, p: keyof PlatformToggles): boolean {
  return s.enabled && s.platforms[p] !== false;
}
