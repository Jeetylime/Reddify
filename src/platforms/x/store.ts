import { useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, mergeSettings, saveSettings } from '@core/settings';
import type { Settings, XSettings } from '@core/settings';
import type { Account, NativeTab, Session } from './dom';
import type { XRoute } from './routes';
import type { ReadPost } from './decorate';

export interface Lightbox { images: string[]; index: number; post?: ReadPost }
export interface Toast { id: number; text: string; kind: 'info' | 'success' | 'error' }

export interface XState {
  settings: Settings;
  route: XRoute;
  session: Session;
  account: Account | null;
  badges: { notifications: number; messages: number };
  tabs: NativeTab[];
  pageTitle: [string, string?] | null;
  messagesPath: string;
  overlay: boolean;
  palette: boolean;
  help: boolean;
  reader: { posts: ReadPost[]; author?: string } | null;
  lightbox: Lightbox | null;
  filter: string;
  filterCount: number;
  narrow: boolean;
  toasts: Toast[];
}

let state: XState = {
  settings: DEFAULT_SETTINGS, route: { kind: 'other', key: '' }, session: 'unknown', account: null, badges: { notifications: 0, messages: 0 },
  tabs: [], pageTitle: null, messagesPath: '/messages', overlay: false, palette: false, help: false, reader: null, lightbox: null, filter: '', filterCount: 0,
  narrow: false, toasts: [],
};
const subs = new Set<() => void>();

export const getX = () => state;
export function setX(patch: Partial<XState> | ((s: XState) => Partial<XState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  let changed = false;
  for (const k of Object.keys(p) as (keyof XState)[]) if (state[k] !== p[k]) { changed = true; break; }
  if (!changed) return;
  state = { ...state, ...p };
  subs.forEach((l) => l());
}
export function useX<T>(sel: (s: XState) => T): T {
  return useSyncExternalStore((l) => { subs.add(l); return () => { subs.delete(l); }; }, () => sel(state));
}

let timer = 0;
/** Updates shared settings from the X UI (synced to every platform). */
export function updateSettings(patch: Partial<Settings>) {
  const next = mergeSettings({ ...state.settings, ...patch });
  setX({ settings: next });
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void saveSettings(next), 150);
}
/** Updates X-only settings. */
export const updateX = (patch: Partial<XSettings>) => updateSettings({ x: { ...state.settings.x, ...patch } });

let toastId = 1;
export function toast(text: string, kind: Toast['kind'] = 'info') {
  const id = toastId++;
  setX((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind }] }));
  window.setTimeout(() => setX((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 4800 : 2400);
}
