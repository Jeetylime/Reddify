import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@core/Icon';
import type { IconName } from '@core/Icon';
import { Kbd, Menu, MenuItem } from '@core/ui';
import { HelpSheet, Palette, ToastStack } from '@core/shell';
import type { PaletteRow } from '@core/shell';
import { PlatformSwitcher } from '@core/Switcher';
import { reducedMotion, resolveTheme, themeVars } from '@core/settings';
import type { Density, XMediaSize, XPostStyle } from '@core/settings';
import { X_SHORTCUTS } from '@core/shortcuts';
import { routeTitle } from '../routes';
import { searchX } from '../dom';
import { applyFilter } from '../decorate';
import { classic, compose, copyLink, go, openReader, openSettings, toPlatform, toggleRail, toggleSidebar, toggleTheme } from '../actions';
import { setX, updateSettings, updateX, useX } from '../store';
import { Lightbox, Reader } from './Viewers';

/* ---------------- Sidebar ---------------- */

interface NavDef { key: string; label: string; icon: IconName; path: string; active: boolean; count?: number }

function useNav(): NavDef[] {
  const route = useX((s) => s.route);
  const account = useX((s) => s.account);
  const badges = useX((s) => s.badges);
  const messages = useX((s) => s.messagesPath);
  const me = account?.handle;
  const mine = !!me && route.handle?.toLowerCase() === me.toLowerCase();
  return [
    { key: 'home', label: 'Home', icon: 'home', path: '/home', active: route.kind === 'home' },
    { key: 'explore', label: 'Explore', icon: 'search', path: '/explore', active: route.kind === 'explore' || route.kind === 'search' },
    { key: 'notifications', label: 'Notifications', icon: 'bell', path: '/notifications', active: route.kind === 'notifications', count: badges.notifications },
    { key: 'messages', label: 'Messages', icon: 'mail', path: messages, active: route.kind === 'messages', count: badges.messages },
    { key: 'bookmarks', label: 'Bookmarks', icon: 'bookmark', path: '/i/bookmarks', active: route.kind === 'bookmarks' },
    { key: 'lists', label: 'Lists', icon: 'list', path: me ? `/${me}/lists` : '/i/lists', active: route.kind === 'lists' },
    { key: 'communities', label: 'Communities', icon: 'users', path: me ? `/${me}/communities` : '/i/communities', active: route.kind === 'communities' },
    { key: 'profile', label: 'Profile', icon: 'user', path: me ? `/${me}` : '/settings/profile', active: mine && route.kind === 'profile' },
  ];
}

function NavItem({ n }: { n: NavDef }) {
  return (
    <a className={`sb-item ${n.active ? 'active' : ''}`} href={n.path} title={n.label} aria-current={n.active ? 'page' : undefined} data-nav={n.key}
      onClick={(e) => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(n.path); }}>
      <Icon name={n.icon} size={19} fill={n.active && (n.icon === 'bookmark')} />
      <span className="sb-text">{n.label}</span>
      {!!n.count && <span className="sb-count">{n.count > 99 ? '99+' : n.count}</span>}
    </a>
  );
}

function Sidebar() {
  const settings = useX((s) => s.settings);
  const account = useX((s) => s.account);
  const nav = useNav();
  const compact = settings.sidebarMode === 'compact';
  const more: [IconName, string, string][] = [
    ['sparkles', 'Grok', '/i/grok'], ['star', 'Premium', '/i/premium_sign_up'], ['zap', 'Monetization', '/i/monetization'],
    ['settings', 'Settings and privacy', '/settings'], ['sun', 'Display', '/i/display'], ['keyboard', 'X keyboard shortcuts', '/i/keyboard_shortcuts'],
  ];
  return (
    <aside className="sidebar shell-sidebar" aria-label="Orbit navigation">
      <div className="sb-head">
        <PlatformSwitcher current="x" compact={compact} remember={settings.rememberState} onSettings={() => openSettings('x')} homeHref="/home" />
        {!compact && <button className="ibtn sb-collapse" style={{ marginLeft: 'auto' }} onClick={toggleSidebar} title="Collapse sidebar (\)" aria-label="Collapse sidebar"><Icon name="sidebar" size={17} /></button>}
      </div>
      <nav className="sb-scroll" aria-label="X">
        <div className="sb-section">{nav.slice(0, 4).map((n) => <NavItem key={n.key} n={n} />)}</div>
        <div className="sb-section">
          <div className="sb-label"><span>Library</span></div>
          {nav.slice(4).map((n) => <NavItem key={n.key} n={n} />)}
          <Menu label="More" buttonClass="sb-item sb-more" up align="left" button={<><Icon name="more-h" size={19} /><span className="sb-text">More</span></>}>
            {(close) => (<>
              {more.map(([ic, l, p]) => <MenuItem key={p} icon={ic} label={l} onClick={() => { close(); go(p); }} />)}
              <div className="pop-sep" />
              <MenuItem icon="settings" label="Orbit settings" onClick={() => { close(); openSettings('x'); }} />
              <MenuItem icon="external" label="Classic X on this tab" hint="⌥⇧O" onClick={() => { close(); classic(); }} />
            </>)}
          </Menu>
        </div>
        <button className="x-post-btn" onClick={compose} title="New post (N)" aria-label="New post">
          <Icon name="feather" size={18} /><span className="sb-text">Post</span>
        </button>
      </nav>
      <div className="sb-foot">
        {compact && <button className="ibtn" onClick={toggleSidebar} title="Expand sidebar (\)" aria-label="Expand sidebar"><Icon name="sidebar" size={17} /></button>}
        <Menu label="Account" up align="left" buttonClass="shell-account" button={account ? <>
          {account.avatar ? <img className="avatar md round" src={account.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar md round" aria-hidden="true">{account.handle[0]?.toUpperCase()}</span>}
          <span className="shell-acc-text"><b>{account.name}</b><small>@{account.handle}</small></span>
        </> : <Icon name="user" size={18} />}>
          {(close) => (<>
            {account && <MenuItem icon="user" label="Profile" onClick={() => { close(); go(`/${account.handle}`); }} />}
            <MenuItem icon="settings" label="Settings and privacy" onClick={() => { close(); go('/settings'); }} />
            <MenuItem icon="plus" label="Add an existing account" onClick={() => { close(); location.assign('/i/flow/login'); }} />
            <div className="pop-sep" />
            <MenuItem icon="logout" label={account ? `Log out @${account.handle}` : 'Log out'} onClick={() => { close(); location.assign('/logout'); }} />
          </>)}
        </Menu>
        {!compact && <button className="ibtn" style={{ marginLeft: 'auto' }} onClick={() => openSettings('x')} title="Orbit settings" aria-label="Orbit settings"><Icon name="settings" size={17} /></button>}
      </div>
    </aside>
  );
}

/* ---------------- Top bar ---------------- */

function SearchBox() {
  const route = useX((s) => s.route);
  const [q, setQ] = useState(route.kind === 'search' ? route.q ?? '' : '');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setQ(route.kind === 'search' ? route.q ?? '' : ''); }, [route.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const f = () => { input.current?.focus(); input.current?.select(); };
    window.addEventListener('orbit:search', f);
    return () => window.removeEventListener('orbit:search', f);
  }, []);
  return (
    <form className="tb-search" role="search" onSubmit={(e) => { e.preventDefault(); const t = q.trim(); if (t) { input.current?.blur(); searchX(t); } }}>
      <div className="search-box" onClick={() => input.current?.focus()}>
        <Icon name="search" size={16} />
        <input ref={input} value={q} placeholder="Search X" aria-label="Search X" onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') input.current?.blur(); }} />
        {q ? <button type="button" className="ibtn sm" onClick={(e) => { e.stopPropagation(); setQ(''); input.current?.focus(); }} aria-label="Clear search"><Icon name="x" size={14} /></button> : <Kbd>/</Kbd>}
      </div>
    </form>
  );
}

function FeedTabs() {
  const tabs = useX((s) => s.tabs);
  if (tabs.length < 2) return null;
  return (
    <div className="seg x-tabs" role="tablist" aria-label="Timeline">
      {tabs.map((t) => (
        <button key={t.label} role="tab" aria-selected={t.selected} className={t.selected ? 'on' : ''} onClick={() => { t.el.click(); window.scrollTo({ top: 0 }); }}>{t.label}</button>
      ))}
    </div>
  );
}

function BookmarkFilter() {
  const filter = useX((s) => s.filter);
  const count = useX((s) => s.filterCount);
  return (
    <div className="search-box x-filter">
      <Icon name="filter" size={15} />
      <input value={filter} placeholder="Filter bookmarks" aria-label="Filter bookmarks" onChange={(e) => setX({ filter: e.target.value, filterCount: applyFilter(e.target.value) })} onKeyDown={(e) => e.stopPropagation()} />
      {filter && <span className="mute tnum" style={{ fontSize: 12 }}>{count}</span>}
      {filter && <button className="ibtn sm" onClick={() => setX({ filter: '', filterCount: applyFilter('') })} aria-label="Clear filter"><Icon name="x" size={13} /></button>}
    </div>
  );
}

function ViewMenu() {
  const s = useX((x) => x.settings);
  const seg = <T extends string>(value: T, opts: [T, string][], set: (v: T) => void) => (
    <div className="seg" role="radiogroup">{opts.map(([v, l]) => <button key={v} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => set(v)}>{l}</button>)}</div>
  );
  return (
    <Menu label="View options" button={<Icon name="density" size={17} />}>
      {() => (
        <div className="shell-view">
          <div className="pop-head">Timeline</div>
          <div className="shell-view-row"><span>Posts</span>{seg<XPostStyle>(s.x.postStyle, [['cards', 'Cards'], ['list', 'List']], (v) => updateX({ postStyle: v }))}</div>
          <div className="shell-view-row"><span>Density</span>{seg<Density>(s.density, [['cozy', 'Cozy'], ['regular', 'Regular'], ['tight', 'Tight']], (v) => updateSettings({ density: v }))}</div>
          <div className="shell-view-row"><span>Media</span>{seg<XMediaSize>(s.x.mediaSize, [['compact', 'Compact'], ['balanced', 'Balanced'], ['full', 'Full']], (v) => updateX({ mediaSize: v }))}</div>
          <div className="pop-sep" />
          <MenuItem icon="sidebar" label="Right panel" checked={!s.x.hideRail} onClick={toggleRail} />
          <MenuItem icon="eye-off" label="Hide promoted posts" checked={s.x.hidePromoted} onClick={() => updateX({ hidePromoted: !s.x.hidePromoted })} />
          <MenuItem icon="chart" label="Hide view counts" checked={s.x.hideViews} onClick={() => updateX({ hideViews: !s.x.hideViews })} />
        </div>
      )}
    </Menu>
  );
}

function TopBar() {
  const route = useX((s) => s.route);
  const settings = useX((s) => s.settings);
  const native = useX((s) => s.pageTitle);
  const [title, sub] = native ?? routeTitle(route);
  const dark = resolveTheme(settings.theme) === 'dark';
  const canBack = route.kind !== 'home' && history.length > 1;
  return (
    <header className="topbar shell-topbar">
      <div className="tb-title">
        {canBack && <button className="ibtn" onClick={() => history.back()} title="Back" aria-label="Back"><Icon name="arrow-left" /></button>}
        <div className="t"><h1>{title}</h1>{sub && <small>{sub}</small>}</div>
      </div>
      {route.kind === 'home' && <FeedTabs />}
      {route.kind === 'bookmarks' ? <BookmarkFilter /> : <SearchBox />}
      <div className="tb-actions">
        {route.kind === 'status' && <>
          <button className="btn sm" onClick={openReader} title="Read the whole thread (⇧R)"><Icon name="book" size={15} /><span className="hide-md">Read thread</span></button>
          <button className="ibtn" onClick={() => void copyLink()} title="Copy link" aria-label="Copy link"><Icon name="link" size={17} /></button>
        </>}
        <ViewMenu />
        <button className="ibtn hide-md" onClick={toggleTheme} title={`${dark ? 'Light' : 'Dark'} theme`} aria-label="Toggle theme"><Icon name={dark ? 'sun' : 'moon'} size={17} /></button>
        <button className="ibtn" onClick={() => setX({ palette: true })} title="Command palette (Ctrl/⌘ K)" aria-label="Command palette"><Icon name="command" size={17} /></button>
        <button className="btn primary sm x-compose" onClick={compose} title="New post"><Icon name="feather" size={15} /><span className="hide-md">Post</span></button>
      </div>
    </header>
  );
}

/* ---------------- Palette & help ---------------- */

function XPalette() {
  const settings = useX((s) => s.settings);
  const route = useX((s) => s.route);
  const nav = useNav();
  const dark = resolveTheme(settings.theme) === 'dark';
  const rows = useMemo(() => {
    const all: PaletteRow[] = [];
    for (const n of nav) all.push({ id: `go-${n.key}`, group: 'Go to', label: n.label, icon: n.icon, run: () => go(n.path) });
    all.push({ id: 'go-settings', group: 'Go to', label: 'X settings', icon: 'settings', run: () => go('/settings') });
    const cmd = (id: string, label: string, icon: IconName, run: () => void, hint?: string, keywords = '') => all.push({ id, group: 'Commands', label, icon, hint, keywords, run });
    cmd('compose', 'New post', 'feather', compose, 'N', 'tweet write compose');
    cmd('reddit', 'Switch to Reddit', 'swap', () => toPlatform('reddit'), undefined, 'platform orbit launcher');
    cmd('youtube', 'Switch to YouTube', 'swap', () => toPlatform('youtube'), undefined, 'platform orbit launcher video');
    if (route.kind === 'status') { cmd('reader', 'Read the whole thread', 'book', openReader, '⇧R', 'reader unroll'); cmd('copy', 'Copy link to post', 'link', () => void copyLink()); }
    cmd('theme', `Switch to ${dark ? 'light' : 'dark'} theme`, dark ? 'sun' : 'moon', toggleTheme, undefined, 'appearance mode');
    cmd('sidebar', settings.sidebarMode === 'compact' ? 'Expand sidebar' : 'Compact sidebar', 'sidebar', toggleSidebar, '\\');
    cmd('style', settings.x.postStyle === 'cards' ? 'Show posts as a list' : 'Show posts as cards', 'comfortable', () => updateX({ postStyle: settings.x.postStyle === 'cards' ? 'list' : 'cards' }), undefined, 'layout');
    cmd('rail', settings.x.hideRail ? 'Show right panel' : 'Hide right panel', 'sidebar', toggleRail, undefined, 'trends who to follow');
    for (const d of ['cozy', 'regular', 'tight'] as Density[]) cmd(`density-${d}`, `${d[0].toUpperCase()}${d.slice(1)} density`, 'density', () => updateSettings({ density: d }), undefined, 'spacing');
    cmd('keys', 'Keyboard shortcuts', 'keyboard', () => setX({ help: true }), '?', 'help');
    cmd('settings', 'Orbit settings', 'settings', () => openSettings('x'), undefined, 'options preferences');
    cmd('classic', 'Classic X on this tab', 'external', classic, '⌥⇧O', 'original native');
    return all;
  }, [nav, settings, route.kind, dark]);
  return <Palette rows={rows} onClose={() => setX({ palette: false })} placeholder="Go anywhere on X, run a command, search…" footer="Orbit for X"
    search={(q) => ({ id: 'search', group: 'Search', label: `Search X for “${q}”`, icon: 'search', run: () => searchX(q) })} />;
}

/* ---------------- Root ---------------- */

export function Chrome() {
  const settings = useX((s) => s.settings);
  const session = useX((s) => s.session);
  const overlay = useX((s) => s.overlay);
  const palette = useX((s) => s.palette);
  const help = useX((s) => s.help);
  const reader = useX((s) => !!s.reader);
  const lightbox = useX((s) => !!s.lightbox);
  const narrow = useX((s) => s.narrow);
  const toasts = useX((s) => s.toasts);
  const vars = useMemo(() => themeVars(settings), [settings]);
  const theme = resolveTheme(settings.theme);
  const cls = ['root', 'shell-root', reducedMotion(settings) && 'no-motion', settings.sidebarMode === 'compact' && 'sb-compact', overlay && 'shell-behind', narrow && 'x-narrow'].filter(Boolean).join(' ');
  const chrome: ReactNode = session === 'in' ? <><Sidebar /><TopBar /></> : null;
  return (
    <div className={cls} data-theme={theme} style={vars as React.CSSProperties}>
      {chrome}
      {palette && <XPalette />}
      {help && <HelpSheet groups={X_SHORTCUTS} onClose={() => setX({ help: false })} />}
      {reader && <Reader />}
      {lightbox && <Lightbox />}
      <ToastStack toasts={toasts} />
    </div>
  );
}
