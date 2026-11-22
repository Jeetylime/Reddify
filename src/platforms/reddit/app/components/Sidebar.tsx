import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@core/Icon';
import { PlatformSwitcher } from '@core/Switcher';
import type { IconName } from '@core/Icon';
import { Avatar } from '../lib/ui';
import { useRoute } from '../lib/useRoute';
import { setState, toast, updateSettings, useApp } from '../state/store';
import { openDrawer, openSettings, toggleSidebar } from '../state/actions';
import { SECTION_LABELS } from '@core/settings';
import type { SectionId } from '@core/settings';
import { compact } from '../lib/format';

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

function Item({ href, icon, label, active, count, lead, onClick, trail }: {
  href?: string; icon?: IconName; label: string; active?: boolean; count?: number; lead?: ReactNode; onClick?: () => void; trail?: ReactNode;
}) {
  const inner = <>{lead ?? (icon && <Icon name={icon} size={18} />)}<span className="sb-text">{label}</span>{!!count && <span className="sb-count">{count > 99 ? '99+' : count}</span>}{trail}</>;
  const cls = `sb-item ${active ? 'active' : ''}`;
  return href
    ? <a className={cls} href={href} title={label} aria-current={active ? 'page' : undefined}>{inner}</a>
    : <button className={cls} onClick={onClick} title={label}>{inner}</button>;
}

function PinToggle({ name, pinned }: { name: string; pinned: boolean }) {
  return (
    <span role="button" tabIndex={0} className={`sb-pin ${pinned ? 'on' : ''}`} title={pinned ? 'Unpin' : 'Pin to top'} aria-label={pinned ? `Unpin r/${name}` : `Pin r/${name}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(name); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); togglePin(name); } }}>
      <Icon name="pin" size={14} fill={pinned} />
    </span>
  );
}

function togglePin(name: string) {
  updateSettings((s) => ({ pinnedSubs: s.pinnedSubs.some((p) => same(p, name)) ? s.pinnedSubs.filter((p) => !same(p, name)) : [...s.pinnedSubs, name] }));
}

export function Sidebar() {
  const route = useRoute();
  const settings = useApp((s) => s.settings);
  const recentSubs = useApp((s) => s.local.recentSubs);
  const me = useApp((s) => s.me);
  const mySubs = useApp((s) => s.mySubs);
  const edit = useApp((s) => s.sidebarEdit);
  const [allSubs, setAllSubs] = useState(false);
  const compactMode = settings.sidebarMode === 'compact';

  const current = route?.kind === 'feed' ? route.sub : route?.kind === 'post' ? route.sub : undefined;
  const scope = route?.kind === 'feed' ? route.scope : undefined;
  const pinned = settings.pinnedSubs;
  const iconOf = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const r of recentSubs) if (r.icon) m.set(r.name.toLowerCase(), r.icon);
    for (const s of mySubs) if (s.icon) m.set(s.name.toLowerCase(), s.icon);
    return (n: string) => m.get(n.toLowerCase());
  }, [recentSubs, mySubs]);

  const sub = (name: string, isPinned: boolean) => (
    <Item key={name} href={`/r/${name}`} label={`r/${name}`} active={same(current, name)} lead={<Avatar name={name} src={iconOf(name)} />} trail={<PinToggle name={name} pinned={isPinned} />} />
  );

  const move = (id: SectionId, dir: -1 | 1) => updateSettings((s) => {
    const o = [...s.navOrder]; const i = o.indexOf(id); const j = i + dir;
    if (j < 0 || j >= o.length) return {};
    [o[i], o[j]] = [o[j], o[i]];
    return { navOrder: o };
  });
  const toggleHidden = (id: SectionId) => updateSettings((s) => ({ navHidden: s.navHidden.includes(id) ? s.navHidden.filter((x) => x !== id) : [...s.navHidden, id] }));
  const addQuick = () => {
    const url = location.pathname + location.search;
    if (settings.quickLinks.some((q) => q.url === url)) { toast('This page is already in Quick access'); return; }
    const label = document.title.replace(/^Orbit\s*·\s*/, '').slice(0, 48) || url;
    updateSettings((s) => ({ quickLinks: [...s.quickLinks, { id: Date.now().toString(36), label, url }] }));
    toast(`Added “${label}” to Quick access`, 'success');
  };

  const hint = (t: string) => !compactMode && <div className="sb-hint">{t}</div>;
  const recent = recentSubs.filter((r) => !pinned.some((p) => same(p, r.name))).slice(0, 6);

  const sections: Record<SectionId, ReactNode> = {
    feeds: <>
      <Item href="/" icon="home" label="Home" active={scope === 'home'} />
      <Item href="/r/popular" icon="flame" label="Popular" active={scope === 'popular'} />
      <Item href="/r/all" icon="globe" label="All" active={scope === 'all'} />
    </>,
    pinned: pinned.length ? pinned.map((n) => sub(n, true)) : hint('Pin communities to keep them here. Hover any community and click the pin.'),
    quick: <>
      {settings.quickLinks.map((q) => (
        <Item key={q.id} href={q.url} icon="star" label={q.label} active={q.url === location.pathname + location.search}
          trail={edit && <span role="button" tabIndex={0} className="sb-pin on" title="Remove" onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateSettings((s) => ({ quickLinks: s.quickLinks.filter((x) => x.id !== q.id) })); }}><Icon name="x" size={13} /></span>} />
      ))}
      {(edit || settings.quickLinks.length === 0) && <Item icon="plus" label="Add this page" onClick={addQuick} />}
    </>,
    recent: recent.length ? recent.map((r) => sub(r.name, false)) : hint('Communities you visit appear here.'),
    subs: me ? <>
      {(allSubs ? mySubs : mySubs.slice(0, 8)).map((s) => sub(s.name, pinned.some((p) => same(p, s.name))))}
      {mySubs.length > 8 && <Item icon={allSubs ? 'chev-up' : 'chev-down'} label={allSubs ? 'Show less' : `Show all ${mySubs.length}`} onClick={() => setAllSubs((v) => !v)} />}
      {mySubs.length === 0 && hint('Join communities to see them here.')}
    </> : hint(me === undefined ? 'Loading…' : 'Log in to see the communities you’ve joined.'),
    you: <>
      {me ? <>
        <Item href={`/user/${me.name}`} label={`u/${me.name}`} lead={<Avatar name={me.name} src={me.icon} round />} active={route?.kind === 'user' && same(route.name, me.name) && route.tab !== 'saved'} />
        <Item href={`/user/${me.name}/saved`} icon="bookmark" label="Saved" active={route?.kind === 'user' && route.tab === 'saved'} />
        <Item href="/message/inbox" icon="mail" label="Inbox" count={me.inbox} active={route?.kind === 'inbox'} />
      </> : me === null && <Item icon="user" label="Log in" onClick={() => location.assign('/login')} />}
      <Item icon="clock" label="History" onClick={openDrawer} />
    </>,
  };

  const order = settings.navOrder.filter((id) => edit || !settings.navHidden.includes(id));
  return (
    <aside className="sidebar" aria-label="Navigation">
      <div className="sb-head">
        <PlatformSwitcher current="reddit" compact={compactMode} remember={settings.rememberState} onSettings={openSettings} homeHref="/" />
        <button className="ibtn sb-collapse" style={{ marginLeft: 'auto' }} onClick={toggleSidebar} title="Collapse sidebar (B)"><Icon name="sidebar" size={17} /></button>
      </div>
      <nav className="sb-scroll">
        {order.map((id, i) => {
          const hidden = settings.navHidden.includes(id);
          return (
            <div className="sb-section" key={id} style={hidden ? { opacity: 0.45 } : undefined}>
              {(id !== 'feeds' || edit) && (
                <div className="sb-label">
                  <span>{SECTION_LABELS[id]}</span>
                  {edit && (
                    <span className="sb-edit">
                      <button disabled={i === 0} onClick={() => move(id, -1)} title="Move up" aria-label={`Move ${SECTION_LABELS[id]} up`}><Icon name="chev-up" size={13} /></button>
                      <button disabled={i === order.length - 1} onClick={() => move(id, 1)} title="Move down" aria-label={`Move ${SECTION_LABELS[id]} down`}><Icon name="chev-down" size={13} /></button>
                      <button onClick={() => toggleHidden(id)} title={hidden ? 'Show section' : 'Hide section'} aria-label={hidden ? 'Show section' : 'Hide section'}><Icon name={hidden ? 'eye' : 'eye-off'} size={13} /></button>
                    </span>
                  )}
                </div>
              )}
              {sections[id]}
            </div>
          );
        })}
      </nav>
      <div className="sb-foot">
        {compactMode && <button className="ibtn" onClick={toggleSidebar} title="Expand sidebar (B)"><Icon name="sidebar" size={17} /></button>}
        <button className={`ibtn ${edit ? 'on' : ''}`} onClick={() => setState((s) => ({ sidebarEdit: !s.sidebarEdit }))} title={edit ? 'Done' : 'Customize sidebar'} aria-pressed={edit}><Icon name={edit ? 'check' : 'edit'} size={17} /></button>
        <button className="ibtn" onClick={openSettings} title="Orbit settings"><Icon name="settings" size={17} /></button>
        {me && <span className="karma" title="Total karma">{compact(me.karma)} karma</span>}
      </div>
    </aside>
  );
}
