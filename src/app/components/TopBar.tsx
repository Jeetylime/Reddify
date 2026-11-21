import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { Avatar, Kbd, Menu, MenuItem, useDismiss } from '../lib/ui';
import { TIMED, feedHref, navigate, withQuery } from '../lib/router';
import type { Route } from '../lib/router';
import { useRoute } from '../lib/useRoute';
import { rememberSearch, setState, updateSettings, useApp } from '../state/store';
import { classic, openHelp, openPalette, openSettings, refresh, toggleReading, toggleSidebar, toggleTheme } from '../state/actions';
import { autocomplete } from '../api/reddit';
import type { Community } from '../api/types';
import { compact } from '../lib/format';
import { resolveTheme } from '../../shared/settings';
import type { Layout } from '../../shared/settings';

export const SORTS: Record<string, { label: string; icon: IconName }> = {
  best: { label: 'Best', icon: 'zap' }, hot: { label: 'Hot', icon: 'flame' }, new: { label: 'New', icon: 'sparkle' },
  top: { label: 'Top', icon: 'top' }, rising: { label: 'Rising', icon: 'trend' }, controversial: { label: 'Controversial', icon: 'swap' },
  relevance: { label: 'Relevance', icon: 'search' }, comments: { label: 'Most comments', icon: 'comment' },
};
const TIMES: [string, string][] = [['hour', 'Past hour'], ['day', 'Today'], ['week', 'This week'], ['month', 'This month'], ['year', 'This year'], ['all', 'All time']];

function sortsFor(r: Route): string[] | null {
  if (r.kind === 'feed') return r.scope === 'home' ? ['best', 'hot', 'new', 'top', 'rising'] : ['hot', 'new', 'top', 'rising', 'controversial'];
  if (r.kind === 'user') return ['new', 'hot', 'top', 'controversial'];
  if (r.kind === 'search' && r.type === 'link') return ['relevance', 'hot', 'top', 'new', 'comments'];
  return null;
}

function SortMenu({ route }: { route: Route }) {
  const opts = sortsFor(route);
  if (!opts || (route.kind !== 'feed' && route.kind !== 'user' && route.kind !== 'search')) return null;
  const cur = route.sort;
  const timed = route.kind === 'search' ? cur !== 'new' : TIMED.has(cur);
  const t = route.t ?? (route.kind === 'search' ? 'all' : 'day');
  const href = (sort: string, time?: string): string => {
    const needsT = route.kind === 'search' ? sort !== 'new' : TIMED.has(sort);
    const tt = needsT ? (time ?? t) : undefined;
    if (route.kind === 'feed') return feedHref(route, sort, tt);
    if (route.kind === 'user') return withQuery(`/user/${route.name}${route.tab === 'overview' ? '' : '/' + route.tab}`, { sort, t: tt });
    return withQuery(route.sub ? `/r/${route.sub}/search` : '/search', { q: route.q, sort, t: tt, restrict_sr: route.sub ? 'on' : undefined });
  };
  const m = SORTS[cur] ?? SORTS.hot;
  return (
    <Menu label="Sort" buttonClass="btn sm" button={<><Icon name={m.icon} size={15} /><span className="hide-md">{m.label}{timed ? ` · ${TIMES.find(([k]) => k === t)?.[1] ?? t}` : ''}</span><Icon name="chev-down" size={13} /></>}>
      {(close) => (<>
        <div className="pop-head">Sort by</div>
        {opts.map((o) => <MenuItem key={o} icon={SORTS[o].icon} label={SORTS[o].label} checked={o === cur} hint={route.kind === 'feed' && o !== cur ? `⇧${o[0].toUpperCase()}` : undefined} onClick={() => { close(); navigate(href(o)); }} />)}
        {timed && <>
          <div className="pop-sep" />
          <div className="pop-head">Time range</div>
          {TIMES.map(([k, l]) => <MenuItem key={k} icon="clock" label={l} checked={k === t} onClick={() => { close(); navigate(href(cur, k)); }} />)}
        </>}
      </>)}
    </Menu>
  );
}

const LAYOUTS: { id: Layout; label: string }[] = [
  { id: 'comfortable', label: 'Comfortable' }, { id: 'compact', label: 'Compact' }, { id: 'gallery', label: 'Gallery' }, { id: 'minimal', label: 'Minimal' },
];

function SearchBox({ route }: { route: Route | null }) {
  const recent = useApp((s) => s.local.recentSearches);
  const mySubs = useApp((s) => s.mySubs);
  const routeSub = route?.kind === 'feed' && route.scope === 'sub' ? route.sub : route?.kind === 'post' ? route.sub || undefined : route?.kind === 'search' ? route.sub : undefined;
  const [scope, setScope] = useState<string | undefined>(routeSub);
  const [q, setQ] = useState(route?.kind === 'search' ? route.q : '');
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const [remote, setRemote] = useState<Community[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useDismiss(wrap, () => setOpen(false), open);

  useEffect(() => { setScope(routeSub); }, [routeSub]);
  useEffect(() => { setQ(route?.kind === 'search' ? route.q : ''); }, [route?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const focus = () => { input.current?.focus(); input.current?.select(); };
    window.addEventListener('reddify:search', focus);
    return () => window.removeEventListener('reddify:search', focus);
  }, []);

  const term = q.trim().replace(/^\/?r\//i, '');
  useEffect(() => {
    if (term.length < 2 || /\s/.test(term)) { setRemote([]); return; }
    const id = window.setTimeout(() => autocomplete(term).then(setRemote).catch(() => setRemote([])), 180);
    return () => window.clearTimeout(id);
  }, [term]);

  type Row = { key: string; node: React.ReactNode; run: () => void };
  const rows = useMemo(() => {
    const out: Row[] = [];
    const go = (path: string) => { setOpen(false); input.current?.blur(); navigate(path); };
    const search = (text: string, sub?: string) => { rememberSearch(text); go(withQuery(sub ? `/r/${sub}/search` : '/search', { q: text, restrict_sr: sub ? 'on' : undefined })); };
    const text = q.trim();
    if (!text) {
      recent.slice(0, 6).forEach((r) => out.push({ key: 'r:' + r, node: <><Icon name="clock" size={15} /><span>{r}</span></>, run: () => search(r, scope) }));
      return out;
    }
    if (/^\/?u\/[\w-]+$/i.test(text)) { const u = text.replace(/^\/?u\//i, ''); out.push({ key: 'u', node: <><Icon name="user" size={15} /><span>Go to <b>u/{u}</b></span></>, run: () => go(`/user/${u}`) }); }
    if (/^\/?r\/[\w+]+$/i.test(text)) out.push({ key: 'go', node: <><Icon name="chev-right" size={15} /><span>Go to <b>r/{term}</b></span></>, run: () => go(`/r/${term}`) });
    if (scope) out.push({ key: 'qs', node: <><Icon name="search" size={15} /><span>Search <b>{text}</b> in r/{scope}</span></>, run: () => search(text, scope) });
    out.push({ key: 'q', node: <><Icon name="globe" size={15} /><span>Search all of Reddit for <b>{text}</b></span></>, run: () => search(text) });
    const seen = new Set<string>();
    const t = term.toLowerCase();
    for (const c of [...mySubs.filter((s) => t && s.name.toLowerCase().includes(t)).slice(0, 3), ...remote]) {
      if (seen.has(c.name.toLowerCase())) continue;
      seen.add(c.name.toLowerCase());
      out.push({ key: 'c:' + c.name, node: <><Avatar name={c.name} src={c.icon} /><span>r/<b>{c.name}</b></span><span className="sub">{c.subscribers ? `${compact(c.subscribers)} members` : ''}</span></>, run: () => go(`/r/${c.name}`) });
      if (seen.size >= 6) break;
    }
    return out;
  }, [q, term, recent, remote, mySubs, scope]);

  useEffect(() => setHl(0), [q]);

  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHl((h) => Math.min(rows.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); rows[hl]?.run(); }
    else if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
    else if (e.key === 'Backspace' && !q && scope) setScope(undefined);
  };

  return (
    <div className="tb-search" ref={wrap}>
      <div className="search-box" onClick={() => input.current?.focus()}>
        <Icon name="search" size={16} />
        {scope && <span className="scope-chip">r/{scope}<button onClick={(e) => { e.stopPropagation(); setScope(undefined); input.current?.focus(); }} aria-label="Search all of Reddit instead"><Icon name="x" size={11} /></button></span>}
        <input ref={input} value={q} placeholder={scope ? 'Search this community' : 'Search Reddit'} aria-label="Search Reddit" role="combobox" aria-expanded={open && rows.length > 0}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
        {q ? <button className="ibtn sm" onClick={(e) => { e.stopPropagation(); setQ(''); input.current?.focus(); }} aria-label="Clear search"><Icon name="x" size={14} /></button> : <Kbd>/</Kbd>}
      </div>
      {open && rows.length > 0 && (
        <div className="pop left suggest" role="listbox">
          {!q.trim() && <div className="pop-head">Recent searches</div>}
          {rows.map((r, i) => <button key={r.key} role="option" aria-selected={i === hl} className={`sg-row ${i === hl ? 'hl' : ''}`} onMouseMove={() => setHl(i)} onClick={r.run}>{r.node}</button>)}
        </div>
      )}
    </div>
  );
}

function heading(r: Route | null): [string, string?] {
  if (!r) return ['Reddify'];
  switch (r.kind) {
    case 'feed': return [r.title, r.scope === 'home' ? 'Your front page' : r.scope === 'popular' ? 'Trending across Reddit' : r.scope === 'all' ? 'Everything, everywhere' : r.scope === 'multi' ? 'Multireddit' : 'Community'];
    case 'post': return [r.sub ? `r/${r.sub}` : 'Post', 'Discussion'];
    case 'user': return [`u/${r.name}`, r.tab === 'overview' ? 'Profile' : r.tab[0].toUpperCase() + r.tab.slice(1)];
    case 'search': return [r.q ? `“${r.q}”` : 'Search', r.sub ? `Results in r/${r.sub}` : 'Search results'];
    case 'inbox': return ['Inbox', 'Messages & replies'];
  }
}

export function TopBar() {
  const route = useRoute();
  const settings = useApp((s) => s.settings);
  const me = useApp((s) => s.me);
  const dark = resolveTheme(settings.theme) === 'dark';
  const [title, sub] = heading(route);
  const listy = !!route && (route.kind === 'feed' || route.kind === 'user' || (route.kind === 'search' && route.type === 'link'));
  const back = () => (history.state?.reddify ? history.back() : navigate(route?.kind === 'post' && route.sub ? `/r/${route.sub}` : '/'));

  return (
    <header className="topbar">
      <button className="ibtn tb-menu" onClick={() => setState((s) => ({ mobileNav: !s.mobileNav }))} aria-label="Menu"><Icon name="menu" /></button>
      <div className="tb-title">
        {route?.kind === 'post' && <button className="ibtn" onClick={back} title="Back (Esc)" aria-label="Back"><Icon name="arrow-left" /></button>}
        <div className="t"><h1>{title}</h1>{sub && <small>{sub}</small>}</div>
      </div>
      <SearchBox route={route} />
      <div className="tb-actions">
        {route && <SortMenu route={route} />}
        {listy && !settings.hide.layoutSwitcher && (
          <div className="seg hide-lg" role="group" aria-label="Layout" style={{ marginLeft: 6 }}>
            {LAYOUTS.map((l, i) => (
              <button key={l.id} className={settings.layout === l.id ? 'on' : ''} title={`${l.label} (${i + 1})`} aria-label={l.label} aria-pressed={settings.layout === l.id} onClick={() => updateSettings({ layout: l.id })}>
                <Icon name={l.id} size={15} />
              </button>
            ))}
          </div>
        )}
        <span className="tb-sep hide-md" />
        {route?.kind !== 'post' && <button className="ibtn hide-md" onClick={refresh} title="Refresh (R)" aria-label="Refresh"><Icon name="refresh" size={17} /></button>}
        <button className="ibtn" onClick={openPalette} title="Quick switcher (Ctrl/⌘ K)" aria-label="Quick switcher"><Icon name="command" size={17} /></button>
        <button className="ibtn hide-md" onClick={toggleTheme} title={`${dark ? 'Light' : 'Dark'} theme (T)`} aria-label="Toggle theme"><Icon name={dark ? 'sun' : 'moon'} size={17} /></button>
        <a className="ibtn" href="/message/inbox" title={me?.inbox ? `${me.inbox} unread` : 'Inbox'} aria-label="Inbox">
          <Icon name="bell" size={17} />{!!me?.inbox && <span className="badge">{me.inbox > 99 ? '99+' : me.inbox}</span>}
        </a>
        <Menu label="Account and options" button={me ? <Avatar name={me.name} src={me.icon} size="md" round /> : <Icon name="user" />}>
          {(close) => (<>
            {me ? <>
              <a className="pop-user" href={`/user/${me.name}`} onClick={close}><Avatar name={me.name} src={me.icon} size="md" round /><span><b>u/{me.name}</b><span className="mute" style={{ fontSize: 12 }}>{compact(me.karma)} karma</span></span></a>
              <div className="pop-sep" />
              <MenuItem icon="user" label="Profile" href={`/user/${me.name}`} onClick={close} />
              <MenuItem icon="bookmark" label="Saved" href={`/user/${me.name}/saved`} onClick={close} />
              <MenuItem icon="mail" label="Inbox" href="/message/inbox" onClick={close} />
            </> : <MenuItem icon="user" label="Log in to Reddit" href="/login" />}
            <div className="pop-sep" />
            <MenuItem icon={dark ? 'sun' : 'moon'} label={`${dark ? 'Light' : 'Dark'} theme`} hint="T" onClick={() => { close(); toggleTheme(); }} />
            <MenuItem icon="sidebar" label={settings.sidebarMode === 'compact' ? 'Expand sidebar' : 'Compact sidebar'} hint="B" onClick={() => { close(); toggleSidebar(); }} />
            <MenuItem icon="eye" label="Reading mode" checked={settings.readingMode} onClick={() => { close(); toggleReading(); }} />
            <MenuItem icon="keyboard" label="Keyboard shortcuts" hint="?" onClick={() => { close(); openHelp(); }} />
            <MenuItem icon="settings" label="Reddify settings" onClick={() => { close(); openSettings(); }} />
            <div className="pop-sep" />
            <MenuItem icon="external" label="Open in classic Reddit" hint="⌥⇧R" onClick={() => { close(); classic(); }} />
            {me && <MenuItem icon="settings" label="Reddit account settings" href="/settings" onClick={close} />}
          </>)}
        </Menu>
      </div>
    </header>
  );
}
