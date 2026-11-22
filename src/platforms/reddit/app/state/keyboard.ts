import { useEffect } from 'react';
import { openSwitcher } from '@core/Switcher';
import { castVote, getState, hidePost, setState, toggleSave } from './store';
import { getScroller, openDrawer, openHelp, refresh, setLayout, setSort, toTop, toggleSidebar, toggleTheme } from './actions';
import { navigate, parseRoute } from '../lib/router';
import { registry } from '../components/Actions';
import type { Entry } from '../components/Actions';
import { viewMedia } from '../components/Media';

const typing = (t: EventTarget | undefined) => {
  const el = t as HTMLElement | undefined;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

/** Moves the keyboard highlight through elements matching `sel`, keeping the target comfortably in view. */
function move(sel: string, dir: 1 | -1) {
  const sc = getScroller();
  if (!sc) return;
  const els = Array.from(sc.querySelectorAll<HTMLElement>(sel)).filter((e) => e.offsetParent !== null);
  if (!els.length) return;
  const box = sc.getBoundingClientRect();
  let idx = els.findIndex((e) => e.dataset.name === getState().focused);
  if (idx === -1) {
    idx = els.findIndex((e) => e.getBoundingClientRect().bottom > box.top + 24);
    if (idx === -1) idx = els.length - 1;
  } else idx = Math.max(0, Math.min(els.length - 1, idx + dir));
  const el = els[idx];
  setState({ focused: el.dataset.name ?? null });
  const r = el.getBoundingClientRect();
  if (r.top < box.top + 12 || r.bottom > box.bottom - 12) {
    const top = sc.scrollTop + r.top - box.top - (r.height > box.height * 0.7 ? 12 : Math.max(12, (box.height - r.height) / 3));
    sc.scrollTo({ top, behavior: 'auto' });
  }
}

function target(): Entry | undefined {
  const f = getState().focused;
  if (f && registry.has(f)) return registry.get(f);
  if (parseRoute(location.pathname, location.search)?.kind === 'post') for (const e of registry.values()) if (e.kind === 'post') return e;
  return undefined;
}

export function useKeyboard() {
  useEffect(() => {
    let chord = false;
    let chordTimer = 0;
    const onMedia = (e: Event) => { const p = registry.get((e as CustomEvent<string>).detail)?.post; if (p) viewMedia(p); };
    window.addEventListener('orbit:media', onMedia);

    const onKey = (e: KeyboardEvent) => {
      const s = getState();
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      const key = e.key;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && key.toLowerCase() === 'k') { stop(); setState((x) => ({ palette: !x.palette, help: false })); return; }
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyO') { stop(); openSwitcher(); return; }
      if (!s.ready || s.lightbox) return;
      const inField = typing(e.composedPath()[0]);
      if (key === 'Escape') {
        if (s.palette || s.help || s.drawer || s.mobileNav) { stop(); setState({ palette: false, help: false, drawer: false, mobileNav: false }); return; }
        if (inField) return;
        const r = parseRoute(location.pathname, location.search);
        if (s.focused && r?.kind !== 'post') { stop(); setState({ focused: null }); return; }
        if (r?.kind === 'post' && s.settings.keyboard) { stop(); if (history.state?.orbit) history.back(); else navigate(r.sub ? `/r/${r.sub}` : '/'); }
        return;
      }
      if (!s.settings.keyboard || inField || e.ctrlKey || e.metaKey || e.altKey || s.palette || s.help || s.drawer) return;

      const route = parseRoute(location.pathname, location.search);
      const inPost = route?.kind === 'post';
      if (chord) {
        chord = false;
        window.clearTimeout(chordTimer);
        const me = s.me;
        const jumps: Record<string, () => void> = {
          h: () => navigate('/'), p: () => navigate('/r/popular'), a: () => navigate('/r/all'), t: toTop, v: openDrawer,
          i: () => navigate('/message/inbox'), s: () => (me ? navigate(`/user/${me.name}/saved`) : navigate('/login')),
          u: () => me && navigate(`/user/${me.name}`), r: () => setState({ palette: true }),
        };
        const fn = jumps[key.toLowerCase()];
        if (fn) { stop(); fn(); }
        return;
      }
      const global: Record<string, () => void> = {
        g: () => { chord = true; chordTimer = window.setTimeout(() => { chord = false; }, 1000); },
        '?': openHelp,
        '/': () => window.dispatchEvent(new Event('orbit:search')),
        j: () => move(inPost ? '[data-nav="thread"]' : '[data-nav="post"]', 1),
        k: () => move(inPost ? '[data-nav="thread"]' : '[data-nav="post"]', -1),
        b: toggleSidebar,
        t: toggleTheme,
        r: refresh,
      };
      if (inPost) {
        global[']'] = () => move('[data-nav="comment"]', 1);
        global['['] = () => move('[data-nav="comment"]', -1);
        global.X = () => window.dispatchEvent(new CustomEvent('orbit:collapse-all', { detail: 'collapse' }));
        global.E = () => window.dispatchEvent(new CustomEvent('orbit:collapse-all', { detail: 'expand' }));
      } else {
        (['comfortable', 'compact', 'gallery', 'minimal'] as const).forEach((l, i) => { global[String(i + 1)] = () => setLayout(l); });
      }
      if (route?.kind === 'feed') {
        const sorts: Record<string, string> = { B: 'best', H: 'hot', N: 'new', T: 'top', R: 'rising' };
        for (const [k, v] of Object.entries(sorts)) if (route.scope === 'home' || v !== 'best') global[k] = () => setSort(v);
      }
      if (global[key]) { stop(); global[key](); return; }

      const t = target();
      if (!t) return;
      const acts: Record<string, () => void> = {
        a: () => castVote(t.item, 1),
        z: () => castVote(t.item, -1),
        s: () => toggleSave(t.item),
        x: () => t.toggle?.(),
      };
      if (t.kind === 'post' && t.post) {
        const p = t.post;
        Object.assign(acts, {
          o: () => navigate(p.permalink), Enter: () => navigate(p.permalink), c: () => navigate(p.permalink),
          O: () => window.open(new URL(p.permalink, location.origin).toString(), '_blank', 'noopener'),
          m: () => { if (!viewMedia(p)) navigate(p.permalink); },
          l: () => window.open(p.isSelf ? new URL(p.permalink, location.origin).toString() : p.url, '_blank', 'noopener,noreferrer'),
          h: () => hidePost(p.name),
        });
        if (inPost) { delete acts.o; delete acts.Enter; delete acts.c; delete acts.h; }
      } else if (t.kind === 'comment') {
        acts.Enter = () => t.toggle?.();
      }
      if (acts[key]) { stop(); acts[key](); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); window.removeEventListener('orbit:media', onMedia); };
  }, []);
}
