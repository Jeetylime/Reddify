import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { PostMedia, viewMedia } from '../components/Media';
import { PostMeta } from '../components/PostCard';
import { PostMenu, SaveBtn, ShareBtn, Votes, useRegister } from '../components/Actions';
import { Composer, CommentTree, Ctx, Html } from '../components/Comments';
import type { ThreadCtx } from '../components/Comments';
import { ThreadSkeleton } from '../components/Skeletons';
import { ErrorState, FlairChip, Menu, MenuItem } from '../lib/ui';
import { fetchMore, fetchThread } from '../api/reddit';
import type { Comment, CommentNode, More, Post } from '../api/types';
import { asApiError } from '../state/paged';
import type { ApiError } from '../api/reddit';
import { getState, useApp, useEffective, visitPost, visitSub } from '../state/store';
import { getScroller, setRefresh } from '../state/actions';
import type { PostRoute } from '../lib/router';
import { compact, plural } from '../lib/format';

const CSORTS: [string, string][] = [['confidence', 'Best'], ['top', 'Top'], ['new', 'New'], ['controversial', 'Controversial'], ['old', 'Old'], ['qa', 'Q&A']];

function mapTree(nodes: CommentNode[], fn: (n: CommentNode) => CommentNode | CommentNode[]): CommentNode[] {
  let changed = false;
  const out = nodes.flatMap((n) => {
    const r = fn(n);
    if (r !== n) { changed = true; return Array.isArray(r) ? r : [r]; }
    if (n.kind === 'comment' && n.replies.length) {
      const kids = mapTree(n.replies, fn);
      if (kids !== n.replies) { changed = true; return [{ ...n, replies: kids }]; }
    }
    return [n];
  });
  return changed ? out : nodes;
}

function initialCollapsed(nodes: CommentNode[], depth: number, out = new Set<string>()) {
  for (const n of nodes) {
    if (n.kind !== 'comment') continue;
    if (n.collapsedByDefault || (depth > 0 && n.depth >= depth && n.replies.length)) out.add(n.name);
    initialCollapsed(n.replies, depth, out);
  }
  return out;
}

// Keep loaded threads so Back from a comment permalink (or re-opening) is instant.
const threadCache = new Map<string, { post: Post; tree: CommentNode[] }>();

export function PostView({ route }: { route: PostRoute }) {
  const me = useApp((s) => s.me);
  const [sort, setSort] = useState(() => getState().settings.defaultCommentSort);
  const [nonce, setNonce] = useState(0);
  const cacheKey = `${route.key}|${sort}`;
  const [data, setData] = useState(() => threadCache.get(cacheKey) ?? null);
  const [error, setError] = useState<ApiError | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let dead = false;
    const cached = nonce === 0 ? threadCache.get(cacheKey) : undefined;
    setError(null);
    getScroller()?.scrollTo({ top: 0 });
    if (cached) { setData(cached); } else setData(null);
    fetchThread(route.sub, route.id, sort, route.focus)
      .then((r) => {
        if (dead) return;
        const d = { post: r.post, tree: r.comments };
        threadCache.set(cacheKey, d);
        if (threadCache.size > 12) threadCache.delete(threadCache.keys().next().value as string);
        setData(d);
        if (!cached) setCollapsed(initialCollapsed(r.comments, getState().settings.autoCollapseDepth));
        visitPost(r.post);
        visitSub(r.post.sub, r.post.subIcon);
        document.title = `Reddify · ${r.post.title}`;
      })
      .catch((e) => { if (!dead && !cached) setError(asApiError(e)); });
    return () => { dead = true; };
  }, [cacheKey, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setRefresh(() => setNonce((n) => n + 1)); return () => setRefresh(null); }, []);

  const toggle = useCallback((name: string) => setCollapsed((s) => { const n = new Set(s); if (!n.delete(name)) n.add(name); return n; }), []);

  useEffect(() => {
    const onAll = (e: Event) => {
      const mode = (e as CustomEvent<'collapse' | 'expand'>).detail;
      setData((d) => {
        if (d) setCollapsed(mode === 'expand' ? new Set() : new Set(d.tree.filter((n): n is Comment => n.kind === 'comment').map((n) => n.name)));
        return d;
      });
    };
    window.addEventListener('reddify:collapse-all', onAll);
    return () => window.removeEventListener('reddify:collapse-all', onAll);
  }, []);

  const ctx: ThreadCtx | null = useMemo(() => {
    if (!data) return null;
    const { post } = data;
    const update = (fn: (t: CommentNode[]) => CommentNode[]) => setData((d) => { if (!d) return d; const nd = { ...d, tree: fn(d.tree) }; threadCache.set(cacheKey, nd); return nd; });
    return {
      collapsed, toggle, canReply: !!me && !post.locked && !post.archived, postPermalink: post.permalink,
      loadMore: async (m: More) => {
        const nodes = await fetchMore(post.name, m, sort, post.author);
        update((t) => mapTree(t, (n) => (n.kind === 'more' && n.id === m.id ? nodes : n)));
      },
      addReply: (parent: string, c: Comment) => update((t) => mapTree(t, (n) => (n.kind === 'comment' && n.name === parent ? { ...n, replies: [{ ...c, depth: n.depth + 1 }, ...n.replies] } : n))),
    };
  }, [data, collapsed, toggle, me, sort, cacheKey]);

  if (error) return <div className="post-full"><ErrorState message={error.message} onRetry={() => setNonce((n) => n + 1)} detail={error.detail} /></div>;
  if (!data || !ctx) return <ThreadSkeleton />;
  const { post, tree } = data;
  const sortLabel = CSORTS.find(([k]) => k === sort)?.[1] ?? 'Best';

  return (
    <Ctx.Provider value={ctx}>
      <PostBody post={post} />
      {route.focus && (
        <div className="note"><Icon name="layers" size={15} />You’re viewing a single comment thread.<a href={post.permalink}>View all comments</a></div>
      )}
      {post.locked || post.archived
        ? <div className="note"><Icon name="lock" size={15} />{post.archived ? 'This post is archived. New comments and votes are disabled.' : 'Comments are locked on this post.'}</div>
        : me ? <Composer parent={post.name} depth={0} placeholder={`Add a comment as u/${me.name}…`} onPosted={(c) => setData((d) => d && ({ ...d, tree: [c, ...d.tree] }))} />
        : me === null && <div className="note"><Icon name="user" size={15} />Log in to join the conversation.<a href="/login">Log in</a></div>}
      <div className="c-bar">
        <h2>{plural(post.comments, 'comment')}</h2>
        <Menu label="Sort comments" buttonClass="btn sm" button={<><Icon name="swap" size={14} />{sortLabel}<Icon name="chev-down" size={13} /></>}>
          {(close) => CSORTS.map(([k, l]) => <MenuItem key={k} label={l} checked={k === sort} onClick={() => { close(); setSort(k); }} />)}
        </Menu>
        <button className="ibtn" title="Collapse all threads (⇧X)" aria-label="Collapse all" onClick={() => window.dispatchEvent(new CustomEvent('reddify:collapse-all', { detail: 'collapse' }))}><Icon name="collapse" size={16} /></button>
        <button className="ibtn" title="Expand all (⇧E)" aria-label="Expand all" onClick={() => window.dispatchEvent(new CustomEvent('reddify:collapse-all', { detail: 'expand' }))}><Icon name="expand" size={16} /></button>
      </div>
      {tree.length === 0
        ? <div className="state"><div className="state-ic"><Icon name="comment" size={22} /></div><h3>No comments yet</h3><p>Start the conversation.</p></div>
        : <CommentTree nodes={tree} />}
    </Ctx.Provider>
  );
}

function PostBody({ post }: { post: Post }) {
  const hideFlair = useApp((s) => s.settings.hide.flairs);
  const e = useEffective(post);
  useRegister({ kind: 'post', item: post, href: post.permalink, post });
  const pct = post.ratio != null ? Math.round(post.ratio * 100) : null;
  return (
    <article className="post-full" data-name={post.name}>
      <PostMeta post={post} full />
      <h1 className="p-title">{post.title}{!hideFlair && <FlairChip flair={post.flair} />}</h1>
      {post.crosspostOf && <div className="note" style={{ margin: '0 0 12px' }}><Icon name="share" size={14} />Crossposted from r/{post.crosspostOf.sub}<a href={post.crosspostOf.permalink}>Original post</a></div>}
      <PostMedia post={post} full />
      {post.selftextHtml && <Html html={post.selftextHtml} />}
      <div className="p-actions">
        <Votes item={post} row />
        <span className="act static"><Icon name="comment" size={16} />{compact(post.comments)}</span>
        <ShareBtn path={post.permalink} label />
        <SaveBtn item={post} label />
        {post.media && post.media.kind !== 'link' && <button className="act" onClick={() => viewMedia(post)} title="View media (M)"><Icon name="maximize" size={15} /></button>}
        <PostMenu post={post} />
        {pct != null && <span className="ratio" title={`${pct}% upvoted`}><span className="ratio-bar"><i style={{ width: `${pct}%` }} /></span>{pct}% · {compact(e.score)} pts</span>}
      </div>
    </article>
  );
}

