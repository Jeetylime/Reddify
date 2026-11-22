import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './options.css';
import { ACCENT_PRESETS, DEFAULT_LOCAL, DEFAULT_SETTINGS, SECTION_LABELS, loadSettings, mergeSettings, onSettingsChanged, reducedMotion, resolveTheme, saveLocal, saveSettings, themeVars } from '@core/settings';
import { DEFAULT_YOUTUBE } from '@core/settings';
import type { Density, FontChoice, HideOptions, Layout, Motion, SectionId, Settings, Theme, XDefaultFeed, XMediaSize, XPostStyle, XSettings, YTComments, YTGrid, YTRecs, YTShorts, YTThumb, YTWatchWidth, YouTubeSettings } from '@core/settings';
import { SHORTCUTS, X_SHORTCUTS, YT_SHORTCUTS } from '@core/shortcuts';
import { Icon, Logo, PlatformIcon } from '@core/Icon';
import type { IconName } from '@core/Icon';

type NavEntry = [string, string, IconName | 'reddit' | 'x' | 'youtube'];
const SECTIONS: [string, NavEntry[]][] = [
  ['Orbit', [['general', 'General', 'layers'], ['appearance', 'Appearance', 'sun'], ['layout', 'Layout', 'sidebar'], ['behavior', 'Behavior', 'zap'], ['keyboard', 'Keyboard', 'keyboard']]],
  ['Reddit', [['reddit', 'Feed & reading', 'reddit'], ['content', 'Content', 'filter'], ['navigation', 'Sidebar', 'sidebar'], ['filters', 'Filters', 'eye-off'], ['interface', 'Interface elements', 'eye']]],
  ['X', [['x', 'Timeline', 'x'], ['x-hide', 'Hide elements', 'eye-off']]],
  ['YouTube', [['youtube', 'Feed & watch page', 'youtube'], ['yt-hide', 'Hide elements', 'eye-off']]],
  ['More', [['data', 'Data & privacy', 'lock'], ['about', 'About', 'info']]],
];

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}
function Row({ title, desc, children, col }: { title: string; desc?: string; children: ReactNode; col?: boolean }) {
  return <div className={`row ${col ? 'col' : ''}`}><div className="lbl"><b>{title}</b>{desc && <small>{desc}</small>}</div><div className="ctl">{children}</div></div>;
}
function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div className="seg" role="radiogroup">{options.map(([v, l]) => <button key={v} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
function Range({ value, min, max, step = 1, unit = '', onChange }: { value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return <div className="range"><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /><output>{value}{unit}</output></div>;
}
function Group({ id, title, desc, children }: { id: string; title: string; desc?: string; children: ReactNode }) {
  return <section className="group" id={id}><h2>{title}</h2>{desc && <p className="desc">{desc}</p>}<div className="panel">{children}</div></section>;
}

function TagList({ items, onChange, placeholder, prefix = '' }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; prefix?: string }) {
  const [v, setV] = useState('');
  const add = () => {
    const t = v.trim().replace(/^\/?r\//i, '');
    if (t && !items.some((i) => i.toLowerCase() === t.toLowerCase())) onChange([...items, t]);
    setV('');
  };
  return (
    <>
      <div className="addrow"><input type="text" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /><button className="btn" onClick={add}><Icon name="plus" size={15} />Add</button></div>
      {items.length > 0 && <div className="tags">{items.map((i) => <span className="tagx" key={i}>{prefix}{i}<button aria-label={`Remove ${i}`} onClick={() => onChange(items.filter((x) => x !== i))}><Icon name="x" size={12} /></button></span>)}</div>}
    </>
  );
}

function Options() {
  const [s, setS] = useState<Settings | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [active, setActive] = useState('appearance');
  const fileRef = useRef<HTMLInputElement>(null);
  const [qlLabel, setQlLabel] = useState('');
  const [qlUrl, setQlUrl] = useState('');

  useEffect(() => { void loadSettings().then(setS); return onSettingsChanged(setS); }, []);
  useEffect(() => {
    const io = new IntersectionObserver((es) => { const v = es.find((e) => e.isIntersecting); if (v) setActive(v.target.id); }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('section.group').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [s === null]);
  useEffect(() => { if (s) document.body.classList.toggle('light', resolveTheme(s.theme) === 'light'); }, [s?.theme]);
  // Deep links (options.html#x) arrive before the page has rendered; scroll once it has.
  useEffect(() => { if (s && location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView(); }, [s === null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return null;
  const set = (patch: Partial<Settings>) => {
    const next = mergeSettings({ ...s, ...patch });
    setS(next);
    void saveSettings(next).then(() => setSavedTick((t) => t + 1));
  };
  const setHide = (k: keyof HideOptions, v: boolean) => set({ hide: { ...s.hide, [k]: v } });
  const setX = (patch: Partial<XSettings>) => set({ x: { ...s.x, ...patch } });
  const setYT = (patch: Partial<YouTubeSettings>) => set({ youtube: { ...s.youtube, ...patch } });
  const moveSection = (id: SectionId, d: -1 | 1) => { const o = [...s.navOrder]; const i = o.indexOf(id); const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; set({ navOrder: o }); };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'orbit-settings.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async (f: File) => {
    try { set(mergeSettings(JSON.parse(await f.text()))); alert('Settings imported.'); }
    catch { alert('That file isn’t a valid Orbit settings export.'); }
  };

  const theme = resolveTheme(s.theme);
  return (
    <div className={`root ${reducedMotion(s) ? 'no-motion' : ''}`} data-theme={theme} style={themeVars(s) as React.CSSProperties}>
      <div className="layout">
        <nav className="nav" aria-label="Settings sections">
          <div className="brand"><Logo size={34} /><div><b>Orbit</b><span>Reddit · X · YouTube</span></div></div>
          {SECTIONS.map(([group, items]) => (
            <div className="nav-group" key={group}>
              <div className="nav-h">{group}</div>
              {items.map(([id, label, icon]) => (
                <a key={id} href={`#${id}`} className={active === id ? 'on' : ''}>
                  {icon === 'reddit' || icon === 'x' || icon === 'youtube' ? <PlatformIcon id={icon} size={16} /> : <Icon name={icon} size={16} />}{label}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <main className="content">
          <header>
            <h1>Settings</h1>
            <span className={`saved-pill ${savedTick ? 'show' : ''}`} key={savedTick}><Icon name="check" size={14} />Saved · applies instantly to open tabs</span>
          </header>
          <Group id="general" title="General" desc="Orbit is one client for Reddit, X and YouTube. Turn it off everywhere, or per platform.">
            <Row title="Enable Orbit" desc="Turn off to use the original sites everywhere. Switch a single tab with Alt+Shift+O."><Switch label="Enable Orbit" on={s.enabled} onChange={(v) => set({ enabled: v })} /></Row>
            {([['reddit', 'Orbit on Reddit', 'reddit.com and www.reddit.com', 'Reddit'], ['x', 'Orbit on X / Twitter', 'x.com and twitter.com', 'X'], ['youtube', 'Orbit on YouTube', 'youtube.com (m.youtube.com gets the theme only)', 'YouTube']] as const).map(([p, title, desc, name]) => (
              <Row key={p} title={title} desc={desc}>
                <span className="plat"><PlatformIcon id={p} size={22} /></span>
                <Switch label={`Orbit on ${name}`} on={s.platforms[p]} onChange={(v) => set({ platforms: { ...s.platforms, [p]: v } })} />
              </Row>
            ))}
          </Group>

          <Group id="appearance" title="Appearance" desc="Shared by Reddit, X and YouTube — change it once, all three follow.">
            <Row title="Theme"><Seg<Theme> value={s.theme} options={[['dark', 'Dark'], ['light', 'Light'], ['system', 'System']]} onChange={(v) => set({ theme: v })} /></Row>
            <Row title="Accent color" desc="Used sparingly for selection, links, focus and primary actions.">
              <div className="swatches">
                {ACCENT_PRESETS.map((p) => <button key={p.value} className={`sw ${s.accent.toLowerCase() === p.value ? 'on' : ''}`} style={{ background: p.value }} title={p.name} aria-label={p.name} onClick={() => set({ accent: p.value })} />)}
                <label className="sw-custom" title="Custom color" style={ACCENT_PRESETS.some((p) => p.value === s.accent.toLowerCase()) ? undefined : { background: s.accent, borderStyle: 'solid' }}><input type="color" value={s.accent} onChange={(e) => set({ accent: e.target.value })} aria-label="Custom accent color" /></label>
              </div>
            </Row>
            <Row title="Typeface" desc="Rounded changes the whole interface; Serif is a reading face for post text only."><Seg<FontChoice> value={s.font} options={[['system', 'System'], ['rounded', 'Rounded'], ['serif', 'Serif reading']]} onChange={(v) => set({ font: v })} /></Row>
            <Row title="Text size" desc="Posts, comments and timelines."><Range value={s.fontSize} min={12} max={19} step={0.5} unit="px" onChange={(v) => set({ fontSize: v })} /></Row>
            <Row title="Line spacing"><Range value={s.lineHeight} min={1.3} max={1.9} step={0.05} onChange={(v) => set({ lineHeight: Math.round(v * 100) / 100 })} /></Row>
            <Row title="Animations" desc="System follows your operating system’s reduced-motion setting."><Seg<Motion> value={s.motion} options={[['system', 'System'], ['full', 'Full'], ['reduced', 'Reduced']]} onChange={(v) => set({ motion: v })} /></Row>
            <Row title="Preview" col>
              <div className="previews">
                <div className="preview">
                  <div className="v"><span className="up">▲</span>2.4k<span>▼</span></div>
                  <div>
                    <div className="meta"><PlatformIcon id="reddit" size={14} /> <b>r/design</b> · u/someone · 3h</div>
                    <h3>The details are not the details. They make the design.</h3>
                    <p>Orbit uses your font size, line height and density settings for posts and comments on every platform.</p>
                    <div className="acts"><span>148 comments</span><span>Share</span><span>Save</span></div>
                  </div>
                </div>
                <div className="preview xp">
                  <span className="xp-av">O</span>
                  <div>
                    <div className="meta"><b>Orbit</b> @orbit · 2m <span className="xp-plat"><PlatformIcon id="x" size={14} /></span></div>
                    <p className="xp-text">One design language, two platforms. Same type, same spacing, same accent — wherever you scroll.</p>
                    <div className="acts xp-acts"><span>↩ 24</span><span>⟲ 112</span><span className="like">♥ 1.8K</span><span>⌑</span></div>
                  </div>
                </div>
              </div>
            </Row>
          </Group>

          <Group id="layout" title="Layout" desc="Shared sizing for the sidebar and reading column.">
            <Row title="Sidebar"><Seg value={s.sidebarMode} options={[['expanded', 'Expanded'], ['compact', 'Icons only']]} onChange={(v) => set({ sidebarMode: v })} /></Row>
            <Row title="Sidebar width" desc="Width of the expanded sidebar."><Range value={s.sidebarWidth} min={200} max={320} step={4} unit="px" onChange={(v) => set({ sidebarWidth: v })} /></Row>
            <Row title="Content width" desc="Maximum width of the Reddit feed and the X timeline (X caps it at 860px). YouTube has its own watch-page width."><Range value={s.contentWidth} min={600} max={1100} step={20} unit="px" onChange={(v) => set({ contentWidth: v })} /></Row>
            <Row title="Density" desc="Spacing between posts, videos and navigation items on every platform."><Seg<Density> value={s.density} options={[['cozy', 'Cozy'], ['regular', 'Regular'], ['tight', 'Tight']]} onChange={(v) => set({ density: v })} /></Row>
          </Group>

          <Group id="behavior" title="Behavior">
            <Row title="Remember where you were" desc="Switching platforms from the Orbit menu resumes the page you last had open there."><Switch label="Remember interface state" on={s.rememberState} onChange={(v) => set({ rememberState: v })} /></Row>
            <Row title="Keyboard shortcuts" desc="Orbit’s shortcuts on both platforms. Ctrl/⌘+K always opens the palette."><Switch label="Keyboard shortcuts" on={s.keyboard} onChange={(v) => set({ keyboard: v })} /></Row>
            <Row title="Open external links in a new tab"><Switch label="External links in new tab" on={s.externalInNewTab} onChange={(v) => set({ externalInNewTab: v })} /></Row>
          </Group>

          <Group id="keyboard" title="Keyboard">
            <div className="keys-grid">
              <h4 className="plat-h"><PlatformIcon id="reddit" size={16} /> Reddit</h4>
              {SHORTCUTS.map(([g, items]) => (
                <div key={g} style={{ display: 'contents' }}>
                  <h4>{g}</h4>
                  {items.map(([l, keys]) => <div className="kr" key={l}><span>{l}</span><span>{keys.map((k, i) => <kbd className="kbd" key={i}>{k}</kbd>)}</span></div>)}
                </div>
              ))}
              <h4 className="plat-h"><PlatformIcon id="youtube" size={16} /> YouTube</h4>
              {YT_SHORTCUTS.map(([g, items]) => (
                <div key={`yt-${g}`} style={{ display: 'contents' }}>
                  <h4>{g}</h4>
                  {items.map(([l, keys]) => <div className="kr" key={l}><span>{l}</span><span>{keys.map((k, i) => <kbd className="kbd" key={i}>{k}</kbd>)}</span></div>)}
                </div>
              ))}
              <h4 className="plat-h"><PlatformIcon id="x" size={16} /> X</h4>
              {X_SHORTCUTS.map(([g, items]) => (
                <div key={`x-${g}`} style={{ display: 'contents' }}>
                  <h4>{g}</h4>
                  {items.map(([l, keys]) => <div className="kr" key={l}><span>{l}</span><span>{keys.map((k, i) => <kbd className="kbd" key={i}>{k}</kbd>)}</span></div>)}
                </div>
              ))}
            </div>
          </Group>

          <Group id="reddit" title="Reddit · Feed & reading" desc="Only affects Reddit.">
            <Row title="Default feed layout" desc="Switch any time from the top bar or with keys 1–4."><Seg<Layout> value={s.layout} options={[['comfortable', 'Comfortable'], ['compact', 'Compact'], ['gallery', 'Gallery'], ['minimal', 'Minimal']]} onChange={(v) => set({ layout: v })} /></Row>
            <Row title="Reading mode" desc="Hides the right panel, widens type and calms the chrome for long reads."><Switch label="Reading mode" on={s.readingMode} onChange={(v) => set({ readingMode: v })} /></Row>
            <Row title="Compact media previews" desc="Smaller images and videos in feeds."><Switch label="Compact media" on={s.compactMedia} onChange={(v) => set({ compactMedia: v })} /></Row>
          </Group>

          <Group id="content" title="Reddit · Content">
            <Row title="Hide promoted posts" desc="Removes anything Reddit marks as promoted or an ad. (X has its own switch.)"><Switch label="Hide promoted" on={s.hidePromoted} onChange={(v) => set({ hidePromoted: v })} /></Row>
            <Row title="Blur NSFW media"><Switch label="Blur NSFW" on={s.blurNsfw} onChange={(v) => set({ blurNsfw: v })} /></Row>
            <Row title="Blur spoilers"><Switch label="Blur spoilers" on={s.blurSpoilers} onChange={(v) => set({ blurSpoilers: v })} /></Row>
            <Row title="Dim posts you’ve opened"><Switch label="Dim visited" on={s.dimVisited} onChange={(v) => set({ dimVisited: v })} /></Row>
            <Row title="Hide crossposts"><Switch label="Hide crossposts" on={s.hideCrossposts} onChange={(v) => set({ hideCrossposts: v })} /></Row>
            <Row title="Autoplay videos" desc="Muted, only while on screen. GIFs always loop."><Switch label="Autoplay" on={s.autoplayVideo} onChange={(v) => set({ autoplayVideo: v })} /></Row>
            <Row title="Open external links in a new tab"><Switch label="External links in new tab" on={s.externalInNewTab} onChange={(v) => set({ externalInNewTab: v })} /></Row>
            <Row title="Default comment sort">
              <select value={s.defaultCommentSort} onChange={(e) => set({ defaultCommentSort: e.target.value })}>
                {[['confidence', 'Best'], ['top', 'Top'], ['new', 'New'], ['controversial', 'Controversial'], ['old', 'Old'], ['qa', 'Q&A']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Row>
            <Row title="Auto-collapse replies" desc="Collapse threads deeper than this level when a post opens.">
              <select value={s.autoCollapseDepth} onChange={(e) => set({ autoCollapseDepth: Number(e.target.value) })}>
                <option value={0}>Never</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Level {n}</option>)}
              </select>
            </Row>
            <Row title="Unread badge on toolbar icon" desc="Checks your inbox count every few minutes using your Reddit session."><Switch label="Unread badge" on={s.badge} onChange={(v) => set({ badge: v })} /></Row>
          </Group>

          <Group id="navigation" title="Reddit · Sidebar" desc="Reorder or hide sidebar sections. You can also do this in-app with the pencil button at the bottom of the sidebar.">
            <div className="row col">
              <div className="list-edit">
                {s.navOrder.map((id, i) => {
                  const off = s.navHidden.includes(id);
                  return (
                    <div className="li" key={id}>
                      <span className={`name ${off ? 'off' : ''}`}>{SECTION_LABELS[id]}</span>
                      <button className="ib" disabled={i === 0} onClick={() => moveSection(id, -1)} aria-label="Move up"><Icon name="chev-up" size={15} /></button>
                      <button className="ib" disabled={i === s.navOrder.length - 1} onClick={() => moveSection(id, 1)} aria-label="Move down"><Icon name="chev-down" size={15} /></button>
                      <button className="ib" onClick={() => set({ navHidden: off ? s.navHidden.filter((x) => x !== id) : [...s.navHidden, id] })} aria-label={off ? 'Show' : 'Hide'}><Icon name={off ? 'eye-off' : 'eye'} size={15} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
            <Row title="Pinned communities" col><TagList items={s.pinnedSubs} prefix="r/" placeholder="Add a community, e.g. r/design" onChange={(v) => set({ pinnedSubs: v })} /></Row>
            <Row title="Quick access links" desc="Any Reddit page — a multireddit, a search, a profile." col>
              <div className="addrow">
                <input type="text" placeholder="Label" value={qlLabel} onChange={(e) => setQlLabel(e.target.value)} style={{ maxWidth: 180 }} />
                <input type="url" placeholder="/r/rust/top?t=week" value={qlUrl} onChange={(e) => setQlUrl(e.target.value)} />
                <button className="btn" onClick={() => {
                  const raw = qlUrl.trim();
                  if (!raw) return;
                  let path = raw;
                  try { const u = new URL(raw, 'https://www.reddit.com'); if (!/(^|\.)reddit\.com$/.test(u.hostname)) { alert('Quick access links must point to reddit.com'); return; } path = u.pathname + u.search; } catch { return; }
                  set({ quickLinks: [...s.quickLinks, { id: Date.now().toString(36), label: qlLabel.trim() || path, url: path }] });
                  setQlLabel(''); setQlUrl('');
                }}><Icon name="plus" size={15} />Add</button>
              </div>
              {s.quickLinks.length > 0 && <div className="list-edit">{s.quickLinks.map((q) => (
                <div className="li" key={q.id}><Icon name="star" size={15} /><span className="name">{q.label} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>{q.url}</span></span><button className="ib" onClick={() => set({ quickLinks: s.quickLinks.filter((x) => x.id !== q.id) })} aria-label="Remove"><Icon name="trash" size={15} /></button></div>
              ))}</div>}
            </Row>
          </Group>

          <Group id="filters" title="Reddit · Filters" desc="Applied to Home, Popular, All and multireddits. A community’s own page always shows everything.">
            <Row title="Muted communities" col><TagList items={s.mutedSubs} prefix="r/" placeholder="r/community" onChange={(v) => set({ mutedSubs: v })} /></Row>
            <Row title="Muted keywords" desc="Posts whose titles contain any of these words are hidden (case-insensitive)." col><TagList items={s.mutedKeywords} placeholder="keyword or phrase" onChange={(v) => set({ mutedKeywords: v })} /></Row>
          </Group>

          <Group id="interface" title="Reddit · Interface elements" desc="Hide things you don’t need.">
            {([
              ['voteScore', 'Vote counts in feeds', 'Judge posts on their own merit.'],
              ['flairs', 'Post & user flairs', ''],
              ['subIcons', 'Community icons in feeds', ''],
              ['domain', 'Link domains', ''],
              ['awards', 'Award counts', ''],
              ['layoutSwitcher', 'Layout switcher in the top bar', 'Keys 1–4 still work.'],
              ['rail', 'Right-hand panel', 'Community info, rules and recent posts.'],
              ['backToTop', 'Back-to-top button', ''],
            ] as [keyof HideOptions, string, string][]).map(([k, t, d]) => (
              <Row key={k} title={`Hide ${t.charAt(0).toLowerCase()}${t.slice(1)}`} desc={d || undefined}><Switch label={`Hide ${t}`} on={s.hide[k]} onChange={(v) => setHide(k, v)} /></Row>
            ))}
          </Group>

          <Group id="x" title="X · Timeline" desc="Only affects X. X keeps doing the real work — posting, replies, DMs — Orbit redesigns how it looks and reads.">
            <Row title="Post style" desc="Cards give every post its own surface; List is a classic continuous timeline."><Seg<XPostStyle> value={s.x.postStyle} options={[['cards', 'Cards'], ['list', 'List']]} onChange={(v) => setX({ postStyle: v })} /></Row>
            <Row title="Media size" desc="Caps image and video height so media never takes over the screen."><Seg<XMediaSize> value={s.x.mediaSize} options={[['compact', 'Compact'], ['balanced', 'Balanced'], ['full', 'Full']]} onChange={(v) => setX({ mediaSize: v })} /></Row>
            <Row title="Default Home feed"><Seg<XDefaultFeed> value={s.x.defaultFeed} options={[['remember', 'Last used'], ['foryou', 'For you'], ['following', 'Following']]} onChange={(v) => setX({ defaultFeed: v })} /></Row>
            <Row title="Orbit media viewer" desc="Open photos in Orbit’s viewer (zoom, keyboard, thumbnails). Shift-click keeps X’s own."><Switch label="Orbit media viewer" on={s.x.lightbox} onChange={(v) => setX({ lightbox: v })} /></Row>
            <Row title="Highlight the author’s thread" desc="On a post page, mark the author’s own posts so long threads are easy to follow."><Switch label="Thread focus" on={s.x.threadFocus} onChange={(v) => setX({ threadFocus: v })} /></Row>
          </Group>

          <Group id="x-hide" title="X · Hide elements" desc="Declutter X. Everything stays one switch away.">
            {([
              ['hidePromoted', 'Promoted posts', 'Ads in timelines and replies.'],
              ['hideViews', 'View counts', 'The analytics count on every post.'],
              ['hideComposer', 'Inline composer on Home', 'Write from the Post button or press N instead.'],
              ['hideWhoToFollow', '“Who to follow”', 'Suggestions in the timeline and the right panel.'],
              ['hideTrends', 'Trends', '“What’s happening” in the right panel.'],
              ['hidePremium', 'Premium upsells', 'Subscription prompts.'],
              ['hideRail', 'Right panel', 'The whole right-hand column.'],
            ] as [keyof XSettings, string, string][]).map(([k, t, d]) => (
              <Row key={k} title={`Hide ${t.charAt(0) === '“' ? t : t.charAt(0).toLowerCase() + t.slice(1)}`} desc={d}><Switch label={`Hide ${t}`} on={s.x[k] as boolean} onChange={(v) => setX({ [k]: v } as Partial<XSettings>)} /></Row>
            ))}
          </Group>

          <Group id="youtube" title="YouTube · Feed & watch page" desc="Only affects YouTube. The player, likes, subscriptions, comments and Premium stay YouTube’s own — Orbit redesigns everything around them.">
            <Row title="Video grid" desc="Comfortable shows more detail, Compact fits more videos, Editorial features the lead video."><Seg<YTGrid> value={s.youtube.grid} options={[['comfortable', 'Comfortable'], ['compact', 'Compact'], ['editorial', 'Editorial']]} onChange={(v) => setYT({ grid: v })} /></Row>
            <Row title="Thumbnail size" desc="Orbit fits as many columns as your window allows."><Seg<YTThumb> value={s.youtube.thumbSize} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} onChange={(v) => setYT({ thumbSize: v })} /></Row>
            <Row title="Up next" desc="Where recommendations appear on the watch page."><Seg<YTRecs> value={s.youtube.recommendations} options={[['sidebar', 'Sidebar'], ['grid', 'Grid below'], ['list', 'Compact list']]} onChange={(v) => setYT({ recommendations: v })} /></Row>
            <Row title="Watch page width"><Seg<YTWatchWidth> value={s.youtube.watchWidth} options={[['standard', 'Standard'], ['wide', 'Wide'], ['immersive', 'Immersive']]} onChange={(v) => setYT({ watchWidth: v })} /></Row>
            <Row title="Comments"><Seg<YTComments> value={s.youtube.comments} options={[['threaded', 'Threaded cards'], ['compact', 'Compact']]} onChange={(v) => setYT({ comments: v })} /></Row>
            <Row title="Shorts" desc="Focused dims neighbouring Shorts and adds an ambient backdrop."><Seg<YTShorts> value={s.youtube.shorts} options={[['focused', 'Focused'], ['classic', 'Classic']]} onChange={(v) => setYT({ shorts: v })} /></Row>
            <Row title="Description previews" desc="Show video description snippets where YouTube provides them (search results)."><Switch label="Description previews" on={s.youtube.descriptions} onChange={(v) => setYT({ descriptions: v })} /></Row>
            <Row title="Sidebar customisation" desc="Pin, hide and reorder items from the sidebar itself (pencil button). Reset here."><button className="btn" onClick={() => setYT({ navPinned: [], navHidden: [], navOrder: DEFAULT_YOUTUBE.navOrder, navCollapsed: DEFAULT_YOUTUBE.navCollapsed })}>Reset sidebar</button></Row>
          </Group>

          <Group id="yt-hide" title="YouTube · Hide elements" desc="Orbit never hides or alters ads.">
            {([
              ['hideShortsShelves', 'Shorts shelves', 'Shorts rows in Home, Subscriptions and search.'],
              ['hideNewsShelves', 'Topic shelves', 'Breaking news and other topic rows on Home.'],
              ['hideChips', 'Category chips', 'The filter row under the top bar on Home.'],
              ['collapseComments', 'Comments until clicked', 'Click the comment count to show them.'],
            ] as [keyof YouTubeSettings, string, string][]).map(([k, t, d]) => (
              <Row key={k} title={`Hide ${t.charAt(0).toLowerCase()}${t.slice(1)}`} desc={d}><Switch label={`Hide ${t}`} on={s.youtube[k] as boolean} onChange={(v) => setYT({ [k]: v } as Partial<YouTubeSettings>)} /></Row>
            ))}
          </Group>

          <Group id="data" title="Data & privacy" desc="Orbit has no servers. Settings sync through your Chrome profile; history stays on this device.">
            <Row title="Export settings"><button className="btn" onClick={exportJson}><Icon name="share" size={15} />Export JSON</button></Row>
            <Row title="Import settings">
              <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ''; }} />
              <button className="btn" onClick={() => fileRef.current?.click()}>Choose file…</button>
            </Row>
            <Row title="Clear history" desc="Recently viewed posts, communities, searches and the last page remembered on each platform."><button className="btn danger" onClick={() => { if (confirm('Clear all Orbit history on this device?')) { void saveLocal(DEFAULT_LOCAL); void chrome.storage.local.remove(['orbitSpots', 'orbitXSession', 'orbitYTSearches']); } }}><Icon name="trash" size={15} />Clear</button></Row>
            <Row title="Reset all settings"><button className="btn danger" onClick={() => { if (confirm('Reset every Orbit setting to its default?')) set(DEFAULT_SETTINGS); }}>Reset to defaults</button></Row>
          </Group>

          <Group id="about" title="About">
            <div className="note">
              <b>Orbit {chrome.runtime.getManifest().version}</b> is one client for Reddit, X and YouTube. It runs entirely in your browser, using the sessions you’re already logged into. It never reads or stores your passwords, cookies or tokens, and sends nothing anywhere except to the sites themselves.
              <ul>
                <li><b>Reddit:</b> Orbit rebuilds the interface on top of Reddit’s own JSON endpoints. Pages it doesn’t redesign (settings, post submission, chat, mod tools, wikis) open in classic Reddit, with a button to come back.</li>
                <li><b>YouTube:</b> YouTube’s own app keeps running underneath — the player, likes, subscriptions, comments, history, playlists, Premium and ads are YouTube’s. Orbit replaces the guide and masthead and redesigns feeds, the watch page, comments, Shorts and search.</li>
                <li><b>X:</b> X’s own app keeps running underneath — posting, replies, DMs, notifications and log-in are all native. Orbit re-themes it, replaces its navigation and adds reading tools.</li>
                <li>Click the Orbit logo (or press <kbd className="kbd">Alt</kbd> <kbd className="kbd">O</kbd>) on either site to switch platforms.</li>
                <li>Press <kbd className="kbd">Alt</kbd> <kbd className="kbd">Shift</kbd> <kbd className="kbd">O</kbd> to flip the current tab between Orbit and the classic site.</li>
              </ul>
            </div>
          </Group>
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Options />);
