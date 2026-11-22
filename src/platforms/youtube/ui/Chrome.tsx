import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@core/Icon';
import type { IconName } from '@core/Icon';
import { Kbd, Menu, MenuItem, useDismiss } from '@core/ui';
import { PlatformSwitcher } from '@core/Switcher';
import { HelpSheet, Palette, ToastStack } from '@core/shell';
import type { PaletteRow } from '@core/shell';
import { reducedMotion, resolveTheme, themeVars } from '@core/settings';
import type { Density, YTComments, YTGrid, YTRecs, YTSection, YTThumb, YTWatchWidth } from '@core/settings';
import { YT_SHORTCUTS } from '@core/shortcuts';
import { routeTitle } from '../routes';
import { nativeSuggestions, openAccountMenu, openCreate, openNotifications, signInHref } from '../dom';
import { classic, go, openSettings, search, theater, toPlatform, toggleSidebar, toggleTheme } from '../actions';
import { forgetSearches, setYT, updateSettings, updateYT, useYT } from '../store';

/* ---------------- navigation model ---------------- */

interface NavDef { id: string; label: string; icon?: IconName; avatar?: string; href: string; fresh?: boolean }

const SECTION_TITLES: Record<YTSection, string> = { pinned: 'Pinned', main: '', you: 'You', subscriptions: 'Subscriptions', explore: 'Explore', more: 'More' };

function useSections(): Record<YTSection, NavDef[]> {
  const guide = useYT((s) => s.guide);
  const session = useYT((s) => s.session);
  return useMemo(() => {
    const iconFor = (t: string): IconName => /music/i.test(t) ? 'music' : /gam/i.test(t) ? 'gamepad' : /news/i.test(t) ? 'layers' : /sport/i.test(t) ? 'star' : /live/i.test(t) ? 'zap' : /trend/i.test(t) ? 'trend' : /learn|course/i.test(t) ? 'book' : 'globe';
    const explore = guide.explore.length
      ? guide.explore.filter((e) => !/trending/i.test(e.title)).map((e) => ({ id: `ex:${e.title.toLowerCase()}`, label: e.title, icon: iconFor(e.title), href: e.href }))
      : [];
    const moreFromGuide = guide.more.filter((e) => !/^\/account/.test(e.href)).map((e) => ({ id: `more:${e.title.toLowerCase()}`, label: e.title, icon: /help/i.test(e.title) ? 'help' as IconName : /feedback/i.test(e.title) ? 'comment' as IconName : 'info' as IconName, href: e.href }));
    return {
      pinned: [],
      main: [
        { id: 'home', label: 'Home', icon: 'home', href: '/' },
        { id: 'shorts', label: 'Shorts', icon: 'shorts', href: '/shorts' },
        { id: 'subscriptions', label: 'Subscriptions', icon: 'subs', href: '/feed/subscriptions' },
        { id: 'trending', label: 'Trending', icon: 'trend', href: '/feed/trending' },
      ],
      you: [
        { id: 'library', label: 'Library', icon: 'library', href: '/feed/you' },
        { id: 'history', label: 'History', icon: 'clock', href: '/feed/history' },
        { id: 'playlists', label: 'Playlists', icon: 'list', href: '/feed/playlists' },
        ...(session !== 'out' ? [{ id: 'yourvideos', label: 'Your videos', icon: 'video' as IconName, href: guide.yourVideos ?? 'https://studio.youtube.com/' }] : []),
        { id: 'watchlater', label: 'Watch later', icon: 'clock', href: '/playlist?list=WL' },
        { id: 'liked', label: 'Liked videos', icon: 'thumb', href: '/playlist?list=LL' },
      ],
      subscriptions: [
        ...guide.subscriptions.map((e) => ({ id: `ch:${e.href}`, label: e.title, avatar: e.avatar ?? '', href: e.href, fresh: e.fresh })),
        ...(guide.subscriptions.length ? [{ id: 'channels', label: 'All subscriptions', icon: 'list' as IconName, href: '/feed/channels' }] : []),
      ],
      explore,
      more: [{ id: 'settings', label: 'Settings', icon: 'settings', href: '/account' }, ...moreFromGuide],
    } as Record<YTSection, NavDef[]>;
  }, [guide, session]);
}

function isActive(href: string): boolean {
  try {
    const u = new URL(href, location.origin);
    if (u.origin !== location.origin) return false;
    if (u.pathname === '/shorts') return location.pathname.startsWith('/shorts');
    if (u.pathname === '/') return location.pathname === '/';
    return location.pathname === u.pathname && (!u.search || location.search === u.search);
  } catch { return false; }
}

/* ---------------- sidebar ---------------- */

function NavItem({ n, pinned, hidden, edit }: { n: NavDef; pinned: boolean; hidden: boolean; edit: boolean }) {
  useYT((s) => s.route.key); // re-render on navigation for the active state
  const active = isActive(n.href);
  const y = useYT((s) => s.settings.youtube);
  const togglePin = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); updateYT({ navPinned: pinned ? y.navPinned.filter((x) => x !== n.id) : [...y.navPinned, n.id] }); };
  const toggleHide = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); updateYT({ navHidden: hidden ? y.navHidden.filter((x) => x !== n.id) : [...y.navHidden, n.id] }); };
  return (
    <a className={`sb-item ${active ? 'active' : ''} ${hidden ? 'is-hidden' : ''}`} href={n.href} title={n.label} aria-current={active ? 'page' : undefined} data-nav={n.id}
      onClick={(e) => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(n.href); }}>
      {n.icon ? <Icon name={n.icon} size={19} /> : n.avatar ? <img className="avatar round" src={n.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar round yt-av-fallback">{n.label[0]}</span>}
      <span className="sb-text">{n.label}</span>
      {n.fresh && <span className="yt-fresh" title="New videos" />}
      {edit
        ? <span role="button" tabIndex={0} className="sb-pin on" title={hidden ? 'Show' : 'Hide'} aria-label={hidden ? `Show ${n.label}` : `Hide ${n.label}`} onClick={toggleHide}><Icon name={hidden ? 'eye-off' : 'eye'} size={14} /></span>
        : <span role="button" tabIndex={0} className={`sb-pin ${pinned ? 'on' : ''}`} title={pinned ? 'Unpin' : 'Pin to top'} aria-label={pinned ? `Unpin ${n.label}` : `Pin ${n.label}`} onClick={togglePin} onKeyDown={(e) => { if (e.key === 'Enter') togglePin(e); }}><Icon name="pin" size={13} fill={pinned} /></span>}
    </a>
  );
}

function Sidebar() {
  const settings = useYT((s) => s.settings);
  const session = useYT((s) => s.session);
  const account = useYT((s) => s.account);
  const edit = useYT((s) => s.edit);
  const narrow = useYT((s) => s.narrow);
  const sections = useSections();
  const y = settings.youtube;
  const compact = settings.sidebarMode === 'compact' && !narrow;
  const all = Object.values(sections).flat();
  const byId = new Map(all.map((n) => [n.id, n]));
  const pinnedItems = y.navPinned.map((id) => byId.get(id)).filter(Boolean) as NavDef[];
  const order = y.navOrder.filter((id) => edit || !y.navHidden.includes(`sec:${id}`));

  const move = (id: YTSection, d: -1 | 1) => { const o = [...y.navOrder]; const i = o.indexOf(id); const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; updateYT({ navOrder: o }); };
  const collapse = (id: YTSection) => updateYT({ navCollapsed: y.navCollapsed.includes(id) ? y.navCollapsed.filter((x) => x !== id) : [...y.navCollapsed, id] });
  const hideSection = (id: YTSection) => { const k = `sec:${id}`; updateYT({ navHidden: y.navHidden.includes(k) ? y.navHidden.filter((x) => x !== k) : [...y.navHidden, k] }); };

  return (
    <aside className={`sidebar yt-sidebar ${narrow ? 'drawer-mode' : ''}`} aria-label="Orbit navigation">
      <div className="sb-head">
        <PlatformSwitcher current="youtube" compact={compact} remember={settings.rememberState} onSettings={() => openSettings('youtube')} homeHref="/" />
        {!compact && <button className="ibtn sb-collapse" style={{ marginLeft: 'auto' }} onClick={toggleSidebar} title={narrow ? 'Close menu' : 'Collapse sidebar (\\)'} aria-label={narrow ? 'Close menu' : 'Collapse sidebar'}><Icon name={narrow ? 'x' : 'sidebar'} size={17} /></button>}
      </div>
      <nav className="sb-scroll" aria-label="YouTube">
        {order.map((sid, i) => {
          const items = sid === 'pinned' ? pinnedItems : sections[sid].filter((n) => !y.navPinned.includes(n.id) || sid === 'main');
          if (!edit && (items.length === 0 || (sid === 'subscriptions' && session === 'out'))) return null;
          const shown = items.filter((n) => edit || !y.navHidden.includes(n.id));
          const collapsed = !edit && y.navCollapsed.includes(sid) && sid !== 'main';
          const secHidden = y.navHidden.includes(`sec:${sid}`);
          const head: ReactNode = (sid !== 'main' || edit) && (
            <div className="sb-label">
              {sid !== 'main' && !compact
                ? <button className="yt-sec-toggle" onClick={() => collapse(sid)} aria-expanded={!collapsed} data-section={sid}><span>{SECTION_TITLES[sid] || 'Main'}</span><Icon name={collapsed ? 'chev-right' : 'chev-down'} size={12} /></button>
                : <span>{SECTION_TITLES[sid] || 'Main'}</span>}
              {edit && (
                <span className="sb-edit">
                  <button disabled={i === 0} onClick={() => move(sid, -1)} aria-label={`Move ${SECTION_TITLES[sid] || 'Main'} up`}><Icon name="chev-up" size={13} /></button>
                  <button disabled={i === order.length - 1} onClick={() => move(sid, 1)} aria-label={`Move ${SECTION_TITLES[sid] || 'Main'} down`}><Icon name="chev-down" size={13} /></button>
                  {sid !== 'main' && <button onClick={() => hideSection(sid)} aria-label={secHidden ? 'Show section' : 'Hide section'}><Icon name={secHidden ? 'eye-off' : 'eye'} size={13} /></button>}
                </span>
              )}
            </div>
          );
          const limit = sid === 'subscriptions' && !edit ? 9 : Infinity;
          return (
            <div className={`sb-section ${secHidden ? 'is-hidden' : ''}`} key={sid} data-section={sid}>
              {head}
              {!collapsed && shown.slice(0, limit).map((n) => <NavItem key={n.id} n={n} pinned={y.navPinned.includes(n.id)} hidden={y.navHidden.includes(n.id)} edit={edit} />)}
              {!collapsed && shown.length > limit && <a className="sb-item" href="/feed/channels" onClick={(e) => { e.preventDefault(); go('/feed/channels'); }}><Icon name="chev-down" size={17} /><span className="sb-text">Show {shown.length - limit} more</span></a>}
              {sid === 'pinned' && edit && items.length === 0 && <div className="sb-hint">Hover any item and click the pin to keep it here.</div>}
            </div>
          );
        })}
        {session === 'out' && !compact && (
          <div className="yt-signin-card">
            <p>Sign in to like videos, comment and subscribe.</p>
            <a className="btn sm" href={signInHref()}><Icon name="user" size={14} />Sign in</a>
          </div>
        )}
      </nav>
      <div className="sb-foot">
        {compact && <button className="ibtn" onClick={toggleSidebar} title="Expand sidebar (\)" aria-label="Expand sidebar"><Icon name="sidebar" size={17} /></button>}
        {session === 'in'
          ? <button className="shell-account" onClick={openAccountMenu} title="Account" aria-label="Account menu">
              {account?.avatar ? <img className="avatar md round" src={account.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar md round"><Icon name="user" size={15} /></span>}
              {!compact && <span className="shell-acc-text"><b>{account?.name || 'Your account'}</b><small>YouTube account</small></span>}
            </button>
          : <a className="ibtn" href={signInHref()} title="Sign in" aria-label="Sign in"><Icon name="user" size={17} /></a>}
        {!compact && <>
          <button className={`ibtn ${edit ? 'on' : ''}`} style={{ marginLeft: 'auto' }} onClick={() => setYT((s) => ({ edit: !s.edit }))} title={edit ? 'Done' : 'Customize sidebar'} aria-label={edit ? 'Done customizing' : 'Customize sidebar'} aria-pressed={edit}><Icon name={edit ? 'check' : 'edit'} size={17} /></button>
          <button className="ibtn" onClick={() => openSettings('youtube')} title="Orbit settings" aria-label="Orbit settings"><Icon name="settings" size={17} /></button>
        </>}
      </div>
    </aside>
  );
}

/* ---------------- top bar ---------------- */

function SearchBox() {
  const route = useYT((s) => s.route);
  const recent = useYT((s) => s.recent);
  const [q, setQ] = useState(route.kind === 'search' ? route.q ?? '' : '');
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(-1);
  const [sugg, setSugg] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLFormElement>(null);
  useDismiss(wrap, () => setOpen(false), open);
  useEffect(() => { setQ(route.kind === 'search' ? route.q ?? '' : ''); }, [route.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const f = () => { input.current?.focus(); input.current?.select(); setOpen(true); };
    window.addEventListener('orbit:search', f);
    return () => window.removeEventListener('orbit:search', f);
  }, []);
  useEffect(() => {
    const t = q.trim();
    if (!t || !open) { setSugg([]); return; }
    let live = true;
    const id = window.setTimeout(() => void nativeSuggestions(t).then((r) => { if (live) setSugg(r.filter((x) => x.toLowerCase() !== t.toLowerCase())); }), 140);
    return () => { live = false; window.clearTimeout(id); };
  }, [q, open]);
  const rows = q.trim() ? [...recent.filter((r) => r.toLowerCase().startsWith(q.trim().toLowerCase()) && r.toLowerCase() !== q.trim().toLowerCase()).slice(0, 3).map((r) => ({ t: r, recent: true })), ...sugg.map((t) => ({ t, recent: false }))] : recent.slice(0, 8).map((t) => ({ t, recent: true }));
  const run = (t: string) => { const v = t.trim(); if (!v) return; setQ(v); setOpen(false); input.current?.blur(); search(v); };
  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHl((h) => Math.min(rows.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(-1, h - 1)); }
    else if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(hl >= 0 && rows[hl] ? rows[hl].t : q); }
  };
  useEffect(() => setHl(-1), [q]);
  return (
    <form className="tb-search" role="search" ref={wrap} onSubmit={(e) => { e.preventDefault(); run(q); }}>
      <div className="search-box" onClick={() => input.current?.focus()}>
        <Icon name="search" size={16} />
        <input ref={input} value={q} placeholder="Search YouTube" aria-label="Search YouTube" role="combobox" aria-expanded={open && rows.length > 0} autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
        {q ? <button type="button" className="ibtn sm" onClick={(e) => { e.stopPropagation(); setQ(''); input.current?.focus(); }} aria-label="Clear search"><Icon name="x" size={14} /></button> : <Kbd>/</Kbd>}
      </div>
      {open && rows.length > 0 && (
        <div className="pop left suggest yt-suggest" role="listbox">
          {!q.trim() && <div className="pop-head yt-suggest-head"><span>Recent searches</span><button type="button" onClick={forgetSearches}>Clear</button></div>}
          {rows.map((r, i) => (
            <button type="button" key={`${r.recent}:${r.t}`} role="option" aria-selected={i === hl} className={`sg-row ${i === hl ? 'hl' : ''}`} onMouseMove={() => setHl(i)} onClick={() => run(r.t)}>
              <Icon name={r.recent ? 'clock' : 'search'} size={15} /><span>{r.t}</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

function Chips() {
  const chips = useYT((s) => s.chips);
  return (
    <div className="yt-subbar" role="tablist" aria-label="Categories">
      {chips.map((c) => (
        <button key={c.label} role="tab" aria-selected={c.selected} className={`yt-chip ${c.selected ? 'on' : ''}`} onClick={() => { c.el.click(); window.scrollTo({ top: 0 }); }}>{c.label}</button>
      ))}
    </div>
  );
}

function ViewMenu() {
  const s = useYT((x) => x.settings);
  const y = s.youtube;
  const seg = <T extends string>(value: T, opts: [T, string][], set: (v: T) => void) => (
    <div className="seg" role="radiogroup">{opts.map(([v, l]) => <button key={v} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => set(v)}>{l}</button>)}</div>
  );
  return (
    <Menu label="View options" button={<Icon name="density" size={17} />}>
      {() => (
        <div className="shell-view yt-view">
          <div className="pop-head">Video grid</div>
          <div className="shell-view-row"><span>Layout</span>{seg<YTGrid>(y.grid, [['comfortable', 'Comfortable'], ['compact', 'Compact'], ['editorial', 'Editorial']], (v) => updateYT({ grid: v }))}</div>
          <div className="shell-view-row"><span>Thumbnails</span>{seg<YTThumb>(y.thumbSize, [['small', 'S'], ['medium', 'M'], ['large', 'L']], (v) => updateYT({ thumbSize: v }))}</div>
          <div className="shell-view-row"><span>Density</span>{seg<Density>(s.density, [['cozy', 'Cozy'], ['regular', 'Regular'], ['tight', 'Tight']], (v) => updateSettings({ density: v }))}</div>
          <div className="pop-sep" />
          <div className="pop-head">Watch page</div>
          <div className="shell-view-row"><span>Up next</span>{seg<YTRecs>(y.recommendations, [['sidebar', 'Sidebar'], ['grid', 'Grid'], ['list', 'List']], (v) => updateYT({ recommendations: v }))}</div>
          <div className="shell-view-row"><span>Width</span>{seg<YTWatchWidth>(y.watchWidth, [['standard', 'Standard'], ['wide', 'Wide'], ['immersive', 'Immersive']], (v) => updateYT({ watchWidth: v }))}</div>
          <div className="shell-view-row"><span>Comments</span>{seg<YTComments>(y.comments, [['threaded', 'Threaded'], ['compact', 'Compact']], (v) => updateYT({ comments: v }))}</div>
          <div className="pop-sep" />
          <MenuItem icon="info" label="Description previews" checked={y.descriptions} onClick={() => updateYT({ descriptions: !y.descriptions })} />
          <MenuItem icon="shorts" label="Hide Shorts shelves" checked={y.hideShortsShelves} onClick={() => updateYT({ hideShortsShelves: !y.hideShortsShelves })} />
        </div>
      )}
    </Menu>
  );
}

function TopBar() {
  const route = useYT((s) => s.route);
  const settings = useYT((s) => s.settings);
  const session = useYT((s) => s.session);
  const account = useYT((s) => s.account);
  const notifications = useYT((s) => s.notifications);
  const narrow = useYT((s) => s.narrow);
  const chips = useYT((s) => s.chips);
  const [title, sub] = routeTitle(route);
  const dark = resolveTheme(settings.theme) === 'dark';
  const showChips = chips.length > 1 && !settings.youtube.hideChips && (route.kind === 'home' || route.kind === 'subscriptions');
  return (
    <header className={`topbar shell-topbar yt-topbar ${showChips ? 'with-sub' : ''}`}>
      <div className="yt-topbar-row">
        {narrow && <button className="ibtn" onClick={toggleSidebar} aria-label="Menu" title="Menu"><Icon name="menu" /></button>}
        <div className="tb-title">
          {route.kind !== 'home' && <button className="ibtn" onClick={() => history.back()} title="Back" aria-label="Back"><Icon name="arrow-left" /></button>}
          <div className="t"><h1>{title}</h1>{sub && <small>{sub}</small>}</div>
        </div>
        <SearchBox />
        <div className="tb-actions">
          {route.kind === 'watch' && <button className="ibtn hide-md" onClick={theater} title="Theater mode (t)" aria-label="Theater mode"><Icon name="theater" size={17} /></button>}
          <ViewMenu />
          <button className="ibtn hide-md" onClick={toggleTheme} title={`${dark ? 'Light' : 'Dark'} theme`} aria-label="Toggle theme"><Icon name={dark ? 'sun' : 'moon'} size={17} /></button>
          <button className="ibtn" onClick={() => setYT({ palette: true })} title="Command palette (Ctrl/⌘ K)" aria-label="Command palette"><Icon name="command" size={17} /></button>
          {session === 'in' && <>
            <button className="ibtn hide-md" onClick={openCreate} title="Create" aria-label="Create"><Icon name="plus" size={18} /></button>
            <button className="ibtn" onClick={openNotifications} title="Notifications" aria-label="Notifications"><Icon name="bell" size={17} />{notifications > 0 && <span className="badge">{notifications > 99 ? '99+' : notifications}</span>}</button>
            <button className="ibtn yt-avatar-btn" onClick={openAccountMenu} title="Account" aria-label="Account">
              {account?.avatar ? <img className="avatar md round" src={account.avatar} alt="" referrerPolicy="no-referrer" /> : <Icon name="user" size={17} />}
            </button>
          </>}
          {session === 'out' && <a className="btn sm primary" href={signInHref()}><Icon name="user" size={14} />Sign in</a>}
        </div>
      </div>
      {showChips && <Chips />}
    </header>
  );
}

/* ---------------- palette ---------------- */

function YTPalette() {
  const settings = useYT((s) => s.settings);
  const route = useYT((s) => s.route);
  const sections = useSections();
  const dark = resolveTheme(settings.theme) === 'dark';
  const rows = useMemo(() => {
    const all: PaletteRow[] = [];
    for (const n of [...sections.main, ...sections.you, ...sections.more]) all.push({ id: `go-${n.id}`, group: 'Go to', label: n.label, icon: n.icon ?? 'chev-right', run: () => go(n.href) });
    for (const n of sections.subscriptions.slice(0, 30)) all.push({ id: `go-${n.id}`, group: 'Channels', label: n.label, icon: 'user', keywords: 'channel subscription', run: () => go(n.href) });
    const cmd = (id: string, label: string, icon: IconName, run: () => void, hint?: string, keywords = '') => all.push({ id, group: 'Commands', label, icon, hint, keywords, run });
    if (route.kind === 'watch') cmd('theater', 'Toggle theater mode', 'theater', theater, 'T', 'cinema wide player');
    cmd('reddit', 'Switch to Reddit', 'swap', () => toPlatform('reddit'), undefined, 'platform orbit launcher');
    cmd('x', 'Switch to X', 'swap', () => toPlatform('x'), undefined, 'platform orbit launcher twitter');
    cmd('theme', `Switch to ${dark ? 'light' : 'dark'} theme`, dark ? 'sun' : 'moon', toggleTheme, undefined, 'appearance mode');
    cmd('sidebar', settings.sidebarMode === 'compact' ? 'Expand sidebar' : 'Compact sidebar', 'sidebar', toggleSidebar, '\\');
    for (const [g, l] of [['comfortable', 'Comfortable'], ['compact', 'Compact'], ['editorial', 'Editorial']] as [YTGrid, string][]) cmd(`grid-${g}`, `${l} video grid`, 'gallery', () => updateYT({ grid: g }), undefined, 'layout density');
    for (const [r, l] of [['sidebar', 'in the sidebar'], ['grid', 'as a grid'], ['list', 'as a list']] as [YTRecs, string][]) cmd(`recs-${r}`, `Show Up next ${l}`, 'layers', () => updateYT({ recommendations: r }), undefined, 'recommendations related');
    cmd('keys', 'Keyboard shortcuts', 'keyboard', () => setYT({ help: true }), undefined, 'help');
    cmd('settings', 'Orbit settings', 'settings', () => openSettings('youtube'), undefined, 'options preferences');
    cmd('classic', 'Classic YouTube on this tab', 'external', classic, '⌥⇧O', 'original native');
    return all;
  }, [sections, settings, route.kind, dark]);
  return <Palette rows={rows} onClose={() => setYT({ palette: false })} placeholder="Go anywhere on YouTube, run a command, search…" footer="Orbit for YouTube"
    search={(q) => ({ id: 'search', group: 'Search', label: `Search YouTube for “${q}”`, icon: 'search', run: () => search(q) })} />;
}

/* ---------------- root ---------------- */

export function Chrome() {
  const settings = useYT((s) => s.settings);
  const overlay = useYT((s) => s.overlay);
  const fullscreen = useYT((s) => s.fullscreen);
  const palette = useYT((s) => s.palette);
  const help = useYT((s) => s.help);
  const narrow = useYT((s) => s.narrow);
  const drawer = useYT((s) => s.drawer);
  const toasts = useYT((s) => s.toasts);
  const vars = useMemo(() => themeVars(settings), [settings]);
  if (fullscreen) return null;
  const cls = ['root', 'shell-root', 'yt-root', reducedMotion(settings) && 'no-motion', settings.sidebarMode === 'compact' && !narrow && 'sb-compact', overlay && 'shell-behind', narrow && 'yt-narrow', drawer && 'drawer-open'].filter(Boolean).join(' ');
  return (
    <div className={cls} data-theme={resolveTheme(settings.theme)} style={vars as React.CSSProperties}>
      <Sidebar />
      <TopBar />
      {narrow && drawer && <div className="scrim" style={{ zIndex: 44 }} onPointerDown={() => setYT({ drawer: false })} />}
      {palette && <YTPalette />}
      {help && <HelpSheet groups={YT_SHORTCUTS} onClose={() => setYT({ help: false })} />}
      <ToastStack toasts={toasts} />
    </div>
  );
}
