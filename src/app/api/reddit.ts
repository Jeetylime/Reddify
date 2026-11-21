import type { Comment, CommentNode, Community, Flair, ImageSrc, Item, Me, Media, Message, More, Page, Post, Rule, UserAbout, Vote } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = any;

export type ErrorKind = 'rate' | 'forbidden' | 'missing' | 'auth' | 'network' | 'server';
export class ApiError extends Error {
  constructor(public status: number, message: string, public kind: ErrorKind) { super(message); }
}

/* ------------------------- transport ------------------------- */

const inflight = new Map<string, Promise<unknown>>();

/**
 * GET a Reddit JSON endpoint on the *same origin* as the page. The browser attaches the user's
 * existing session cookies automatically; Reddify never reads, stores or modifies them.
 */
interface Raw { status: number; text: string; via: string }

async function direct(url: string): Promise<Raw> {
  const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
  return { status: res.status, text: await res.text(), via: 'page' };
}

/**
 * Fallback: ask the extension's service worker to fetch. Reddit sometimes refuses listing requests
 * made by page scripts (403); the worker can retry without page context and via old.reddit.com.
 */
async function viaBackground(url: string): Promise<Raw | null> {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'fetch-json', url });
    return r && typeof r.status === 'number' ? (r as Raw) : null;
  } catch { return null; }
}

const isJson = (r: Raw) => r.status >= 200 && r.status < 300 && /^\s*[[{]/.test(r.text);
const reasonOf = (r: Raw) => { try { return JSON.parse(r.text)?.reason ?? ''; } catch { return ''; } };

export function getJson<T = J>(path: string, params: Record<string, string | number | undefined | null> = {}): Promise<T> {
  const u = new URL(path, location.origin);
  u.searchParams.set('raw_json', '1');
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  const key = u.toString();
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    let res: Raw | null = null;
    try { res = await direct(key); } catch { /* network/CORS: try the fallback */ }
    const reason = res ? reasonOf(res) : '';
    const legit = reason === 'private' || reason === 'quarantined' || reason === 'banned' || res?.status === 404;
    if (!res || (!isJson(res) && !legit)) {
      const fb = await viaBackground(key);
      if (fb && (isJson(fb) || !res)) res = fb;
      if (fb && !isJson(fb)) console.warn(`[Reddify] GET ${key} failed: page ${res?.status ?? 'error'}, fallback ${fb.status} (${fb.via})`, fb.text.slice(0, 200));
    }
    if (!res) throw new ApiError(0, 'Couldn’t reach Reddit. Check your connection and try again.', 'network');
    if (isJson(res)) {
      try { return JSON.parse(res.text) as T; } catch { /* fall through */ }
    }
    const r = reasonOf(res);
    const s = res.status;
    if (s === 429) throw new ApiError(429, 'Reddit is rate-limiting requests. Wait a few seconds and retry.', 'rate');
    if (s === 401) throw new ApiError(401, 'You need to be logged in to see this.', 'auth');
    if (s === 403) throw new ApiError(403, r === 'private' ? 'This community is private.' : r === 'quarantined' ? 'This community is quarantined. Open it in classic Reddit to opt in.' : `Reddit refused this request (403${r ? `: ${r}` : ''}). Try reloading the page; if it keeps happening, use classic Reddit (Alt+Shift+R).`, 'forbidden');
    if (s === 404) throw new ApiError(404, r === 'banned' ? 'This community has been banned.' : 'Nothing was found here.', 'missing');
    throw new ApiError(s, `Reddit returned an unexpected response (${s}).`, 'server');
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/* ------------------------- normalisation ------------------------- */

function flair(text?: string, richtext?: J[], bg?: string, fg?: string): Flair | undefined {
  const emojis = (richtext ?? []).filter((r) => r.e === 'emoji' && r.u).map((r) => ({ e: r.a, u: r.u }));
  const t = (text ?? '').replace(/:[\w-]+:/g, '').trim();
  if (!t && !emojis.length) return undefined;
  const f: Flair = { text: t };
  if (emojis.length) f.emojis = emojis;
  if (bg && bg !== 'transparent') f.bg = bg;
  if (fg === 'light' || fg === 'dark') f.fg = fg;
  return f;
}

function pick(resolutions: J[] | undefined, source: J, target: number): ImageSrc | undefined {
  const list = [...(resolutions ?? []), source].filter((r) => r?.url);
  const best = list.find((r) => r.width >= target) ?? list[list.length - 1];
  return best ? { url: best.url, w: best.width, h: best.height } : undefined;
}

function mediaOf(d: J): Media | undefined {
  const prev = d.preview?.images?.[0];
  // Reddit-hosted video (v.redd.it): video and audio are separate DASH streams.
  const rv = d.secure_media?.reddit_video ?? d.media?.reddit_video;
  if (rv?.fallback_url) {
    const base = String(rv.fallback_url).replace(/\/DASH_[^/]*$/, '').replace(/\?.*$/, '');
    return {
      kind: 'video', url: rv.fallback_url,
      audioUrl: rv.is_gif || rv.has_audio === false ? undefined : `${base}/DASH_AUDIO_128.mp4`,
      poster: pick(prev?.resolutions, prev?.source, 640), w: rv.width || 16, h: rv.height || 9, gif: !!rv.is_gif, duration: rv.duration,
    };
  }
  if (d.is_gallery && d.gallery_data?.items && d.media_metadata) {
    const items = (d.gallery_data.items as J[]).flatMap((it) => {
      const m = d.media_metadata[it.media_id];
      if (!m || m.status !== 'valid' || !m.s) return [];
      const src: ImageSrc = { url: m.s.u ?? m.s.gif, w: m.s.x, h: m.s.y };
      const p = (m.p ?? []).find((x: J) => x.x >= 640) ?? m.p?.[m.p.length - 1];
      return [{ src, preview: p ? { url: p.u, w: p.x, h: p.y } : undefined, caption: it.caption }];
    });
    if (items.length) return { kind: 'gallery', items };
  }
  const isImage = d.post_hint === 'image' || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(d.url ?? '');
  // Animated previews (imgur .gifv, gifs) come with an mp4 variant — far lighter than the gif.
  const mp4 = prev?.variants?.mp4?.source;
  if (mp4 && (isImage || d.post_hint === 'link')) {
    return { kind: 'video', url: mp4.url, w: mp4.width, h: mp4.height, gif: true, poster: pick(prev.resolutions, prev.source, 640) };
  }
  if (isImage && (prev?.source || d.url)) {
    const src: ImageSrc = prev?.source ? { url: prev.source.url, w: prev.source.width, h: prev.source.height } : { url: d.url, w: 0, h: 0 };
    if (d.domain === 'i.redd.it' && d.url) src.url = d.url; // original quality
    return { kind: 'image', src, preview: pick(prev?.resolutions, prev?.source, 960) };
  }
  if (d.secure_media?.oembed && d.secure_media_embed?.content) {
    const o = d.secure_media.oembed;
    return { kind: 'embed', html: d.secure_media_embed.content, w: o.width || 16, h: o.height || 9, provider: o.provider_name, poster: pick(prev?.resolutions, prev?.source, 640) };
  }
  if (!d.is_self && d.url && !String(d.domain ?? '').startsWith('self.')) {
    return { kind: 'link', url: d.url, domain: d.domain, preview: pick(prev?.resolutions, prev?.source, 320) };
  }
  return undefined;
}

const likesOf = (v: boolean | null | undefined): Vote => (v === true ? 1 : v === false ? -1 : 0);

export function normalizePost(d: J): Post {
  const xp = d.crosspost_parent_list?.[0];
  return {
    kind: 'post',
    id: d.id,
    name: d.name,
    title: d.title ?? '',
    sub: d.subreddit,
    subIcon: (d.sr_detail?.community_icon || d.sr_detail?.icon_img || '').split('?')[0] || undefined,
    author: d.author,
    created: d.created_utc,
    score: d.score ?? 0,
    ratio: d.upvote_ratio,
    comments: d.num_comments ?? 0,
    permalink: d.permalink,
    url: d.url_overridden_by_dest ?? d.url,
    domain: d.domain,
    isSelf: !!d.is_self,
    selftext: d.selftext || undefined,
    selftextHtml: d.selftext_html || undefined,
    flair: flair(d.link_flair_text, d.link_flair_richtext, d.link_flair_background_color, d.link_flair_text_color),
    nsfw: !!d.over_18,
    spoiler: !!d.spoiler,
    stickied: !!(d.stickied || d.pinned),
    locked: !!d.locked,
    archived: !!d.archived,
    promoted: !!(d.promoted || d.is_created_from_ads_ui || d.adserver_click_url),
    distinguished: d.distinguished ?? undefined,
    saved: !!d.saved,
    likes: likesOf(d.likes),
    media: mediaOf(xp ?? d),
    thumb: /^https?:/.test(d.thumbnail ?? '') ? d.thumbnail : undefined,
    crosspostOf: xp ? { sub: xp.subreddit, permalink: xp.permalink, author: xp.author } : undefined,
    awards: d.total_awards_received ?? 0,
    edited: !!d.edited,
  };
}

function normalizeComment(d: J, depth: number, op?: string): Comment {
  return {
    kind: 'comment',
    id: d.id,
    name: d.name,
    author: d.author,
    authorFlair: flair(d.author_flair_text, d.author_flair_richtext, d.author_flair_background_color, d.author_flair_text_color),
    body: d.body ?? '',
    bodyHtml: d.body_html ?? '',
    created: d.created_utc,
    edited: !!d.edited,
    score: d.score ?? 0,
    scoreHidden: !!d.score_hidden,
    depth: d.depth ?? depth,
    isOp: !!op && d.author === op && d.author !== '[deleted]',
    distinguished: d.distinguished ?? undefined,
    stickied: !!d.stickied,
    permalink: d.permalink,
    saved: !!d.saved,
    likes: likesOf(d.likes),
    controversial: (d.controversiality ?? 0) > 0,
    awards: d.total_awards_received ?? 0,
    replies: d.replies?.data?.children ? normalizeChildren(d.replies.data.children, depth + 1, op) : [],
    parent: d.parent_id,
    collapsedByDefault: !!d.collapsed,
    sub: d.subreddit,
    linkTitle: d.link_title,
  };
}

function normalizeMore(d: J, depth: number): More {
  return { kind: 'more', id: d.id ?? d.name, parent: d.parent_id, children: d.children ?? [], count: d.count ?? (d.children?.length ?? 0), depth: d.depth ?? depth };
}

function normalizeChildren(children: J[], depth: number, op?: string): CommentNode[] {
  const out: CommentNode[] = [];
  for (const c of children) {
    if (c.kind === 't1') out.push(normalizeComment(c.data, depth, op));
    else if (c.kind === 'more') out.push(normalizeMore(c.data, depth));
  }
  return out;
}

export function normalizeCommunity(d: J): Community {
  return {
    name: d.display_name,
    title: d.title ?? d.display_name,
    icon: (d.community_icon || d.icon_img || '').split('?')[0] || undefined,
    banner: (d.banner_background_image || d.banner_img || '').split('?')[0] || undefined,
    color: d.primary_color || d.key_color || undefined,
    subscribers: d.subscribers ?? 0,
    active: d.accounts_active ?? d.active_user_count ?? undefined,
    descriptionHtml: d.public_description_html || undefined,
    publicDescription: d.public_description || undefined,
    created: d.created_utc,
    nsfw: !!(d.over18 || d.over_18),
    subscribed: d.user_is_subscriber ?? undefined,
    type: d.subreddit_type,
    fullname: d.name,
  };
}

function normalizeUser(d: J): UserAbout {
  return {
    name: d.name,
    icon: (d.icon_img || d.snoovatar_img || '').split('?')[0] || undefined,
    banner: (d.subreddit?.banner_img || '').split('?')[0] || undefined,
    linkKarma: d.link_karma ?? 0,
    commentKarma: d.comment_karma ?? 0,
    created: d.created_utc,
    bio: d.subreddit?.public_description || undefined,
  };
}

/* ------------------------- reads ------------------------- */

function listingOf(j: J): Page<Item> {
  const items: Item[] = [];
  for (const c of j?.data?.children ?? []) {
    if (c.kind === 't3') items.push(normalizePost(c.data));
    else if (c.kind === 't1') items.push(normalizeComment(c.data, 0));
  }
  return { items, after: j?.data?.after ?? null };
}

export interface ListingOpts { sort?: string; t?: string; after?: string | null; q?: string; restrict?: boolean }

export async function fetchListing(path: string, o: ListingOpts = {}): Promise<Page<Item>> {
  const j = await getJson(path, { sort: o.sort, t: o.t, after: o.after, q: o.q, restrict_sr: o.restrict ? 'on' : undefined, limit: 25, sr_detail: 1 });
  return listingOf(j);
}

export interface Thread { post: Post; comments: CommentNode[] }

export async function fetchThread(sub: string, id: string, sort: string, focus?: string): Promise<Thread> {
  const j = await getJson<J[]>(sub ? `/r/${sub}/comments/${id}.json` : `/comments/${id}.json`, { sort, limit: 200, comment: focus, context: focus ? 3 : undefined, sr_detail: 1 });
  const post = normalizePost(j[0].data.children[0].data);
  return { post, comments: normalizeChildren(j[1]?.data?.children ?? [], 0, post.author) };
}

/** Expands a "load more" stub via /api/morechildren, then rebuilds the subtree from the flat result. */
export async function fetchMore(linkName: string, more: More, sort: string, op?: string): Promise<CommentNode[]> {
  const batch = more.children.slice(0, 100);
  const j = await getJson('/api/morechildren.json', { api_type: 'json', link_id: linkName, children: batch.join(','), sort, limit_children: 'false' });
  const things: J[] = j?.json?.data?.things ?? [];
  const byName = new Map<string, Comment>();
  const nodes: CommentNode[] = things.map((t) => (t.kind === 't1' ? normalizeComment({ ...t.data, replies: '' }, t.data.depth ?? more.depth, op) : normalizeMore(t.data, more.depth)));
  for (const n of nodes) if (n.kind === 'comment') byName.set(n.name, n);
  const roots: CommentNode[] = [];
  for (const n of nodes) {
    const parent = byName.get(n.parent);
    if (parent) parent.replies.push(n); else roots.push(n);
  }
  const rest = more.children.slice(100);
  if (rest.length) roots.push({ ...more, id: `${more.id}+`, children: rest, count: Math.max(rest.length, more.count - batch.length) });
  return roots;
}

export async function fetchCommunity(name: string): Promise<Community> {
  return normalizeCommunity((await getJson(`/r/${name}/about.json`)).data);
}

export async function fetchRules(name: string): Promise<Rule[]> {
  const j = await getJson(`/r/${name}/about/rules.json`);
  return (j.rules ?? []).map((r: J) => ({ name: r.short_name, html: r.description_html ?? '' }));
}

export async function fetchMySubs(): Promise<Community[]> {
  const out: Community[] = [];
  let after: string | null = null;
  for (let i = 0; i < 5; i++) {
    const j: J = await getJson('/subreddits/mine/subscriber.json', { limit: 100, after });
    for (const c of j?.data?.children ?? []) out.push(normalizeCommunity(c.data));
    after = j?.data?.after ?? null;
    if (!after) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function autocomplete(q: string): Promise<Community[]> {
  const j = await getJson('/api/subreddit_autocomplete_v2.json', { query: q, limit: 8, include_over_18: 'on', include_profiles: 'false' });
  return (j?.data?.children ?? []).filter((c: J) => c.kind === 't5').map((c: J) => normalizeCommunity(c.data));
}

export async function searchCommunities(q: string, after: string | null): Promise<Page<Community>> {
  const j = await getJson('/subreddits/search.json', { q, limit: 25, after, include_over_18: 'on' });
  return { items: (j?.data?.children ?? []).map((c: J) => normalizeCommunity(c.data)), after: j?.data?.after ?? null };
}

export async function searchUsers(q: string, after: string | null): Promise<Page<UserAbout>> {
  const j = await getJson('/users/search.json', { q, limit: 25, after });
  return { items: (j?.data?.children ?? []).map((c: J) => normalizeUser(c.data)), after: j?.data?.after ?? null };
}

export async function fetchUser(name: string): Promise<UserAbout> {
  return normalizeUser((await getJson(`/user/${name}/about.json`)).data);
}

export async function fetchMe(): Promise<Me | null> {
  try {
    const j = await getJson('/api/me.json');
    const d = j?.data ?? j;
    if (!d?.name) return null;
    return {
      name: d.name, modhash: d.modhash || undefined, inbox: d.inbox_count ?? 0,
      icon: (d.icon_img || d.snoovatar_img || '').split('?')[0] || undefined,
      karma: (d.link_karma ?? 0) + (d.comment_karma ?? 0),
    };
  } catch { return null; }
}

export async function fetchInbox(which: string, after: string | null): Promise<Page<Message>> {
  const j = await getJson(`/message/${which}.json`, { limit: 25, after });
  return {
    items: (j?.data?.children ?? []).map((c: J) => ({
      name: c.data.name, author: c.data.author ?? 'reddit', subject: c.data.link_title ?? c.data.subject ?? '',
      bodyHtml: c.data.body_html ?? '', created: c.data.created_utc, unread: !!c.data.new, context: c.data.context || undefined, sub: c.data.subreddit || undefined,
    })),
    after: j?.data?.after ?? null,
  };
}

/* ------------------------- authenticated actions ------------------------- */

/**
 * Writes reuse the user's existing session. Legacy cookie sessions expose a modhash (CSRF token)
 * via /api/me.json; newer sessions expose a short-lived bearer token in the `token_v2` cookie, which
 * Reddit's own web client uses against oauth.reddit.com. Nothing is persisted.
 */
let session: Me | null = null;
export const setSession = (me: Me | null) => { session = me; };

function bearer(): string | null {
  const m = /(?:^|;\s*)token_v2=([^;]+)/.exec(document.cookie);
  return m ? decodeURIComponent(m[1]) : null;
}

async function post(path: string, form: Record<string, string>): Promise<J> {
  if (!session) throw new ApiError(401, 'Log in to Reddit to do that.', 'auth');
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  let url = new URL(path, location.origin).toString();
  let credentials: RequestCredentials = 'include';
  const body = new URLSearchParams({ ...form, api_type: 'json' });
  if (session.modhash) {
    headers['X-Modhash'] = session.modhash;
    body.set('uh', session.modhash);
  } else {
    const token = bearer();
    if (!token) throw new ApiError(401, 'Reddify couldn’t find your Reddit session. Reload the page and try again.', 'auth');
    headers.Authorization = `Bearer ${token}`;
    url = new URL(path, 'https://oauth.reddit.com').toString();
    credentials = 'omit';
  }
  let res: Response;
  try { res = await fetch(url, { method: 'POST', credentials, headers, body }); }
  catch { throw new ApiError(0, 'Network error — the action wasn’t completed.', 'network'); }
  if (res.status === 429) throw new ApiError(429, 'Slow down — Reddit rate-limited that action.', 'rate');
  if (res.status === 401 || res.status === 403) throw new ApiError(res.status, 'Reddit rejected the action. Reload the page or log in again.', 'auth');
  if (!res.ok) throw new ApiError(res.status, `Reddit returned an error (${res.status}).`, 'server');
  let j: J = {};
  try { j = await res.json(); } catch { /* some endpoints reply with an empty body */ }
  const errs = j?.json?.errors;
  if (Array.isArray(errs) && errs.length) throw new ApiError(400, String(errs[0]?.[1] ?? errs[0]?.[0] ?? 'Reddit rejected the action.'), 'server');
  return j;
}

export const vote = (name: string, dir: Vote) => post('/api/vote', { id: name, dir: String(dir), rank: '1' });
export const save = (name: string) => post('/api/save', { id: name });
export const unsave = (name: string) => post('/api/unsave', { id: name });
export const hide = (name: string) => post('/api/hide', { id: name });
export const unhide = (name: string) => post('/api/unhide', { id: name });
export const subscribe = (fullname: string, on: boolean) => post('/api/subscribe', { action: on ? 'sub' : 'unsub', sr: fullname });
export const readAll = () => post('/api/read_all_messages', {});

export async function reply(parent: string, text: string, depth: number): Promise<Comment> {
  const j = await post('/api/comment', { thing_id: parent, text });
  const thing = j?.json?.data?.things?.[0]?.data;
  if (!thing) throw new ApiError(500, 'Your comment was posted, but Reddit didn’t return it. Refresh to see it.', 'server');
  return normalizeComment({ ...thing, body_html: thing.body_html ?? thing.contentHTML ?? '', body: thing.body ?? text }, depth);
}
