/** The platforms Orbit runs on, how to recognise them, and where to send people when they switch. */

export type PlatformId = 'reddit' | 'x' | 'youtube';

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  /** Longer label for menus. */
  label: string;
  /** One-line description shown in the switcher. */
  tagline: string;
  home: string;
  /** Hosts this platform is served from (Orbit runs on all of them). */
  hosts: RegExp;
}

export const PLATFORMS: Record<PlatformId, PlatformInfo> = {
  reddit: { id: 'reddit', name: 'Reddit', label: 'Reddit', tagline: 'Communities & discussions', home: 'https://www.reddit.com/', hosts: /^(www\.)?reddit\.com$/i },
  x: { id: 'x', name: 'X', label: 'X / Twitter', tagline: 'Real-time conversations', home: 'https://x.com/home', hosts: /^(www\.|mobile\.)?(x|twitter)\.com$/i },
  youtube: { id: 'youtube', name: 'YouTube', label: 'YouTube', tagline: 'Videos & creators', home: 'https://www.youtube.com/', hosts: /^(www\.|m\.)?youtube\.com$/i },
};

export const PLATFORM_ORDER: PlatformId[] = ['reddit', 'x', 'youtube'];

export function detectPlatform(host: string = location.hostname): PlatformId | null {
  for (const id of PLATFORM_ORDER) if (PLATFORMS[id].hosts.test(host)) return id;
  return null;
}

export function platformOfUrl(url: string | undefined): PlatformId | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return detectPlatform(u.hostname);
  } catch { return null; }
}

/* ---------- Remembered locations (so switching back resumes where you were) ---------- */

export interface Spot { url: string; title: string; at: number }
export type Spots = Partial<Record<PlatformId, Spot>>;

const KEY = 'orbitSpots';
const hasChrome = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

export async function loadSpots(): Promise<Spots> {
  if (!hasChrome()) return {};
  try { return ((await chrome.storage.local.get(KEY))[KEY] as Spots | undefined) ?? {}; } catch { return {}; }
}

/** Never remember transient or sensitive pages (log-in flows, composers, media viewers). */
const TRANSIENT = /\/(login|logout|signup|i\/flow|i\/jf|i\/oauth2?|oauth|account\/|compose\/|settings\/password|message\/compose|signin|ServiceLogin)|\/(photo|video)\/\d+\/?$/i;

export async function rememberSpot(id: PlatformId, url: string, title: string): Promise<void> {
  if (!hasChrome() || TRANSIENT.test(new URL(url).pathname)) return;
  try {
    const spots = await loadSpots();
    spots[id] = { url, title: title.slice(0, 80), at: Date.now() };
    await chrome.storage.local.set({ [KEY]: spots });
  } catch { /* history is best-effort */ }
}

let timer = 0;
/** Debounced: call on every in-app navigation. */
export function trackSpot(id: PlatformId, title: () => string) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void rememberSpot(id, location.href, title()), 600);
}

/** Where switching to `target` should land: the remembered spot when allowed, otherwise the platform's home. */
export function destination(target: PlatformId, spots: Spots, remember: boolean): string {
  const spot = remember ? spots[target] : undefined;
  if (spot && platformOfUrl(spot.url) === target) return spot.url;
  return PLATFORMS[target].home;
}

/** Leaves the current platform for `target` in this tab, saving where we were first. */
export async function switchTo(target: PlatformId, from: PlatformId | null, remember: boolean, currentTitle: string): Promise<void> {
  if (from) {
    window.clearTimeout(timer);
    await rememberSpot(from, location.href, currentTitle);
  }
  const spots = await loadSpots();
  location.assign(destination(target, spots, remember));
}

/** A short human label for a remembered spot ("r/design", "Bookmarks", …). */
export function spotLabel(spot: Spot | undefined): string | undefined {
  if (!spot) return undefined;
  const t = spot.title.replace(/^\(\d+\)\s*/, '').replace(/\s*[·/|-]\s*(Orbit|X|YouTube)\s*$/i, '').replace(/^Orbit\s*·\s*/i, '').trim();
  return t || undefined;
}
