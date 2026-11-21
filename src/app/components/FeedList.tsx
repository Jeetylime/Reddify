import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { GalleryTile, PostCard } from './PostCard';
import { PostSkeletons } from './Skeletons';
import { CommentItem } from './Comments';
import { Empty, ErrorState, Spinner, useSentinel } from '../lib/ui';
import { Icon } from './Icon';
import type { Item, Post } from '../api/types';
import type { Paged } from '../state/paged';
import { useApp } from '../state/store';
import { getScroller, toTop } from '../state/actions';
import type { Settings } from '../../shared/settings';

export interface FilterOpts { applyMutes: boolean }

export function filterItems(items: Item[], s: Settings, opts: FilterOpts): { items: Item[]; hidden: number } {
  const muted = new Set(s.mutedSubs.map((x) => x.toLowerCase()));
  const kws = s.mutedKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  let hidden = 0;
  const out = items.filter((it) => {
    if (it.kind !== 'post') return true;
    const drop = (s.hidePromoted && it.promoted)
      || (s.hideCrossposts && !!it.crosspostOf)
      || (opts.applyMutes && muted.has(it.sub.toLowerCase()))
      || (opts.applyMutes && kws.some((k) => it.title.toLowerCase().includes(k)));
    if (drop) hidden++;
    return !drop;
  });
  return { items: out, hidden };
}

/** Restores the scroll position on Back and records it as you scroll. */
export function useScrollMemory(p: { scrollTop: number }) {
  useLayoutEffect(() => {
    const el = getScroller();
    if (!el) return;
    el.scrollTop = p.scrollTop;
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { p.scrollTop = el.scrollTop; }); };
    el.addEventListener('scroll', on, { passive: true });
    return () => { el.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, [p]);
}

function Masonry({ posts, focused }: { posts: Post[]; focused: string | null }) {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const el = getScroller();
    if (!el) return;
    const ro = new ResizeObserver(() => setCols(Math.max(1, Math.min(5, Math.floor((el.clientWidth - 48) / 270)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Greedy "shortest column" placement keeps reading order roughly left-to-right, top-to-bottom.
  const columns = useMemo(() => {
    const out: Post[][] = Array.from({ length: cols }, () => []);
    const h = new Array(cols).fill(0);
    for (const p of posts) {
      const m = p.media;
      const r = m?.kind === 'image' ? (m.preview ?? m.src) : m?.kind === 'gallery' ? (m.items[0].preview ?? m.items[0].src) : m?.kind === 'video' ? { w: m.w, h: m.h } : null;
      const est = r && r.w ? Math.min(r.h / r.w, 2) : 0.55;
      const i = h.indexOf(Math.min(...h));
      out[i].push(p);
      h[i] += est + 0.08;
    }
    return out;
  }, [posts, cols]);
  return (
    <div className="masonry">
      {columns.map((c, i) => <div className="masonry-col" key={i}>{c.map((p) => <GalleryTile key={p.name} post={p} focused={focused === p.name} />)}</div>)}
    </div>
  );
}

/** Renders a paginated listing (posts and/or comments) with every layout, loading/empty/error states and infinite scroll. */
export function FeedList({ paged, applyMutes, emptyText, filter }: { paged: Paged<Item>; applyMutes: boolean; emptyText?: string; filter?: (i: Item) => boolean }) {
  const settings = useApp((s) => s.settings);
  const visited = useApp((s) => s.local.visited);
  const focused = useApp((s) => s.focused);
  const [bypass, setBypass] = useState(false);
  useScrollMemory(paged);
  const base = filter ? paged.items.filter(filter) : paged.items;
  const { items, hidden } = bypass ? { items: base, hidden: 0 } : filterItems(base, settings, { applyMutes });
  const sentinel = useSentinel(() => void paged.more(), paged.status === 'ready' && !paged.exhausted && !paged.loadingMore && !paged.moreError);
  const visitedSet = useMemo(() => new Set(settings.dimVisited ? visited : []), [visited, settings.dimVisited]);

  // If filters swallowed a whole page, keep fetching so the screen isn't empty.
  useEffect(() => {
    if (paged.status === 'ready' && items.length < 6 && !paged.exhausted && !paged.loadingMore && !paged.moreError) void paged.more();
  }, [paged, paged.status, items.length, paged.exhausted, paged.loadingMore, paged.moreError]);

  if (paged.status === 'error') return <div className="list"><ErrorState message={paged.error?.message ?? 'Something went wrong.'} onRetry={() => void paged.load()} /></div>;
  if (paged.status !== 'ready') return <PostSkeletons layout={settings.layout} />;

  const layout = settings.layout;
  const posts = items.filter((i): i is Post => i.kind === 'post');
  const mixed = posts.length !== items.length;
  let body: React.ReactNode;
  if (!items.length && paged.exhausted) {
    body = <div className="list"><Empty icon="search" title="Nothing to show" text={hidden ? `All ${hidden} posts here were hidden by your filters.` : emptyText ?? 'This feed is empty right now.'} action={hidden ? <button className="btn" onClick={() => setBypass(true)}>Show hidden posts</button> : undefined} /></div>;
  } else if (layout === 'gallery' && !mixed) {
    body = <Masonry posts={posts} focused={focused} />;
  } else {
    const l = layout === 'gallery' ? 'comfortable' : layout;
    body = (
      <div className="list" role="feed" aria-busy={paged.loadingMore}>
        {items.map((it) => it.kind === 'post'
          ? <PostCard key={it.name} post={it} layout={l} focused={focused === it.name} visited={visitedSet.has(it.id)} />
          : <CommentItem key={it.name} c={it} />)}
      </div>
    );
  }
  return (
    <>
      {(hidden > 0 || bypass) && (
        <div className="notice"><Icon name="filter" size={13} />
          {bypass ? 'Showing everything, including filtered posts.' : `${hidden} post${hidden === 1 ? '' : 's'} hidden by your filters.`}
          <button onClick={() => setBypass((b) => !b)}>{bypass ? 'Re-apply filters' : 'Show'}</button>
        </div>
      )}
      {body}
      {!paged.exhausted && <div ref={sentinel} style={{ height: 1 }} />}
      {paged.loadingMore && <div className="foot-row"><Spinner />Loading more…</div>}
      {paged.moreError && <div className="foot-row">{paged.moreError.message}<button className="btn sm" onClick={() => void paged.more()}>Retry</button></div>}
      {paged.exhausted && items.length > 0 && <div className="foot-row">You’re all caught up<button className="btn sm ghost" onClick={toTop}><Icon name="arrow-up" size={14} />Back to top</button></div>}
    </>
  );
}
