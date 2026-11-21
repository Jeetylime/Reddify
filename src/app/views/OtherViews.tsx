import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { FeedList } from '../components/FeedList';
import { UserHeader } from '../components/Headers';
import { Html } from '../components/Comments';
import { Avatar, Empty, ErrorState, Spinner, useSentinel } from '../lib/ui';
import { fetchInbox, fetchListing, readAll, searchCommunities, searchUsers } from '../api/reddit';
import type { Community, Item, Message, UserAbout } from '../api/types';
import { Paged, getPaged, usePaged } from '../state/paged';
import { refreshMe, rememberSearch, toast, useApp } from '../state/store';
import { getScroller, setRefresh } from '../state/actions';
import { navType, navigate, withQuery } from '../lib/router';
import type { InboxRoute, SearchRoute, UserRoute } from '../lib/router';
import { useListing } from './FeedView';
import { compact, timeAgo } from '../lib/format';

function Tabs({ tabs, current, href }: { tabs: [string, string][]; current: string; href: (k: string) => string }) {
  return <nav className="tabs">{tabs.map(([k, l]) => <a key={k} className={k === current ? 'on' : ''} href={href(k)} aria-current={k === current ? 'page' : undefined}>{l}</a>)}</nav>;
}

export function UserView({ route }: { route: UserRoute }) {
  const me = useApp((s) => s.me);
  const own = !!me && me.name.toLowerCase() === route.name.toLowerCase();
  const path = `/user/${route.name}${route.tab === 'overview' ? '' : '/' + route.tab}.json`;
  const paged = useListing(route.key, (after) => fetchListing(path, { sort: route.sort, t: route.t, after }));
  const [sub, setSub] = useState<string | null>(null);
  useEffect(() => setSub(null), [route.key]);
  const tabs: [string, string][] = [['overview', 'Overview'], ['submitted', 'Posts'], ['comments', 'Comments']];
  if (own) tabs.push(['saved', 'Saved'], ['upvoted', 'Upvoted'], ['downvoted', 'Downvoted'], ['hidden', 'Hidden']);
  const privateTab = ['saved', 'upvoted', 'downvoted', 'hidden'].includes(route.tab);

  // Saved-items organisation: group by community (Reddit's API offers no folders for regular accounts).
  const subOf = (i: Item) => (i.kind === 'post' ? i.sub : i.sub ?? '');
  const groups = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of paged.items) { const s = subOf(i); if (s) c.set(s, (c.get(s) ?? 0) + 1); }
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [paged.items]);

  return (
    <>
      <UserHeader name={route.name} />
      <Tabs tabs={tabs} current={route.tab} href={(k) => `/user/${route.name}${k === 'overview' ? '' : '/' + k}`} />
      {route.tab === 'saved' && groups.length > 1 && (
        <div className="chips" style={{ marginBottom: 12 }} aria-label="Filter saved items by community">
          <button className={`chip ${sub === null ? 'on' : ''}`} onClick={() => setSub(null)}>All <span className="n">{paged.items.length}{paged.exhausted ? '' : '+'}</span></button>
          {groups.map(([s, n]) => <button key={s} className={`chip ${sub === s ? 'on' : ''}`} onClick={() => setSub(sub === s ? null : s)}>r/{s} <span className="n">{n}</span></button>)}
        </div>
      )}
      {privateTab && me === null
        ? <div className="list"><Empty icon="lock" title="Log in required" text="Log in to Reddit to see this list." action={<a className="btn primary" href="/login">Log in</a>} /></div>
        : privateTab && me && !own
          ? <div className="list"><Empty icon="lock" title="This list is private" text="Only the account owner can see it." /></div>
          : <FeedList paged={paged} applyMutes={false} filter={sub ? (i) => subOf(i) === sub : undefined} emptyText={route.tab === 'saved' ? 'Nothing saved yet. Press S on any post to save it.' : 'Nothing here yet.'} />}
    </>
  );
}

export function SearchView({ route }: { route: SearchRoute }) {
  useEffect(() => { if (route.q) rememberSearch(route.q); }, [route.q]);
  const tabHref = (type: string) => withQuery(route.sub ? `/r/${route.sub}/search` : '/search', { q: route.q, type: type === 'link' ? undefined : type, restrict_sr: route.sub ? 'on' : undefined });
  return (
    <>
      {!route.sub && <Tabs tabs={[['link', 'Posts'], ['sr', 'Communities'], ['user', 'People']]} current={route.type} href={tabHref} />}
      {route.sub && <div className="notice"><Icon name="filter" size={13} />Showing results from r/{route.sub}<button onClick={() => navigate(withQuery('/search', { q: route.q }))}>Search all of Reddit</button></div>}
      {!route.q ? <div className="list"><Empty icon="search" title="Search Reddit" text="Type a query in the search bar. Use r/name to jump to a community or u/name for a person." /></div>
        : route.type === 'link' ? <PostResults route={route} />
        : <EntityResults route={route} />}
    </>
  );
}

function PostResults({ route }: { route: SearchRoute }) {
  const paged = useListing(route.key, (after) => fetchListing(route.sub ? `/r/${route.sub}/search.json` : '/search.json', { q: route.q, sort: route.sort, t: route.t, after, restrict: !!route.sub }));
  return <FeedList paged={paged} applyMutes={false} emptyText={`No posts matched “${route.q}”.`} />;
}

function EntityResults({ route }: { route: SearchRoute }) {
  const isSub = route.type === 'sr';
  const [nonce, setNonce] = useState(0);
  const paged = useMemo(
    () => getPaged<Community | UserAbout>(`${route.key}#e${nonce}`, () => new Paged<Community | UserAbout>((after) => (isSub ? searchCommunities(route.q, after) : searchUsers(route.q, after)), (x) => x.name), navType() === 'push' || nonce > 0),
    [route.key, route.q, isSub, nonce],
  );
  usePaged(paged);
  useEffect(() => { setRefresh(() => setNonce((n) => n + 1)); return () => setRefresh(null); }, []);
  const sentinel = useSentinel(() => void paged.more(), paged.status === 'ready' && !paged.exhausted && !paged.loadingMore);
  if (paged.status === 'error') return <div className="list"><ErrorState message={paged.error?.message ?? 'Search failed'} onRetry={() => void paged.load()} /></div>;
  if (paged.status !== 'ready') return <div className="list">{Array.from({ length: 6 }, (_, i) => <div key={i} className="ent"><div className="sk" style={{ width: 28, height: 28, borderRadius: 8 }} /><div className="grow"><div className="sk" style={{ width: '30%', height: 12, marginBottom: 7 }} /><div className="sk" style={{ width: '70%', height: 10 }} /></div></div>)}</div>;
  if (!paged.items.length) return <div className="list"><Empty icon="search" title={`No ${isSub ? 'communities' : 'people'} found`} text="Try another search term." /></div>;
  return (
    <>
      <div className="list">
        {paged.items.map((x) => isSub ? (
          <a key={x.name} className="ent" href={`/r/${x.name}`}>
            <Avatar name={x.name} src={(x as Community).icon} size="md" />
            <div className="grow"><div className="n">r/{x.name} <span>· {compact((x as Community).subscribers)} members</span></div><div className="d">{(x as Community).publicDescription}</div></div>
            <Icon name="chev-right" size={16} />
          </a>
        ) : (
          <a key={x.name} className="ent" href={`/user/${x.name}`}>
            <Avatar name={x.name} src={(x as UserAbout).icon} size="md" round />
            <div className="grow"><div className="n">u/{x.name}</div><div className="d">{compact((x as UserAbout).linkKarma + (x as UserAbout).commentKarma)} karma</div></div>
            <Icon name="chev-right" size={16} />
          </a>
        ))}
      </div>
      {!paged.exhausted && <div ref={sentinel} style={{ height: 1 }} />}
      {paged.loadingMore && <div className="foot-row"><Spinner /></div>}
    </>
  );
}

export function InboxView({ route }: { route: InboxRoute }) {
  const me = useApp((s) => s.me);
  const [nonce, setNonce] = useState(0);
  const paged = useMemo(() => getPaged<Message>(`${route.key}#${nonce}`, () => new Paged<Message>((after) => fetchInbox(route.which, after), (m) => m.name), true), [route.key, route.which, nonce]);
  usePaged(paged);
  useEffect(() => { setRefresh(() => setNonce((n) => n + 1)); getScroller()?.scrollTo({ top: 0 }); return () => setRefresh(null); }, [route.key]);
  const sentinel = useSentinel(() => void paged.more(), paged.status === 'ready' && !paged.exhausted && !paged.loadingMore);
  const markAll = async () => {
    try { await readAll(); toast('All messages marked as read', 'success'); void refreshMe(); setNonce((n) => n + 1); }
    catch (e) { toast((e as Error).message, 'error'); }
  };
  if (me === null) return <div className="list"><Empty icon="lock" title="Log in to see your inbox" text="Messages and replies are only available when you’re signed in to Reddit." action={<a className="btn primary" href="/login">Log in</a>} /></div>;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div className="grow"><Tabs tabs={[['inbox', 'All'], ['unread', 'Unread'], ['sent', 'Sent']]} current={route.which} href={(k) => `/message/${k}`} /></div>
        {route.which !== 'sent' && !!me?.inbox && <button className="btn sm" style={{ marginBottom: 12 }} onClick={markAll}><Icon name="check" size={14} />Mark all read</button>}
      </div>
      {paged.status === 'error' ? <div className="list"><ErrorState message={paged.error?.message ?? 'Couldn’t load your inbox'} onRetry={() => void paged.load()} /></div>
        : paged.status !== 'ready' ? <div className="list">{Array.from({ length: 4 }, (_, i) => <div key={i} className="msg"><div className="sk" style={{ width: '25%', height: 10, marginBottom: 8 }} /><div className="sk" style={{ width: '50%', height: 13, marginBottom: 8 }} /><div className="sk" style={{ width: '85%', height: 10 }} /></div>)}</div>
        : !paged.items.length ? <div className="list"><Empty icon="mail" title={route.which === 'unread' ? 'You’re all caught up' : 'No messages'} text={route.which === 'unread' ? 'No unread messages or replies.' : 'Nothing here yet.'} /></div>
        : (
          <>
            <div className="list">
              {paged.items.map((m) => (
                <div key={m.name} className={`msg ${m.unread ? 'unread' : ''}`}>
                  <div className="p-meta"><a href={`/user/${m.author}`} style={{ fontWeight: 650, color: 'var(--text)' }}>u/{m.author}</a>{m.sub && <><span className="sep" /><a href={`/r/${m.sub}`}>r/{m.sub}</a></>}<span className="sep" /><span>{timeAgo(m.created)}</span></div>
                  <div className="subject">{m.context ? <a href={m.context}>{m.subject}</a> : m.subject}</div>
                  <Html html={m.bodyHtml} />
                </div>
              ))}
            </div>
            {!paged.exhausted && <div ref={sentinel} style={{ height: 1 }} />}
          </>
        )}
    </>
  );
}
