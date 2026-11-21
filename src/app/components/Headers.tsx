import { useState } from 'react';
import { Icon } from './Icon';
import { Avatar } from '../lib/ui';
import { Html } from './Comments';
import { compact, timeAgo } from '../lib/format';
import { useCached, invalidate } from '../state/cache';
import { fetchCommunity, fetchRules, fetchUser, subscribe } from '../api/reddit';
import { refreshMe, toast, updateSettings, useApp } from '../state/store';
import { openDrawer } from '../state/actions';
import type { Community } from '../api/types';
import type { Route } from '../lib/router';

export function useCommunity(name?: string) {
  const ok = !!name && !name.includes('+') && !/^(popular|all)$/i.test(name);
  return useCached<Community>(ok ? `sub:${name!.toLowerCase()}` : null, () => fetchCommunity(name!));
}

export function CommunityHeader({ name }: { name: string }) {
  const { data: c } = useCommunity(name);
  const me = useApp((s) => s.me);
  const pinned = useApp((s) => s.settings.pinnedSubs.some((p) => p.toLowerCase() === name.toLowerCase()));
  const muted = useApp((s) => s.settings.mutedSubs.some((p) => p.toLowerCase() === name.toLowerCase()));
  const [joined, setJoined] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const isJoined = joined ?? !!c?.subscribed;
  const display = c?.name ?? name;

  const toggleJoin = async () => {
    if (!me) { toast('Log in to Reddit to join communities', 'error', { label: 'Log in', run: () => location.assign('/login') }); return; }
    if (!c?.fullname) return;
    setBusy(true);
    try {
      await subscribe(c.fullname, !isJoined);
      setJoined(!isJoined);
      invalidate(`sub:${name.toLowerCase()}`);
      void refreshMe();
      toast(isJoined ? `Left r/${display}` : `Joined r/${display}`, 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <section className="head-card" aria-label={`r/${display}`}>
      <div className={`head-banner ${c?.banner ? '' : 'plain'}`} style={c?.banner ? { backgroundImage: `url("${c.banner}")` } : ({ '--hc': c?.color } as React.CSSProperties)} />
      <div className="head-body">
        <Avatar name={display} src={c?.icon} size="lg" />
        <div className="head-text">
          <h2>r/{display}</h2>
          <p>{c ? (c.title && c.title.toLowerCase() !== display.toLowerCase() ? c.title : c.publicDescription ?? '') : ' '}</p>
        </div>
        <div className="head-actions">
          <button className={`ibtn ${pinned ? 'on' : ''}`} aria-pressed={pinned} title={pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
            onClick={() => updateSettings((s) => ({ pinnedSubs: pinned ? s.pinnedSubs.filter((p) => p.toLowerCase() !== name.toLowerCase()) : [...s.pinnedSubs, display] }))}>
            <Icon name="pin" size={17} fill={pinned} />
          </button>
          <button className={`ibtn ${muted ? 'on' : ''}`} aria-pressed={muted} title={muted ? 'Unmute (show in Home/Popular/All)' : 'Mute in Home/Popular/All'}
            onClick={() => updateSettings((s) => ({ mutedSubs: muted ? s.mutedSubs.filter((p) => p.toLowerCase() !== name.toLowerCase()) : [...s.mutedSubs, display] }))}>
            <Icon name={muted ? 'eye-off' : 'eye'} size={17} />
          </button>
          <button className={`btn ${isJoined ? '' : 'primary'}`} style={{ minWidth: 72 }} onClick={toggleJoin} disabled={busy || !c?.fullname}>{isJoined ? 'Joined' : 'Join'}</button>
        </div>
      </div>
      <div className="stats">
        <span><b>{c ? compact(c.subscribers) : '—'}</b>members</span>
        {c?.active != null && <span className="live"><b>{compact(c.active)}</b>online</span>}
        {c?.nsfw && <span className="tag nsfw">NSFW</span>}
        {c?.type && c.type !== 'public' && <span className="tag lock">{c.type}</span>}
      </div>
    </section>
  );
}

export function UserHeader({ name }: { name: string }) {
  const { data: u, error } = useCached(`user:${name.toLowerCase()}`, () => fetchUser(name));
  return (
    <section className="head-card" aria-label={`u/${name}`}>
      <div className={`head-banner ${u?.banner ? '' : 'plain'}`} style={u?.banner ? { backgroundImage: `url("${u.banner}")` } : undefined} />
      <div className="head-body">
        <Avatar name={name} src={u?.icon} size="lg" round />
        <div className="head-text"><h2>u/{name}</h2><p>{error ? 'This account may be suspended or deleted.' : u?.bio ?? ' '}</p></div>
      </div>
      <div className="stats">
        <span><b>{u ? compact(u.linkKarma + u.commentKarma) : '—'}</b>karma</span>
        <span><b>{u ? compact(u.linkKarma) : '—'}</b>post karma</span>
        <span><b>{u ? compact(u.commentKarma) : '—'}</b>comment karma</span>
        {u && <span>Joined <b>{new Date(u.created * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</b></span>}
      </div>
    </section>
  );
}

/* ---------------- right rail ---------------- */

function AboutCard({ name }: { name: string }) {
  const { data: c } = useCommunity(name);
  const { data: rules } = useCached(`rules:${name.toLowerCase()}`, () => fetchRules(name));
  if (!c) return <div className="card"><div className="sk" style={{ height: 10, width: '40%', marginBottom: 14 }} /><div className="sk" style={{ height: 10, marginBottom: 8 }} /><div className="sk" style={{ height: 10, width: '75%' }} /></div>;
  return (
    <>
      <div className="card">
        <h3 className="card-h">About</h3>
        <div className="about">{c.descriptionHtml ? <Html html={c.descriptionHtml} /> : <p style={{ margin: 0 }}>{c.publicDescription || 'No description.'}</p>}</div>
        <div className="facts">
          <div><b>{compact(c.subscribers)}</b>Members</div>
          <div><b>{c.active != null ? compact(c.active) : '—'}</b>Online now</div>
          <div><b>{new Date(c.created * 1000).getFullYear()}</b>Created</div>
          <div><b>{c.type ? c.type[0].toUpperCase() + c.type.slice(1) : 'Public'}</b>Type</div>
        </div>
      </div>
      {rules && rules.length > 0 && (
        <div className="card">
          <h3 className="card-h">Rules</h3>
          {rules.map((r, i) => (
            <details className="rule" key={i}>
              <summary><span>{i + 1}</span>{r.name}</summary>
              {r.html && <Html html={r.html} />}
            </details>
          ))}
        </div>
      )}
    </>
  );
}

function RecentCard({ limit = 5 }: { limit?: number }) {
  const posts = useApp((s) => s.local.recentPosts);
  return (
    <div className="card">
      <h3 className="card-h">Recently viewed{posts.length > 0 && <button className="btn xs ghost" onClick={openDrawer}>See all</button>}</h3>
      {posts.length === 0 && <div className="about">Posts you open will show up here, so you can always find your way back.</div>}
      {posts.slice(0, limit).map((p) => (
        <a key={p.id} className="mini" href={p.permalink}>
          {p.thumb ? <img className="mini-thumb" src={p.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="mini-thumb"><Icon name="comment" size={16} /></span>}
          <div className="grow"><div className="t">{p.title}</div><div className="s">r/{p.sub} · {timeAgo(p.at / 1000)} ago</div></div>
        </a>
      ))}
    </div>
  );
}

function JumpCard() {
  const pinned = useApp((s) => s.settings.pinnedSubs);
  const recent = useApp((s) => s.local.recentSubs);
  const all = [...pinned.map((name) => ({ name, icon: recent.find((r) => r.name.toLowerCase() === name.toLowerCase())?.icon })), ...recent.filter((r) => !pinned.some((p) => p.toLowerCase() === r.name.toLowerCase()))].slice(0, 12);
  if (!all.length) return null;
  return (
    <div className="card">
      <h3 className="card-h">Jump back in</h3>
      <div className="chips">{all.map((r) => <a key={r.name} className="chip" href={`/r/${r.name}`}><Avatar name={r.name} src={r.icon} size="xs" />{r.name}</a>)}</div>
    </div>
  );
}

export function Rail({ route }: { route: Route }) {
  const sub = route.kind === 'feed' && route.scope === 'sub' ? route.sub : route.kind === 'post' && route.sub ? route.sub : undefined;
  return (
    <aside className="rail" aria-label="Context">
      <div className="rail-sticky">
        {sub ? <><AboutCard name={sub} /><RecentCard limit={3} /></> : <><RecentCard /><JumpCard /></>}
      </div>
    </aside>
  );
}
