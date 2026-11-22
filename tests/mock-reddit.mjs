// A deterministic fake reddit.com for end-to-end tests. Serves Reddit-shaped JSON for every
// endpoint Reddify uses, a stub "native" HTML page for everything else, and generated images.

const SUBS = {
  pics: { title: 'Pics', color: '#ff4500', desc: 'A place for photographs, pictures, and other images.', subs: 31200000 },
  programming: { title: 'programming', color: '#3e7bfa', desc: 'Computer programming discussion.', subs: 6700000 },
  design: { title: 'Design', color: '#b074ff', desc: 'Discussion of visual, product and interaction design.', subs: 2100000 },
  earthporn: { title: 'EarthPorn: Amazing images of light and landscape', color: '#2fc58a', desc: 'Pictures of the natural world.', subs: 23000000 },
  askreddit: { title: 'Ask Reddit...', color: '#4aa8ff', desc: 'r/AskReddit is the place to ask and answer thought-provoking questions.', subs: 49000000 },
  rust: { title: 'The Rust Programming Language', color: '#e0a526', desc: 'A place for all things related to the Rust programming language.', subs: 330000 },
};
const CANON = { pics: 'pics', programming: 'programming', design: 'Design', earthporn: 'EarthPorn', askreddit: 'AskReddit', rust: 'rust' };
const NOW = Math.floor(Date.now() / 1000);
const ME = 'reddify_tester';

const TITLES = [
  'Golden hour over the Dolomites, shot this morning after a 4am hike',
  'What is a small habit that genuinely improved your life?',
  'Show r/programming: I rewrote our build system and cut CI time from 22 to 4 minutes',
  'The quiet details of good interface design (a thread)',
  'Rust 1.90 released with async closures stabilized',
  'My grandmother’s kitchen, unchanged since 1974',
  'Why do so many apps feel slower today than 15 years ago?',
  'Fog rolling into the valley — Patagonia [OC] [4000x2667]',
  'TIL the original Macintosh had the signatures of the design team molded inside the case',
  'Designers: how do you handle feedback from stakeholders who “just don’t like it”?',
  'This tiny library replaced 3,000 lines of our date handling code',
  'Northern lights from my backyard in Tromsø last night',
];
const BODIES = [
  'I’ve been tracking this for a few months now and the results honestly surprised me. **Consistency** beat intensity every single time.\n\nCurious what everyone else has found works for them?',
  'Long-time lurker, first post. We had a monolithic Makefile that grew for **eight years**. Here’s what we learned:\n\n1. Cache everything\n2. Measure before optimizing\n3. Parallelize the boring parts\n\nHappy to answer questions in the comments.',
  'Not trying to start a flame war — genuinely curious. Hardware is orders of magnitude faster, yet typing in some apps has noticeable latency.',
];

function color(i) { return ['#ff7a45', '#5b8def', '#2fc58a', '#b074ff', '#e0a526', '#ff5c8a', '#22b8cf', '#7c83ff'][i % 8]; }
function img(id, w, h) { return { url: `https://i.redd.it/${id}.jpg?w=${w}&h=${h}`, width: w, height: h }; }
function preview(id, w, h) {
  const res = [108, 216, 320, 640, 960].filter((x) => x < w).map((x) => ({ url: `https://preview.redd.it/${id}.jpg?width=${x}&w=${x}&h=${Math.round((h * x) / w)}`, width: x, height: Math.round((h * x) / w) }));
  return { images: [{ source: { url: `https://preview.redd.it/${id}.jpg?w=${w}&h=${h}`, width: w, height: h }, resolutions: res, id }], enabled: true };
}

export function makePost(sub, i, extra = {}) {
  const id = `${sub.slice(0, 3)}${i.toString(36)}x`.toLowerCase();
  const kind = extra.kind ?? ['image', 'self', 'link', 'gallery', 'self', 'video', 'image', 'self'][i % 8];
  const title = extra.title ?? TITLES[(i + sub.length) % TITLES.length];
  const d = {
    id, name: `t3_${id}`, title, subreddit: sub, subreddit_name_prefixed: `r/${sub}`, author: ['mountain_light', 'quietcoder', 'pixelpusher', 'tidepool', 'ferris_fan', 'nightowl_42'][i % 6],
    created_utc: NOW - (i * 1700 + 300), score: Math.max(1, Math.round(48000 / (i + 1.3))) , upvote_ratio: 0.9 + (i % 9) / 100, num_comments: 40 + ((i * 37) % 2900),
    permalink: `/r/${sub}/comments/${id}/${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}/`,
    url: `https://www.reddit.com/r/${sub}/comments/${id}/`, domain: `self.${sub}`, is_self: false, likes: null, saved: false, over_18: false, spoiler: false, stickied: false,
    link_flair_text: i % 3 === 0 ? ['Discussion', 'OC', 'Release', 'Question'][i % 4] : null, link_flair_background_color: i % 3 === 0 ? color(i + 2) : '', link_flair_text_color: 'light', link_flair_richtext: [],
    thumbnail: 'self', total_awards_received: i % 4, sr_detail: { community_icon: `https://styles.redditmedia.com/icon_${sub}.png?w=64&h=64`, icon_img: '' },
    selftext: '', selftext_html: null,
  };
  if (kind === 'self') {
    const body = BODIES[i % BODIES.length];
    Object.assign(d, { is_self: true, url: `https://www.reddit.com${d.permalink}`, selftext: body, selftext_html: `<!-- SC_OFF --><div class="md"><p>${body.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n\n/g, '</p><p>').replace(/\n(\d)\. (.+)/g, '<br>$1. $2')}</p><p>Spoiler: <span class="md-spoiler-text">the answer was sleep</span>. <a href="/r/${sub}">r/${sub}</a> <a href="https://example.com/article">source</a></p></div><!-- SC_ON -->` });
  } else if (kind === 'image') {
    const [w, h] = i % 2 ? [1600, 1067] : [1080, 1350];
    Object.assign(d, { post_hint: 'image', url: img(id, w, h).url, domain: 'i.redd.it', preview: preview(id, w, h), thumbnail: `https://b.thumbs.redditmedia.com/${id}.jpg?w=140&h=100` });
  } else if (kind === 'gallery') {
    const ids = [0, 1, 2, 3, 4].map((k) => `${id}g${k}`);
    Object.assign(d, {
      is_gallery: true, url: `https://www.reddit.com/gallery/${id}`, domain: 'reddit.com',
      gallery_data: { items: ids.map((m, k) => ({ media_id: m, id: k, caption: k === 0 ? 'First light' : undefined })) },
      media_metadata: Object.fromEntries(ids.map((m, k) => [m, { status: 'valid', e: 'Image', m: 'image/jpg', s: { u: `https://preview.redd.it/${m}.jpg?w=1400&h=${1000 + k * 60}`, x: 1400, y: 1000 + k * 60 }, p: [{ u: `https://preview.redd.it/${m}.jpg?width=640&w=640&h=${Math.round((640 * (1000 + k * 60)) / 1400)}`, x: 640, y: Math.round((640 * (1000 + k * 60)) / 1400) }] }])),
    });
  } else if (kind === 'link') {
    Object.assign(d, { post_hint: 'link', url: 'https://example.com/articles/interfaces-that-feel-fast', domain: 'example.com', preview: preview(id, 1200, 630), thumbnail: `https://b.thumbs.redditmedia.com/${id}.jpg?w=140&h=74` });
  } else if (kind === 'video') {
    Object.assign(d, {
      post_hint: 'hosted:video', is_video: true, url: `https://v.redd.it/${id}`, domain: 'v.redd.it', preview: preview(id, 1280, 720),
      secure_media: { reddit_video: { fallback_url: `https://v.redd.it/${id}/DASH_720.mp4?source=fallback`, width: 1280, height: 720, duration: 42, is_gif: false, has_audio: true, hls_url: '' } },
    });
  }
  return { kind: 't3', data: { ...d, ...extra.data } };
}

function feed(sub, count = 25, offset = 0) {
  const list = [];
  for (let i = offset; i < offset + count; i++) {
    const s = sub ? (CANON[sub.toLowerCase()] ?? sub) : Object.values(CANON)[i % 6];
    list.push(makePost(s, i));
  }
  sub = sub ? (CANON[sub.toLowerCase()] ?? sub) : sub;
  if (offset === 0) {
    list[1] = makePost(sub ?? 'pics', 1001, { kind: 'image', title: 'Sponsored: Try our amazing product', data: { promoted: true, author: 'brand_account' } });
    list[4] = makePost(sub ?? 'pics', 1004, { kind: 'image', title: 'Beautiful but NSFW-tagged painting', data: { over_18: true } });
    list[6] = makePost(sub ?? 'design', 1006, { kind: 'self', title: 'Spoiler-tagged discussion about the finale', data: { spoiler: true } });
    if (sub) list[0] = makePost(sub, 1000, { kind: 'self', title: `Welcome to r/${sub} — please read the rules`, data: { stickied: true, distinguished: 'moderator', author: 'AutoModerator' } });
  }
  return list;
}

function listing(children, after) { return { kind: 'Listing', data: { after, before: null, children } }; }

function comment(id, depth, i, replies = []) {
  const bodies = ['This is exactly what I needed today. Thank you for writing it up so clearly.', 'Counterpoint: measuring is often the hard part. What tooling did you use?', 'I tried something similar last year — the biggest win was caching the dependency graph.\n\n> quote from the post\n\nAgreed with this part especially.', 'Underrated comment right here.', 'Do you have a link to the source? Would love to read more.', '`git bisect` saved me more times than I can count.'];
  const body = bodies[(i + depth) % bodies.length];
  return {
    kind: 't1', data: {
      id, name: `t1_${id}`, author: depth === 1 && i === 0 ? 'tidepool' : ['ada_l', 'grace_h', 'linus_t', 'margaret_h', 'ken_t', 'barbara_l'][(i + depth) % 6],
      body, body_html: `<div class="md"><p>${body.replace(/\n\n> (.+)\n\n/, '</p><blockquote><p>$1</p></blockquote><p>').replace(/`(.+?)`/g, '<code>$1</code>')}</p></div>`,
      created_utc: NOW - 600 * (i + 1) - depth * 100, score: Math.max(1, 900 - i * 120 - depth * 40), depth, parent_id: 't3_x', permalink: `/r/programming/comments/abc/x/${id}/`,
      likes: null, saved: false, stickied: false, score_hidden: false, controversiality: 0, total_awards_received: 0, collapsed: false,
      author_flair_text: i === 1 && depth === 0 ? 'Senior Engineer' : null, author_flair_richtext: [], replies: replies.length ? listing(replies, null) : '',
    },
  };
}

function thread(post) {
  const tree = [];
  for (let i = 0; i < 8; i++) {
    const id = `c${i}`;
    const kids = i < 4 ? [comment(`${id}a`, 1, i, [comment(`${id}a1`, 2, i, i === 0 ? [comment(`${id}a1x`, 3, i, [comment(`${id}deep`, 4, i)])] : [])]), comment(`${id}b`, 1, i + 1)] : [];
    if (i === 1) kids.push({ kind: 'more', data: { id: 'more1', name: 't1_more1', parent_id: `t1_${id}`, children: ['m1', 'm2', 'm3'], count: 3, depth: 1 } });
    tree.push(comment(id, 0, i, kids));
  }
  tree.push({ kind: 'more', data: { id: 'moretop', name: 't1_moretop', parent_id: post.data.name, children: ['m10', 'm11'], count: 14, depth: 0 } });
  return [listing([post], null), listing(tree, null)];
}

function about(name) {
  const s = SUBS[name.toLowerCase()] ?? { title: name, color: '#7c83ff', desc: `The r/${name} community.`, subs: 12345 };
  return {
    kind: 't5', data: {
      display_name: CANON[name.toLowerCase()] ?? name, display_name_prefixed: `r/${CANON[name.toLowerCase()] ?? name}`, name: `t5_${name.toLowerCase()}`, title: s.title,
      community_icon: `https://styles.redditmedia.com/icon_${name}.png?w=256&h=256`, banner_background_image: name.toLowerCase() === 'earthporn' ? `https://styles.redditmedia.com/banner_${name}.png?w=1600&h=300` : '',
      primary_color: s.color, subscribers: s.subs, accounts_active: Math.round(s.subs / 900), public_description: s.desc,
      public_description_html: `<div class="md"><p>${s.desc}</p></div>`, created_utc: 1201234567, over18: false, user_is_subscriber: name.toLowerCase() === 'programming', subreddit_type: 'public',
    },
  };
}

function svgImage(url) {
  const u = new URL(url);
  const w = Number(u.searchParams.get('w')) || 640;
  const h = Number(u.searchParams.get('h')) || 480;
  let hash = 0;
  for (const ch of u.pathname) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  if (u.pathname.includes('icon_')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue},62%,52%)"/><circle cx="32" cy="27" r="11" fill="rgba(255,255,255,.9)"/><rect x="16" y="42" width="32" height="8" rx="4" fill="rgba(255,255,255,.7)"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},55%,62%)"/><stop offset=".6" stop-color="hsl(${(hue + 30) % 360},45%,38%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},40%,18%)"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#a)"/>
    <circle cx="${w * 0.72}" cy="${h * 0.3}" r="${Math.min(w, h) * 0.09}" fill="hsla(${(hue + 180) % 360},90%,85%,.85)"/>
    <path d="M0 ${h * 0.75} L${w * 0.22} ${h * 0.5} L${w * 0.38} ${h * 0.64} L${w * 0.6} ${h * 0.42} L${w} ${h * 0.7} L${w} ${h} L0 ${h}Z" fill="hsla(${(hue + 40) % 360},35%,14%,.75)"/>
    <path d="M0 ${h * 0.85} L${w * 0.3} ${h * 0.68} L${w * 0.55} ${h * 0.8} L${w * 0.8} ${h * 0.66} L${w} ${h * 0.8} L${w} ${h} L0 ${h}Z" fill="hsla(${(hue + 60) % 360},30%,8%,.9)"/>
  </svg>`;
}

const NATIVE_HTML = `<!doctype html><html><head><title>Reddit - The heart of the internet</title><style>/* like reddit.com: hide custom elements until defined */ :not(:defined):not(shreddit-app) { visibility: hidden; }</style></head>
<body style="margin:0;font-family:sans-serif;background:#fff"><shreddit-app id="native-reddit"><h1 style="padding:20px">Native Reddit page</h1><p style="padding:0 20px">This stands in for Reddit's own UI.</p></shreddit-app></body></html>`;

/** Installs the fake Reddit on a Playwright BrowserContext. `log` collects write actions (votes, saves…). */
export async function installMock(context, log = []) {
  let state = { inbox: 2 };
  await context.route(/^https:\/\/(i\.redd\.it|preview\.redd\.it|styles\.redditmedia\.com|b\.thumbs\.redditmedia\.com|external-preview\.redd\.it)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svgImage(route.request().url()) }));
  await context.route(/^https:\/\/v\.redd\.it\//, (route) => route.fulfill({ status: 404, body: '' }));
  await context.route(/^https:\/\/example\.com\//, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>example</h1>' }));
  await context.route(/^https:\/\/(www\.)?reddit\.com\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname.replace(/\/+$/, '') || '/';
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const after = u.searchParams.get('after');
    const offset = after ? Number(after.split('_')[1]) : 0;
    const page = (sub) => listing(feed(sub, 25, offset), offset < 75 ? `t3_${offset + 25}` : null);

    if (req.method() === 'POST') {
      const form = Object.fromEntries(new URLSearchParams(req.postData() ?? ''));
      log.push({ path: p, form, headers: req.headers() });
      if (p === '/api/comment') return json({ json: { errors: [], data: { things: [{ kind: 't1', data: { ...comment('new1', 0, 0).data, author: ME, body: form.text, body_html: `<div class="md"><p>${form.text}</p></div>` } }] } } });
      if (p === '/api/read_all_messages') state.inbox = 0;
      return json({});
    }
    if (!p.endsWith('.json')) return route.fulfill({ status: 200, contentType: 'text/html', headers: { 'content-security-policy': "require-trusted-types-for 'script'" }, body: NATIVE_HTML });

    const q = p.replace(/\.json$/, '');
    // Simulate Reddit's script blocking: page requests to r/blockedsub get a 403 HTML page.
    if (/^\/r\/sortblocked\/(hot|new|top|rising)$/i.test(q)) return route.fulfill({ status: 403, contentType: 'text/html', body: '<h1>blocked</h1>' });
    if (/^\/r\/deadsub\b/i.test(q)) return route.fulfill({ status: 403, contentType: 'text/html', body: '<h1>whoa there, pardner!</h1>' });
    if (/^\/r\/blockedsub\b/i.test(q) && u.searchParams.has('sr_detail')) return route.fulfill({ status: 403, contentType: 'text/html', body: '<h1>whoa there, pardner!</h1>' });
    let m;
    if (q === '/api/me') return json({ kind: 't2', data: { name: ME, modhash: 'test-modhash', inbox_count: state.inbox, icon_img: 'https://styles.redditmedia.com/icon_me.png?w=64&h=64', link_karma: 12840, comment_karma: 40211 } });
    if (q === '/subreddits/mine/subscriber') return json(listing(['programming', 'Design', 'rust', 'EarthPorn'].map((n) => about(n)), null));
    if (q === '/api/subreddit_autocomplete_v2') {
      const t = (u.searchParams.get('query') ?? '').toLowerCase();
      return json(listing(Object.keys(SUBS).filter((s) => s.includes(t)).map((s) => about(s)), null));
    }
    if (q === '/api/morechildren') {
      const ids = (u.searchParams.get('children') ?? '').split(',');
      return json({ json: { errors: [], data: { things: ids.map((id, k) => ({ ...comment(id, 1, k + 2), data: { ...comment(id, 1, k + 2).data, replies: '', parent_id: 't1_c1' } })) } } });
    }
    if ((m = /^\/(best|hot|new|top|rising)$/.exec(q)) || q === '') return json(page(null));
    if ((m = /^\/r\/(popular|all)(?:\/(\w+))?$/i.exec(q))) return json(page(null));
    if ((m = /^\/r\/([\w]+)\/about\/rules$/.exec(q))) return json({ rules: [{ short_name: 'Be civil', description_html: '<div class="md"><p>Treat others with respect.</p></div>' }, { short_name: 'Stay on topic', description_html: '<div class="md"><p>Posts must relate to the community.</p></div>' }, { short_name: 'No spam or self-promotion', description_html: '' }] });
    if ((m = /^\/r\/([\w]+)\/about$/.exec(q))) {
      if (m[1].toLowerCase() === 'secretclub') return json({ reason: 'private', message: 'Forbidden', error: 403 }, 403);
      return json(about(m[1]));
    }
    if ((m = /^\/r\/([\w]+)\/comments\/(\w+)/.exec(q))) {
      const idx = 3;
      m[1] = CANON[m[1].toLowerCase()] ?? m[1];
      return json(thread(makePost(m[1], idx, { kind: 'self', data: { id: m[2], name: `t3_${m[2]}`, permalink: `/r/${m[1]}/comments/${m[2]}/post/` } })));
    }
    if ((m = /^\/r\/([\w+]+)\/search$/.exec(q)) || q === '/search') {
      if (u.searchParams.get('q') === 'nothing') return json(listing([], null));
      return json(listing(feed(m ? m[1] : null, 10, 0).slice(2), null));
    }
    if ((m = /^\/r\/([\w+]+)(?:\/(\w+))?$/.exec(q))) {
      if (m[1].toLowerCase() === 'secretclub') return json({ reason: 'private', message: 'Forbidden', error: 403 }, 403);
      return json(page(m[1].includes('+') ? null : m[1]));
    }
    if (q === '/subreddits/search') return json(listing(Object.keys(SUBS).map((s) => about(s)), null));
    if (q === '/users/search') return json(listing([{ kind: 't2', data: { name: 'quietcoder', link_karma: 1200, comment_karma: 8000, icon_img: '' } }], null));
    if ((m = /^\/user\/([\w-]+)\/about$/.exec(q))) return json({ kind: 't2', data: { name: m[1], link_karma: 5120, comment_karma: 22050, created_utc: 1400000000, icon_img: `https://styles.redditmedia.com/icon_${m[1]}.png?w=128&h=128`, subreddit: { public_description: 'Builder of small, fast things.' } } });
    if ((m = /^\/user\/([\w-]+)(?:\/(\w+))?$/.exec(q))) {
      const tab = m[2] ?? 'overview';
      const items = tab === 'comments' ? [0, 1, 2].map((i) => ({ kind: 't1', data: { ...comment(`uc${i}`, 0, i).data, subreddit: 'programming', link_title: TITLES[i] } }))
        : feed(null, 12, 0).filter((x) => !x.data.promoted).map((x, i) => (i % 3 === 2 && tab === 'overview' ? { kind: 't1', data: { ...comment(`uo${i}`, 0, i).data, subreddit: 'Design', link_title: TITLES[i] } } : x));
      if (tab === 'saved') items.forEach((x) => { x.data.saved = true; });
      return json(listing(items, null));
    }
    if ((m = /^\/message\/(inbox|unread|sent)$/.exec(q))) {
      const msgs = [
        { kind: 't1', data: { name: 't1_r1', author: 'grace_h', link_title: 'Show r/programming: I rewrote our build system', body_html: '<div class="md"><p>This is brilliant — did you consider remote caching?</p></div>', created_utc: NOW - 400, new: state.inbox > 0, context: '/r/programming/comments/abc/x/r1/?context=3', subreddit: 'programming' } },
        { kind: 't4', data: { name: 't4_m1', author: 'mountain_light', subject: 'Photo licensing question', body_html: '<div class="md"><p>Hi! Could I use your photo in a blog post?</p></div>', created_utc: NOW - 9000, new: state.inbox > 1 } },
      ];
      return json(listing(m[1] === 'unread' ? msgs.filter((x) => x.data.new) : msgs, null));
    }
    return json({ message: 'Not Found', error: 404 }, 404);
  });
}
