import { useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, mergeSettings, saveSettings } from '@core/settings';
import type { Settings, YouTubeSettings } from '@core/settings';
import type { ToastItem } from '@core/shell';
import type { Account, GuideData, NativeChip, Session } from './dom';
import type { YTRoute } from './routes';

export interface YTState {
  settings: Settings;
  route: YTRoute;
  session: Session;
  account: Account | null;
  guide: GuideData;
  chips: NativeChip[];
  notifications: number;
  overlay: boolean;
  fullscreen: boolean;
  palette: boolean;
  help: boolean;
  narrow: boolean;
  drawer: boolean;
  edit: boolean;
  recent: string[];
  toasts: ToastItem[];
}

let state: YTState = {
  settings: DEFAULT_SETTINGS, route: { kind: 'other', key: '' }, session: 'unknown', account: null,
  guide: { you: [], subscriptions: [], explore: [], more: [] }, chips: [], notifications: 0, overlay: false, fullscreen: false,
  palette: false, help: false, narrow: false, drawer: false, edit: false, recent: [], toasts: [],
};
const subs = new Set<() => void>();

export const getYT = () => state;
export function setYT(patch: Partial<YTState> | ((s: YTState) => Partial<YTState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  if (!(Object.keys(p) as (keyof YTState)[]).some((k) => state[k] !== p[k])) return;
  state = { ...state, ...p };
  subs.forEach((l) => l());
}
export function useYT<T>(sel: (s: YTState) => T): T {
  return useSyncExternalStore((l) => { subs.add(l); return () => { subs.delete(l); }; }, () => sel(state));
}

let timer = 0;
export function updateSettings(patch: Partial<Settings>) {
  const next = mergeSettings({ ...state.settings, ...patch });
  setYT({ settings: next });
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void saveSettings(next), 150);
}
export const updateYT = (patch: Partial<YouTubeSettings>) => updateSettings({ youtube: { ...state.settings.youtube, ...patch } });

let toastId = 1;
export function toast(text: string, kind: ToastItem['kind'] = 'info') {
  const id = toastId++;
  setYT((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind }] }));
  window.setTimeout(() => setYT((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 4800 : 2400);
}

/* Recent searches stay on this device. */
const RECENT = 'orbitYTSearches';
export async function loadRecent() {
  try { setYT({ recent: ((await chrome.storage.local.get(RECENT))[RECENT] as string[] | undefined) ?? [] }); } catch { /* optional */ }
}
export function rememberSearch(q: string) {
  const t = q.trim();
  if (!t) return;
  const recent = [t, ...state.recent.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 10);
  setYT({ recent });
  try { void chrome.storage.local.set({ [RECENT]: recent }); } catch { /* optional */ }
}
export function forgetSearches() {
  setYT({ recent: [] });
  try { void chrome.storage.local.remove(RECENT); } catch { /* optional */ }
}
