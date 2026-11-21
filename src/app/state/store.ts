import { useSyncExternalStore } from 'react';
import { DEFAULT_LOCAL, DEFAULT_SETTINGS, loadLocal, loadSettings, mergeSettings, onLocalChanged, onSettingsChanged, saveLocal, saveSettings } from '../../shared/settings';
import type { LocalData, Settings } from '../../shared/settings';
import type { Community, Me, Post, Votable, Vote } from '../api/types';
import * as api from '../api/reddit';

export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'success'; action?: { label: string; run: () => void } }
export interface LightboxItem { url: string; w: number; h: number; caption?: string }
export interface LightboxState { items: LightboxItem[]; index: number; title?: string; video?: { url: string; audioUrl?: string; poster?: string; w: number; h: number; gif: boolean } }
interface Override { likes?: Vote; saved?: boolean; hidden?: boolean }

export interface AppState {
  settings: Settings;
  local: LocalData;
  ready: boolean;
  me: Me | null | undefined; // undefined while the session is being checked
  mySubs: Community[];
  toasts: Toast[];
  palette: boolean;
  help: boolean;
  drawer: boolean;
  sidebarEdit: boolean;
  mobileNav: boolean;
  lightbox: LightboxState | null;
  focused: string | null; // fullname of the keyboard-focused post/comment
  overrides: Record<string, Override>;
}

let state: AppState = {
  settings: DEFAULT_SETTINGS, local: DEFAULT_LOCAL, ready: false, me: undefined, mySubs: [], toasts: [],
  palette: false, help: false, drawer: false, sidebarEdit: false, mobileNav: false, lightbox: null, focused: null, overrides: {},
};
const subs = new Set<() => void>();

export const getState = () => state;
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach((l) => l());
}
const subscribe = (l: () => void) => { subs.add(l); return () => { subs.delete(l); }; };

export function useApp<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

/* ---------- settings & local data ---------- */

let saveTimer = 0;
export function updateSettings(patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) {
  const p = typeof patch === 'function' ? patch(state.settings) : patch;
  const next = mergeSettings({ ...state.settings, ...p, hide: { ...state.settings.hide, ...(p.hide ?? {}) } });
  setState({ settings: next });
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void saveSettings(next), 150);
}

let localTimer = 0;
export function updateLocal(fn: (d: LocalData) => LocalData) {
  const next = fn(state.local);
  setState({ local: next });
  window.clearTimeout(localTimer);
  localTimer = window.setTimeout(() => void saveLocal(next), 300);
}

export async function initStore() {
  const [settings, local] = await Promise.all([loadSettings(), loadLocal()]);
  setState({ settings, local, ready: true });
  onSettingsChanged((s) => { if (JSON.stringify(s) !== JSON.stringify(state.settings)) setState({ settings: s }); });
  onLocalChanged((d) => setState({ local: d }));
  void refreshMe();
}

export async function refreshMe() {
  const me = await api.fetchMe();
  api.setSession(me);
  setState({ me });
  if (me) api.fetchMySubs().then((mySubs) => setState({ mySubs })).catch(() => { /* sidebar list is optional */ });
}

/* ---------- toasts ---------- */

let toastId = 1;
export function toast(text: string, kind: Toast['kind'] = 'info', action?: Toast['action']) {
  const id = toastId++;
  setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind, action }] }));
  window.setTimeout(() => dismissToast(id), action ? 6000 : kind === 'error' ? 5200 : 2600);
}
export const dismissToast = (id: number) => setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));

/* ---------- history ---------- */

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function visitSub(name: string, icon?: string) {
  if (!name || /^(popular|all)$/i.test(name) || name.includes('+')) return;
  const prev = state.local.recentSubs.find((r) => same(r.name, name));
  if (prev && prev === state.local.recentSubs[0] && prev.name === name && (prev.icon || !icon)) return;
  updateLocal((d) => ({ ...d, recentSubs: [{ name, icon: icon ?? prev?.icon, at: Date.now() }, ...d.recentSubs.filter((r) => !same(r.name, name))].slice(0, 30) }));
}

export function visitPost(p: Post) {
  const thumb = p.media?.kind === 'image' ? (p.media.preview ?? p.media.src).url : p.media?.kind === 'gallery' ? (p.media.items[0].preview ?? p.media.items[0].src).url : p.thumb;
  updateLocal((d) => ({
    ...d,
    recentPosts: [{ id: p.id, title: p.title, sub: p.sub, permalink: p.permalink, thumb, at: Date.now(), score: p.score, comments: p.comments }, ...d.recentPosts.filter((r) => r.id !== p.id)].slice(0, 60),
    visited: d.visited.includes(p.id) ? d.visited : [p.id, ...d.visited].slice(0, 2000),
  }));
}

export function rememberSearch(q: string) {
  const t = q.trim();
  if (t) updateLocal((d) => ({ ...d, recentSearches: [t, ...d.recentSearches.filter((x) => x !== t)].slice(0, 10) }));
}

/* ---------- optimistic interactions ---------- */

export function effectiveOf(base: Votable, o: Override | undefined) {
  const likes = o?.likes ?? base.likes;
  return { likes, saved: o?.saved ?? base.saved, score: base.score + (likes - base.likes), hidden: !!o?.hidden };
}

export function useEffective(base: Votable) {
  return effectiveOf(base, useApp((s) => s.overrides[base.name]));
}

function needLogin(): boolean {
  if (state.me) return false;
  if (state.me === undefined) toast('Still connecting to your Reddit session…');
  else toast('Log in to Reddit to vote, save and comment.', 'error', { label: 'Log in', run: () => location.assign('/login') });
  return true;
}

async function optimistic(name: string, patch: Override, call: () => Promise<unknown>, ok?: string) {
  const prev = state.overrides[name];
  setState((s) => ({ overrides: { ...s.overrides, [name]: { ...s.overrides[name], ...patch } } }));
  try {
    await call();
    if (ok) toast(ok, 'success');
  } catch (e) {
    setState((s) => { const o = { ...s.overrides }; if (prev) o[name] = prev; else delete o[name]; return { overrides: o }; });
    toast((e as Error).message, 'error');
  }
}

export function castVote(base: Votable, dir: 1 | -1) {
  if (needLogin()) return;
  const cur = effectiveOf(base, state.overrides[base.name]).likes;
  const next: Vote = cur === dir ? 0 : dir;
  void optimistic(base.name, { likes: next }, () => api.vote(base.name, next));
}

export function toggleSave(base: Votable) {
  if (needLogin()) return;
  const saved = effectiveOf(base, state.overrides[base.name]).saved;
  void optimistic(base.name, { saved: !saved }, () => (saved ? api.unsave(base.name) : api.save(base.name)), saved ? 'Removed from saved' : 'Saved');
}

export function hidePost(name: string) {
  if (needLogin()) return;
  void optimistic(name, { hidden: true }, () => api.hide(name));
  toast('Post hidden', 'info', { label: 'Undo', run: () => void optimistic(name, { hidden: false }, () => api.unhide(name)) });
}
