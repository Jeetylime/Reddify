import { $, $$, MEDIA_IMG, POST_TEXT, authorOf, findMain, findNavColumn, findPageHeader, findRail, isPromoted, permalinkOf } from './dom';
import { dockSticky } from './theme';
import type { XRoute } from './routes';

/**
 * Marks X's own DOM with data-orbit-* attributes that the skin (x.css) styles. Work is incremental: each
 * post is processed once, measurements are batched (reads first, then writes) and nothing is ever rebuilt.
 */

const done = new WeakSet<Element>();
const set = (el: Element, k: string, v = '') => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); };
const unset = (el: Element, k: string) => { if (el.hasAttribute(k)) el.removeAttribute(k); };

/** The timeline row that holds one post: the topmost single-child wrapper around the <article>. */
function cellOf(article: HTMLElement, main: HTMLElement): HTMLElement {
  const legacy = article.closest<HTMLElement>('[data-testid="cellInnerDiv"]');
  if (legacy) return legacy;
  // X's current client renders timelines as <ul><li>…</li></ul>.
  const li = article.closest<HTMLElement>('li');
  if (li && main.contains(li) && li.querySelectorAll('article').length === 1 && !li.closest('article')) return li;
  let cell: HTMLElement = article;
  for (let p = article.parentElement; p && p !== main && p.childElementCount === 1 && !p.matches('[role="dialog"], section[aria-labelledby], [data-orbit-cell]'); p = p.parentElement) cell = p;
  return cell;
}

/** The visible card inside a cell (cells carry the gap; cards carry surface, border and radius). */
function cardOf(cell: HTMLElement, article: HTMLElement): HTMLElement {
  if (cell === article) return article;
  const first = cell.firstElementChild as HTMLElement | null;
  return first && first.contains(article) ? first : cell;
}

function textOf(el: Element): string { return (el.textContent ?? '').replace(/\s+/g, ' ').trim(); }

/** A thin vertical line in the avatar column = this post continues into the next one (a thread). */
function threadLine(article: HTMLElement): HTMLElement | null {
  const av = $('[data-post-avatar]', article) ?? $('[data-testid="Tweet-User-Avatar"]', article);
  const col = av?.parentElement;
  if (!col) return null;
  const avR = av!.getBoundingClientRect();
  for (const el of $$(':scope > *, :scope > * > *', col)) {
    if (el === av || el.contains(av!) || av!.contains(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.width <= 4 && r.height >= 10 && r.top >= avR.bottom - 4) return el;
  }
  return null;
}

/** The rounded frame around a post's media (image grid, video, card image). */
function mediaFrame(img: Element, article: HTMLElement): HTMLElement | null {
  const legacy = img.closest<HTMLElement>('[data-testid="tweetPhoto"]')?.closest<HTMLElement>('[aria-labelledby] > div, [id^="id__"] > div');
  let el: HTMLElement | null = img.parentElement;
  for (let i = 0; el && el !== article && i < 10; i++, el = el.parentElement) {
    if (el.matches('[role="link"]') && el.querySelector(POST_TEXT)) return null; // inside a quoted post: leave it
    const cs = getComputedStyle(el);
    if (parseFloat(cs.borderTopLeftRadius) >= 8 && cs.overflow !== 'visible' && el.getBoundingClientRect().width > 120) return el;
  }
  return legacy ?? null;
}

export interface DecorateCtx { route: XRoute; promotedHidden: boolean }

/** Processes newly rendered posts and refreshes route-dependent marks. Cheap to call often. */
export function decorate(ctx: DecorateCtx): void {
  const main = findMain();
  if (!main) return;
  const fresh = $$<HTMLElement>('article', main).filter((a) => !done.has(a));
  const writes: (() => void)[] = [];

  for (const article of fresh) {
    done.add(article);
    const cell = cellOf(article, main);
    const card = cardOf(cell, article);
    const promoted = isPromoted(article);
    const line = threadLine(article);
    const frames = new Map<HTMLElement, number>();
    for (const img of $$(`${MEDIA_IMG}, video`, article)) {
      const f = mediaFrame(img, article);
      if (f && !frames.has(f)) {
        const r = f.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) frames.set(f, r.height / r.width);
      }
    }
    const social = $$('span, div', article).find((el) => el.childElementCount <= 3 && /\b(reposted|retweeted)$/i.test(textOf(el)) && !el.closest(POST_TEXT));
    const quote = $$('div[role="link"]', article).find((q) => q.querySelector(POST_TEXT));
    writes.push(() => {
      set(article, 'data-orbit-post');
      set(cell, 'data-orbit-cell');
      set(card, 'data-orbit-card');
      for (let el: HTMLElement | null = article; el && el !== cell; el = el.parentElement) set(el, 'data-orbit-chain');
      if (promoted) set(cell, 'data-orbit-promoted');
      if (line) { set(line, 'data-orbit-threadline'); set(cell, 'data-orbit-joined-next'); }
      for (const [f, ar] of frames) { set(f, 'data-orbit-media'); f.style.setProperty('--orbit-ar', ar.toFixed(4)); }
      if (social) set(social, 'data-orbit-social');
      if (quote) set(quote, 'data-orbit-quote');
      const author = authorOf(article);
      if (author) set(article, 'data-orbit-author', author);
    });
  }

  // Non-post rows in the timeline: "Who to follow" carousels and the inline composer.
  for (const h of $$('h2, [role="heading"]', main)) {
    if (done.has(h) || h.closest('article')) continue;
    done.add(h);
    if (/^(who to follow|you might like|creators for you|suggested)/i.test(textOf(h))) {
      const block = h.closest<HTMLElement>('[data-testid="cellInnerDiv"]') ?? climbToRow(h, main);
      if (block) writes.push(() => set(block, 'data-orbit-wtf'));
    }
  }
  const composer = $$('[role="textbox"][contenteditable="true"], [data-testid="tweetTextarea_0"]', main).find((t) => !t.closest('[role="dialog"], article, [data-orbit-composer]'));
  if (composer) {
    const row = climbToRow(composer, main);
    if (row) writes.push(() => set(row, 'data-orbit-composer'));
  }

  for (const w of writes) w();
  if (fresh.length) joinThreads(main);
  markFocal(main, ctx.route);
}

/** Climbs to the child of the timeline list (or of main) that contains `el`. */
function climbToRow(el: Element, main: HTMLElement): HTMLElement | null {
  let row: HTMLElement | null = el as HTMLElement;
  while (row && row.parentElement && row.parentElement !== main && row.parentElement.childElementCount === 1) row = row.parentElement;
  // go up until the parent holds several rows
  while (row && row.parentElement && row.parentElement !== main && row.parentElement.childElementCount < 3) row = row.parentElement;
  return row && row !== main ? row : null;
}

/** Consecutive posts joined by a thread line become one continuous card. */
function joinThreads(main: HTMLElement) {
  for (const cell of $$('[data-orbit-joined-next]', main)) {
    const next = cell.nextElementSibling;
    if (next?.hasAttribute('data-orbit-cell')) set(next, 'data-orbit-joined-prev');
  }
}

let focalKey = '';
/** On a post page, highlight the post itself and the author's own thread around it. */
function markFocal(main: HTMLElement, route: XRoute) {
  if (route.kind !== 'status' || !route.id) {
    if (focalKey) { for (const el of $$('[data-orbit-focal], [data-orbit-op]', main)) { unset(el, 'data-orbit-focal'); unset(el, 'data-orbit-op'); } focalKey = ''; }
    return;
  }
  const posts = $$<HTMLElement>('article[data-orbit-post]', main);
  const focal = posts.find((a) => permalinkOf(a)?.endsWith(`/status/${route.id}`))
    ?? posts.find((a) => !!a.querySelector(`a[href$="/status/${route.id}/analytics"], a[href$="/status/${route.id}/quotes"]`))
    ?? posts.find((a) => a.getAttribute('tabindex') === '-1' && !a.closest('[data-orbit-quote]'));
  if (!focal) return;
  const key = `${route.id}:${posts.length}`;
  if (key === focalKey) return;
  focalKey = key;
  const cell = focal.closest<HTMLElement>('[data-orbit-cell]');
  if (cell) set(cell, 'data-orbit-focal');
  const op = focal.getAttribute('data-orbit-author');
  if (!op) return;
  const i = posts.indexOf(focal);
  const mark = (a: HTMLElement) => { const c = a.closest('[data-orbit-cell]'); if (c) set(c, 'data-orbit-op'); };
  for (let k = i; k >= 0 && posts[k].getAttribute('data-orbit-author') === op; k--) mark(posts[k]);
  for (let k = i + 1; k < posts.length && posts[k].getAttribute('data-orbit-author') === op; k++) mark(posts[k]);
}

/** Classifies the right rail's cards so individual ones can be hidden. */
export function decorateRail(): void {
  const rail = findRail();
  if (!rail) return;
  set(rail, 'data-orbit-rail');
  for (const el of $$('section, aside, [data-testid="trend"]', rail)) {
    if (done.has(el)) continue;
    const label = `${el.getAttribute('aria-label') ?? ''} ${textOf($('h2, [role="heading"]', el) ?? el).slice(0, 60)}`;
    let kind = '';
    if (/premium|subscribe|verified|upgrade/i.test(label)) kind = 'premium';
    else if (/happening|trend/i.test(label)) kind = 'trends';
    else if (/who to follow|you might like/i.test(label)) kind = 'follow';
    else if (/log in|sign up/i.test(label)) kind = 'auth';
    if (kind) { done.add(el); set(el, 'data-orbit-rail-section', kind); }
  }
  // X's own search box (Orbit's top bar has search): the form plus any wrappers that hold nothing else.
  let search = $('form[role="search"], [data-testid="SearchBox_Search_Input"]', rail)?.closest<HTMLElement>('form') ?? null;
  while (search && search.parentElement && search.parentElement !== rail && search.parentElement.childElementCount === 1) search = search.parentElement;
  if (search) set(search, 'data-orbit-rail-section', 'search');
  const footer = $('nav[aria-label="Footer"]', rail);
  if (footer) set(footer, 'data-orbit-rail-section', 'footer');
}

/** Marks X's native navigation column and header so the skin can hide/replace them. */
/**
 * A plain X page header (back button + title + subtitle, nothing else) duplicates Orbit's top bar: hide it and
 * hand its text to the bar. Headers with tabs, search fields or extra actions stay visible.
 */
function plainTitle(header: HTMLElement): [string, string?] | null {
  if (header.querySelector('[role="tablist"], input, [role="textbox"], [role="search"]')) return null;
  const extra = $$('button, [role="button"]', header).filter((b) => !/^back$/i.test(b.getAttribute('aria-label') ?? '') && b.getAttribute('aria-label') !== 'Verified account');
  if (extra.length) return null;
  const h = $('h2, [role="heading"]', header);
  if (!h) return null;
  const title = textOf(h);
  const block = h.closest('div')?.parentElement;
  const sub = block ? $$(':scope > *', block).filter((el) => !el.contains(h)).map(textOf).find(Boolean) : undefined;
  return title ? [title, sub] : null;
}

export function decorateChrome(route: XRoute, mirrorTabs: boolean): [string, string?] | null {
  const nav = findNavColumn();
  if (nav) set(nav, 'data-orbit-native-nav');
  const main = findMain();
  if (!main) return null;
  // Current client: the centred shell and the main/rail grid get Orbit's widths (see x.css).
  const grid = main.parentElement;
  if (grid && grid.tagName !== 'BODY' && getComputedStyle(grid).display === 'grid') set(grid, 'data-orbit-layout');
  for (let el: HTMLElement | null = grid; el && el !== document.body; el = el.parentElement) {
    if (/max-w-\[/.test(el.className && typeof el.className === 'string' ? el.className : '')) { set(el, 'data-orbit-shell'); break; }
  }
  // Once hidden, X's header has no size, so keep using the one already marked while it still holds the tabs.
  const markedHome = $('[data-orbit-native-header="home"]', main);
  const header = markedHome?.querySelector('[role="tablist"]') ? markedHome : findPageHeader(main);
  for (const h of $$('[data-orbit-native-header="home"]', main)) if (h !== header || !mirrorTabs || route.kind !== 'home') unset(h, 'data-orbit-native-header');
  if (header && mirrorTabs && route.kind === 'home') { set(header, 'data-orbit-native-header', 'home'); return null; }
  const marked = $('[data-orbit-native-header="title"]', main);
  const candidate = marked ?? $('[data-page-header]', main) ?? (header && !header.closest('article') ? header : null);
  const title = candidate && route.kind !== 'home' ? plainTitle(candidate) : null;
  for (const h of $$('[data-orbit-native-header="title"]', main)) if (h !== candidate || !title) unset(h, 'data-orbit-native-header');
  if (candidate && title) set(candidate, 'data-orbit-native-header', 'title');
  return title;
}

/** Docks X's sticky headers (page header, tab bars, rail) below Orbit's top bar. */
export function dockStickies(): void {
  const roots = [findMain(), findRail()].filter(Boolean) as HTMLElement[];
  for (const root of roots) {
    const candidates = new Set<HTMLElement>($$('[class*="sticky"], [data-top-chrome], [data-page-header]', root));
    // the older client sets position: sticky through generated classes; check the first few levels
    const walk = (el: Element, depth: number) => {
      for (const c of Array.from(el.children)) {
        if (depth < 6) { candidates.add(c as HTMLElement); walk(c, depth + 1); }
      }
    };
    walk(root, 0);
    for (const el of candidates) {
      if (el.hasAttribute('data-orbit-sticky') || el.closest('article')) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'sticky') continue;
      const top = parseFloat(cs.top) || 0;
      if (top < 0) continue; // bottom-anchored (tall rails): X manages these itself
      dockSticky(el, top);
    }
  }
}

/** Bookmarks: filter loaded posts by text or author. */
export function applyFilter(q: string): number {
  const main = findMain();
  if (!main) return 0;
  const t = q.trim().toLowerCase();
  let shown = 0;
  for (const cell of $$('[data-orbit-cell]', main)) {
    const hit = !t || textOf(cell).toLowerCase().includes(t);
    if (hit) { unset(cell, 'data-orbit-filtered'); shown++; } else set(cell, 'data-orbit-filtered');
  }
  return shown;
}

/* ---------- reading helpers (thread reader, lightbox) ---------- */

export interface ReadPost { author: string; name: string; avatar?: string; text: string; html: string; images: string[]; time?: string; permalink?: string }

function readPost(a: HTMLElement): ReadPost {
  const textEl = $(POST_TEXT, a);
  const nameEl = $('[data-testid="User-Name"] a, [data-post-avatar] ~ * a, a[href] [dir="auto"]', a);
  const avatar = $<HTMLImageElement>('[data-post-avatar] img, [data-testid="Tweet-User-Avatar"] img', a)?.src;
  const images = $$<HTMLImageElement>(MEDIA_IMG, a).filter((i) => !i.closest('[data-orbit-quote]')).map((i) => i.src);
  return {
    author: a.getAttribute('data-orbit-author') ?? authorOf(a) ?? '',
    name: textOf(nameEl ?? a).slice(0, 60),
    avatar,
    text: textEl?.textContent ?? '',
    html: textEl ? sanitizeInline(textEl) : '',
    images,
    time: $('time', a)?.getAttribute('datetime') ?? undefined,
    permalink: permalinkOf(a),
  };
}

/** Copies a post's text keeping only links and line breaks (safe to render in Orbit's reader). */
function sanitizeInline(el: Element): string {
  const out: string[] = [];
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) { out.push(esc(n.textContent ?? '').replace(/\n/g, '<br>')); return; }
    if (!(n instanceof HTMLElement)) return;
    if (n.tagName === 'IMG') { out.push(esc((n as HTMLImageElement).alt ?? '')); return; }
    if (n.tagName === 'BR') { out.push('<br>'); return; }
    if (n.tagName === 'A') {
      const href = (n as HTMLAnchorElement).href;
      if (/^https?:/.test(href)) { out.push(`<a href="${esc(href)}" data-native="${esc(n.getAttribute('href') ?? '')}">`); n.childNodes.forEach(walk); out.push('</a>'); return; }
    }
    n.childNodes.forEach(walk);
  };
  walk(el);
  return out.join('');
}

/** The author's thread around the post on screen (ancestors by the same author, the post, and self-replies). */
export function collectThread(): { posts: ReadPost[]; author?: string } {
  const main = findMain();
  if (!main) return { posts: [] };
  const all = $$<HTMLElement>('article[data-orbit-post]', main).filter((a) => !a.closest('[data-orbit-quote]'));
  const op = all.filter((a) => a.closest('[data-orbit-op]'));
  const list = op.length ? op : all.slice(0, 1);
  return { posts: list.map(readPost), author: list[0]?.getAttribute('data-orbit-author') ?? undefined };
}

/** Images of the post containing `el`, upgraded to large renditions. */
export function postImages(el: Element): { images: string[]; post?: ReadPost } {
  const a = el.closest<HTMLElement>('article');
  if (!a) return { images: [] };
  const inQuote = el.closest('[data-orbit-quote]');
  const scope = inQuote ?? a;
  const imgs = $$<HTMLImageElement>('img[src*="pbs.twimg.com/media/"]', scope).filter((i) => inQuote || !i.closest('[data-orbit-quote]'));
  return { images: imgs.map((i) => i.src), post: readPost(a) };
}
