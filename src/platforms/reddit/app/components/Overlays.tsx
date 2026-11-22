import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@core/Icon';
import type { IconName } from '@core/Icon';
import { Avatar, Kbd } from '../lib/ui';
import { VideoPlayer } from './Media';
import { dismissToast, getState, setState, updateLocal, updateSettings, useApp } from '../state/store';
import { classic, getScroller, openHelp, openSettings, refresh, setLayout, setSort, toTop, toggleReading, toggleSidebar, toggleTheme } from '../state/actions';
import { navigate, parseRoute } from '../lib/router';
import { autocomplete } from '../api/reddit';
import type { Community } from '../api/types';
import { clamp, compact, timeAgo } from '../lib/format';
import { resolveTheme } from '@core/settings';
import { SHORTCUTS } from '@core/shortcuts';
import { switchTo } from '@core/platforms';

/* ---------------- Quick switcher / command palette ---------------- */

interface Row { id: string; group: string; label: string; hint?: string; icon?: IconName; avatar?: { name: string; src?: string }; keywords?: string; run: () => void }

function score(needle: string, hay: string): number {
  if (!needle) return 1;
  const h = hay.toLowerCase();
  const i = h.indexOf(needle);
  if (i === 0) return 100 - h.length * 0.05;
  if (i > 0) return (h[i - 1] === ' ' || h[i - 1] === '/' ? 80 : 50) - i * 0.5;
  let j = 0;
  for (const ch of h) if (ch === needle[j] && ++j === needle.length) return 15;
  return 0;
}

export function Palette() {
  const settings = useApp((s) => s.settings);
  const local = useApp((s) => s.local);
  const mySubs = useApp((s) => s.mySubs);
  const me = useApp((s) => s.me);
  const [q, setQ] = useState('');
  const [hl, setHl] = useState(0);
  const [remote, setRemote] = useState<Community[]>([]);
  const list = useRef<HTMLDivElement>(null);
  const close = () => setState({ palette: false });
  const dark = resolveTheme(settings.theme) === 'dark';
  const needle = q.trim().toLowerCase().replace(/^\/?r\//, '');

  useEffect(() => {
    if (needle.length < 2 || /\s/.test(needle)) { setRemote([]); return; }
    const id = window.setTimeout(() => autocomplete(needle).then(setRemote).catch(() => setRemote([])), 160);
    return () => window.clearTimeout(id);
  }, [needle]);

  const rows = useMemo(() => {
    const all: Row[] = [];
    const add = (r: Omit<Row, 'run'> & { run: () => void }) => all.push({ ...r, run: () => { close(); r.run(); } });
    const go = (id: string, label: string, icon: IconName, path: string, keywords = '') => add({ id, group: 'Navigate', label, icon, keywords, run: () => navigate(path) });
    go('home', 'Home', 'home', '/', 'front page best');
    go('popular', 'Popular', 'flame', '/r/popular', 'trending');
    go('all', 'All', 'globe', '/r/all');
    if (me) {
      go('saved', 'Saved', 'bookmark', `/user/${me.name}/saved`, 'bookmarks');
      go('inbox', 'Inbox', 'mail', '/message/inbox', 'messages notifications replies');
      go('profile', 'Your profile', 'user', `/user/${me.name}`, 'me account');
    }
    const cmd = (id: string, label: string, icon: IconName, run: () => void, hint?: string, keywords = '') => add({ id, group: 'Commands', label, icon, hint, keywords, run });
    const route = parseRoute(location.pathname, location.search);
    if (route?.kind === 'feed') for (const s of route.scope === 'home' ? ['best', 'hot', 'new', 'top', 'rising'] : ['hot', 'new', 'top', 'rising']) cmd(`sort-${s}`, `Sort by ${s[0].toUpperCase()}${s.slice(1)}`, 'swap', () => setSort(s), `⇧${s[0].toUpperCase()}`, 'order feed');
    (['comfortable', 'compact', 'gallery', 'minimal'] as const).forEach((l, i) => cmd(`layout-${l}`, `${l[0].toUpperCase()}${l.slice(1)} layout`, l, () => setLayout(l), String(i + 1), 'view density cards'));
    cmd('theme', `Switch to ${dark ? 'light' : 'dark'} theme`, dark ? 'sun' : 'moon', toggleTheme, 'T', 'appearance mode');
    cmd('sidebar', settings.sidebarMode === 'compact' ? 'Expand sidebar' : 'Compact sidebar', 'sidebar', toggleSidebar, 'B');
    cmd('reading', settings.readingMode ? 'Exit reading mode' : 'Enter reading mode', 'eye', toggleReading, undefined, 'focus distraction');
    cmd('rail', settings.hide.rail ? 'Show right panel' : 'Hide right panel', 'sidebar', () => updateSettings((s) => ({ hide: { ...s.hide, rail: !s.hide.rail } })));
    cmd('refresh', 'Refresh', 'refresh', refresh, 'R', 'reload');
    cmd('top', 'Scroll to top', 'arrow-up', toTop, 'G T');
    cmd('history', 'History', 'clock', () => setState({ drawer: true }), 'G V', 'recent viewed');
    cmd('keys', 'Keyboard shortcuts', 'keyboard', openHelp, '?', 'help');
    cmd('settings', 'Orbit settings', 'settings', openSettings, undefined, 'options preferences');
    cmd('switch-x', 'Switch to X', 'swap', () => void switchTo('x', 'reddit', settings.rememberState, document.title), undefined, 'twitter platform orbit launcher');
    cmd('classic', 'Open in classic Reddit', 'external', classic, '⌥⇧O', 'original native');
    for (const l of settings.quickLinks) add({ id: `ql-${l.id}`, group: 'Quick access', label: l.label, icon: 'star', run: () => navigate(l.url) });
    const seen = new Set<string>();
    const sub = (name: string, icon: string | undefined, hint: string) => {
      if (seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      add({ id: `sub-${name.toLowerCase()}`, group: 'Communities', label: `r/${name}`, avatar: { name, src: icon }, hint, keywords: name, run: () => navigate(`/r/${name}`) });
    };
    const iconOf = (n: string) => local.recentSubs.find((r) => r.name.toLowerCase() === n.toLowerCase())?.icon ?? mySubs.find((s) => s.name.toLowerCase() === n.toLowerCase())?.icon;
    settings.pinnedSubs.forEach((n) => sub(n, iconOf(n), 'Pinned'));
    local.recentSubs.forEach((r) => sub(r.name, r.icon, 'Recent'));
    mySubs.forEach((s) => sub(s.name, s.icon, 'Joined'));
    remote.forEach((c) => sub(c.name, c.icon, `${compact(c.subscribers)} members`));
    local.recentPosts.slice(0, 20).forEach((p) => add({ id: `rp-${p.id}`, group: 'Recently viewed', label: p.title, hint: `r/${p.sub}`, icon: 'clock', run: () => navigate(p.permalink) }));

    const raw = q.trim();
    if (!raw) {
      const limits: Record<string, number> = { Navigate: 6, Communities: 6, 'Quick access': 4, 'Recently viewed': 3, Commands: 6 };
      return ['Navigate', 'Communities', 'Quick access', 'Recently viewed', 'Commands'].flatMap((g) => all.filter((r) => r.group === g).slice(0, limits[g]));
    }
    const head: Row[] = [];
    if (/^\/?r\/[\w+]+$/i.test(raw) && !seen.has(needle)) head.push({ id: 'direct', group: 'Navigate', label: `Go to r/${needle}`, icon: 'chev-right', run: () => { close(); navigate(`/r/${needle}`); } });
    if (/^\/?u\/[\w-]+$/i.test(raw)) { const u = raw.replace(/^\/?u\//i, ''); head.push({ id: 'user', group: 'Navigate', label: `Go to u/${u}`, icon: 'user', run: () => { close(); navigate(`/user/${u}`); } }); }
    const ranked = all.map((r) => ({ r, s: Math.max(score(needle, r.label), score(needle, r.keywords ?? '') * 0.7) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.r).slice(0, 30);
    const groups = [...new Set(ranked.map((r) => r.group))];
    return [...head, ...groups.flatMap((g) => ranked.filter((r) => r.group === g)), { id: 'search', group: 'Search', label: `Search Reddit for “${raw}”`, icon: 'search' as IconName, run: () => { close(); navigate(`/search?q=${encodeURIComponent(raw)}`); } }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, needle, remote, settings, local, mySubs, me, dark]);

  useEffect(() => setHl(0), [q]);
  useEffect(() => { list.current?.querySelector('.pal-row.hl')?.scrollIntoView({ block: 'nearest' }); }, [hl]);

  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    const n = rows.length;
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); setHl((h) => (h + 1) % n); }
    else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); setHl((h) => (h - 1 + n) % n); }
    else if (e.key === 'Enter') { e.preventDefault(); rows[hl]?.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  };

  return (
    <>
      <div className="scrim" onPointerDown={close} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Quick switcher">
        <div className="pal-in">
          <Icon name="search" size={18} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Jump to a community, run a command, search…" aria-label="Quick switcher" />
          <Kbd>esc</Kbd>
        </div>
        <div className="pal-list" ref={list} role="listbox">
          {rows.map((r, i) => (
            <div key={r.id}>
              {(i === 0 || rows[i - 1].group !== r.group) && <div className="pal-group">{r.group}</div>}
              <button className={`pal-row ${i === hl ? 'hl' : ''}`} role="option" aria-selected={i === hl} onMouseMove={() => i !== hl && setHl(i)} onClick={r.run}>
                {r.avatar ? <Avatar name={r.avatar.name} src={r.avatar.src} /> : <Icon name={r.icon ?? 'chev-right'} size={17} />}
                <span className="lbl">{r.label}</span>
                {r.hint && <span className="hint">{r.hint}</span>}
                <span className="enter"><Kbd>↵</Kbd></span>
              </button>
            </div>
          ))}
        </div>
        <div className="pal-foot"><span><Kbd>↑</Kbd><Kbd>↓</Kbd>navigate</span><span><Kbd>↵</Kbd>open</span><span style={{ marginLeft: 'auto' }}>Type <b>r/name</b> or <b>u/name</b> to jump anywhere</span></div>
      </div>
    </>
  );
}

/* ---------------- Keyboard help ---------------- */

export function Help() {
  const close = () => setState({ help: false });
  return (
    <>
      <div className="scrim" onPointerDown={close} />
      <div className="help" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="help-h"><h2>Keyboard shortcuts</h2><button className="ibtn" onClick={close} aria-label="Close"><Icon name="x" /></button></div>
        <div className="help-grid">
          {SHORTCUTS.map(([g, items]) => (
            <div className="help-group" key={g}>
              <h4>{g}</h4>
              {items.map(([label, keys]) => <div className="help-row" key={label}><span>{label}</span><span className="keys">{keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}</span></div>)}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------------- History drawer ---------------- */

export function Drawer() {
  const local = useApp((s) => s.local);
  const quick = useApp((s) => s.settings.quickLinks);
  const close = () => setState({ drawer: false });
  const go = (href: string) => (e: React.MouseEvent) => { e.preventDefault(); close(); navigate(href); };
  return (
    <>
      <div className="scrim" onPointerDown={close} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="History">
        <div className="drawer-head"><Icon name="clock" size={17} />History<button className="ibtn" style={{ marginLeft: 'auto' }} onClick={close} aria-label="Close"><Icon name="x" /></button></div>
        <div className="drawer-body">
          <section className="drawer-sec">
            <h3 className="card-h">Recently viewed posts{local.recentPosts.length > 0 && <button className="btn xs ghost" onClick={() => updateLocal((d) => ({ ...d, recentPosts: [], visited: [] }))}>Clear</button>}</h3>
            {local.recentPosts.length === 0 && <p className="mute" style={{ fontSize: 13, margin: 0 }}>Nothing yet. History is stored only on this device.</p>}
            {local.recentPosts.map((p) => (
              <a key={p.id} className="mini" href={p.permalink} onClick={go(p.permalink)}>
                {p.thumb ? <img className="mini-thumb" src={p.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="mini-thumb"><Icon name="comment" size={16} /></span>}
                <div className="grow"><div className="t">{p.title}</div><div className="s">r/{p.sub} · {timeAgo(p.at / 1000)} ago</div></div>
              </a>
            ))}
          </section>
          <section className="drawer-sec">
            <h3 className="card-h">Recent communities{local.recentSubs.length > 0 && <button className="btn xs ghost" onClick={() => updateLocal((d) => ({ ...d, recentSubs: [] }))}>Clear</button>}</h3>
            <div className="chips">
              {local.recentSubs.map((r) => <a key={r.name} className="chip" href={`/r/${r.name}`} onClick={go(`/r/${r.name}`)}><Avatar name={r.name} src={r.icon} size="xs" />{r.name}</a>)}
              {local.recentSubs.length === 0 && <span className="mute" style={{ fontSize: 13 }}>None yet.</span>}
            </div>
          </section>
          <section className="drawer-sec">
            <h3 className="card-h">Quick access</h3>
            {quick.map((l) => <a key={l.id} className="mini" href={l.url} onClick={go(l.url)}><span className="mini-thumb" style={{ width: 28, height: 28 }}><Icon name="star" size={14} /></span><div className="t">{l.label}</div></a>)}
            {quick.length === 0 && <p className="mute" style={{ fontSize: 13, margin: 0 }}>Add pages from the sidebar’s Quick access section.</p>}
          </section>
        </div>
      </aside>
    </>
  );
}

/* ---------------- Lightbox ---------------- */

export function Lightbox() {
  const lb = useApp((s) => s.lightbox)!;
  const [i, setI] = useState(lb.index);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const n = lb.items.length;
  const close = () => setState({ lightbox: null });
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const go = (d: number) => { if (n > 1) { setI((v) => (v + d + n) % n); reset(); } };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const map: Record<string, () => void> = {
        Escape: close, ArrowRight: () => go(1), ArrowLeft: () => go(-1), l: () => go(1), h: () => go(-1),
        '+': () => setZoom((z) => clamp(z + 0.5, 1, 6)), '=': () => setZoom((z) => clamp(z + 0.5, 1, 6)), '-': () => setZoom((z) => clamp(z - 0.5, 1, 6)), '0': reset,
      };
      if (map[e.key]) { e.preventDefault(); e.stopPropagation(); map[e.key](); }
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const cur = lb.items[i];
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Media viewer">
      <div className="lb-top">
        <span className="t">{lb.title}</span>
        {n > 1 && <span className="n">{i + 1} / {n}</span>}
        {!lb.video && <>
          <button className="ibtn" onClick={() => setZoom((z) => clamp(z - 0.5, 1, 6))} aria-label="Zoom out" title="Zoom out (−)"><Icon name="minus" /></button>
          <button className="ibtn" onClick={() => setZoom((z) => clamp(z + 0.5, 1, 6))} aria-label="Zoom in" title="Zoom in (+)"><Icon name="plus" /></button>
          {cur && <a className="ibtn" href={cur.url} target="_blank" rel="noopener noreferrer" aria-label="Open original" title="Open original"><Icon name="external" /></a>}
        </>}
        <button className="ibtn" onClick={close} aria-label="Close" title="Close (Esc)"><Icon name="x" /></button>
      </div>
      <div className="lb-stage"
        onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}
        onWheel={(e) => { if (!lb.video) setZoom((z) => { const nz = clamp(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 6); if (nz === 1) setPan({ x: 0, y: 0 }); return nz; }); }}>
        {lb.video ? (
          <div style={{ width: `min(100%, calc((100vh - 120px) * ${lb.video.w || 16} / ${lb.video.h || 9}))` }}>
            <VideoPlayer m={{ kind: 'video', url: lb.video.url, audioUrl: lb.video.audioUrl, poster: lb.video.poster ? { url: lb.video.poster, w: 0, h: 0 } : undefined, w: lb.video.w, h: lb.video.h, gif: lb.video.gif }} autoplay />
          </div>
        ) : cur && (
          <img src={cur.url} alt={cur.caption ?? lb.title ?? ''} referrerPolicy="no-referrer" draggable={false} className={zoom > 1 ? 'zoomed' : ''}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false }; }}
            onPointerMove={(e) => { const d = drag.current; if (!d || zoom === 1) return; d.moved = true; setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }); }}
            onPointerUp={() => { const d = drag.current; drag.current = null; if (d && !d.moved) { if (zoom > 1) reset(); else setZoom(2.5); } }} />
        )}
        {n > 1 && <>
          <button className="lb-nav l" onClick={() => go(-1)} aria-label="Previous"><Icon name="chev-left" size={22} /></button>
          <button className="lb-nav r" onClick={() => go(1)} aria-label="Next"><Icon name="chev-right" size={22} /></button>
        </>}
      </div>
      {cur?.caption && <div className="lb-cap">{cur.caption}</div>}
      {n > 1 && <div className="lb-thumbs">{lb.items.map((it, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => { setI(k); reset(); }} aria-label={`Image ${k + 1}`}><img src={it.url} alt="" loading="lazy" referrerPolicy="no-referrer" /></button>)}</div>}
    </div>
  );
}

/* ---------------- Toasts & back to top ---------------- */

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role="status">
          <Icon name={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'} size={16} />
          <span>{t.text}</span>
          {t.action && <button onClick={() => { t.action!.run(); dismissToast(t.id); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}

export function BackToTop() {
  const [show, setShow] = useState(false);
  const hidden = useApp((s) => s.settings.hide.backToTop);
  useEffect(() => {
    const el = getScroller();
    if (!el) return;
    const on = () => setShow(el.scrollTop > 1200);
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);
  if (hidden || !show) return null;
  return <button className="to-top" onClick={toTop} title="Back to top" aria-label="Back to top"><Icon name="arrow-up" size={18} /></button>;
}

export { getState };
