import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './options.css';
import { ACCENT_PRESETS, DEFAULT_LOCAL, DEFAULT_SETTINGS, SECTION_LABELS, loadSettings, mergeSettings, onSettingsChanged, resolveTheme, saveLocal, saveSettings, themeVars } from '../shared/settings';
import type { Density, HideOptions, Layout, SectionId, Settings, Theme } from '../shared/settings';
import { SHORTCUTS } from '../shared/shortcuts';
import { Icon, Logo } from '../app/components/Icon';
import type { IconName } from '../app/components/Icon';

const SECTIONS: [string, string, IconName][] = [
  ['appearance', 'Appearance', 'sun'], ['layout', 'Layout & reading', 'comfortable'], ['content', 'Feed & content', 'filter'],
  ['navigation', 'Sidebar', 'sidebar'], ['filters', 'Filters', 'eye-off'], ['interface', 'Interface elements', 'layers'],
  ['keyboard', 'Keyboard', 'keyboard'], ['data', 'Data & privacy', 'lock'], ['about', 'About', 'info'],
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

  if (!s) return null;
  const set = (patch: Partial<Settings>) => {
    const next = mergeSettings({ ...s, ...patch });
    setS(next);
    void saveSettings(next).then(() => setSavedTick((t) => t + 1));
  };
  const setHide = (k: keyof HideOptions, v: boolean) => set({ hide: { ...s.hide, [k]: v } });
  const moveSection = (id: SectionId, d: -1 | 1) => { const o = [...s.navOrder]; const i = o.indexOf(id); const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; set({ navOrder: o }); };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'reddify-settings.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async (f: File) => {
    try { set(mergeSettings(JSON.parse(await f.text()))); alert('Settings imported.'); }
    catch { alert('That file isn’t a valid Reddify settings export.'); }
  };

  const theme = resolveTheme(s.theme);
  return (
    <div className="root" data-theme={theme} style={themeVars(s) as React.CSSProperties}>
      <div className="layout">
        <nav className="nav" aria-label="Settings sections">
          <div className="brand"><Logo size={34} /><div><b>Reddify</b><span>Settings</span></div></div>
          {SECTIONS.map(([id, label, icon]) => <a key={id} href={`#${id}`} className={active === id ? 'on' : ''}><Icon name={icon} size={16} />{label}</a>)}
        </nav>
        <main className="content">
          <header>
            <h1>Settings</h1>
            <span className={`saved-pill ${savedTick ? 'show' : ''}`} key={savedTick}><Icon name="check" size={14} />Saved · applies instantly to open tabs</span>
          </header>
          <div className="panel"><Row title="Enable Reddify" desc="Turn off to use the original Reddit interface everywhere. You can also switch per tab with Alt+Shift+R."><Switch label="Enable Reddify" on={s.enabled} onChange={(v) => set({ enabled: v })} /></Row></div>

          <Group id="appearance" title="Appearance">
            <Row title="Theme"><Seg<Theme> value={s.theme} options={[['dark', 'Dark'], ['light', 'Light'], ['system', 'System']]} onChange={(v) => set({ theme: v })} /></Row>
            <Row title="Accent color" desc="Used sparingly for selection, links and focus.">
              <div className="swatches">
                {ACCENT_PRESETS.map((p) => <button key={p.value} className={`sw ${s.accent.toLowerCase() === p.value ? 'on' : ''}`} style={{ background: p.value }} title={p.name} aria-label={p.name} onClick={() => set({ accent: p.value })} />)}
                <label className="sw-custom" title="Custom color" style={ACCENT_PRESETS.some((p) => p.value === s.accent.toLowerCase()) ? undefined : { background: s.accent, borderStyle: 'solid' }}><input type="color" value={s.accent} onChange={(e) => set({ accent: e.target.value })} aria-label="Custom accent color" /></label>
              </div>
            </Row>
            <Row title="Preview" col>
              <div className="preview">
                <div className="v"><span className="up">▲</span>2.4k<span>▼</span></div>
                <div>
                  <div className="meta"><b>r/design</b> · u/someone · 3h</div>
                  <h3>The details are not the details. They make the design.</h3>
                  <p>Reddify uses your font size, line height and density settings for posts and comments — adjust them below and watch this preview update.</p>
                  <div className="acts"><span>148 comments</span><span>Share</span><span>Save</span></div>
                </div>
              </div>
            </Row>
          </Group>

          <Group id="layout" title="Layout & reading">
            <Row title="Default feed layout" desc="Switch any time from the top bar or with keys 1–4."><Seg<Layout> value={s.layout} options={[['comfortable', 'Comfortable'], ['compact', 'Compact'], ['gallery', 'Gallery'], ['minimal', 'Minimal']]} onChange={(v) => set({ layout: v })} /></Row>
            <Row title="Density" desc="Vertical spacing between posts."><Seg<Density> value={s.density} options={[['cozy', 'Cozy'], ['regular', 'Regular'], ['tight', 'Tight']]} onChange={(v) => set({ density: v })} /></Row>
            <Row title="Content width" desc="Maximum width of the feed and comments column."><Range value={s.contentWidth} min={600} max={1100} step={20} unit="px" onChange={(v) => set({ contentWidth: v })} /></Row>
            <Row title="Text size" desc="Post bodies and comments."><Range value={s.fontSize} min={12} max={19} step={0.5} unit="px" onChange={(v) => set({ fontSize: v })} /></Row>
            <Row title="Line spacing"><Range value={s.lineHeight} min={1.3} max={1.9} step={0.05} onChange={(v) => set({ lineHeight: Math.round(v * 100) / 100 })} /></Row>
            <Row title="Sidebar"><Seg value={s.sidebarMode} options={[['expanded', 'Expanded'], ['compact', 'Compact (icons)']]} onChange={(v) => set({ sidebarMode: v })} /></Row>
            <Row title="Sidebar width" desc="Width of the expanded sidebar."><Range value={s.sidebarWidth} min={200} max={320} step={4} unit="px" onChange={(v) => set({ sidebarWidth: v })} /></Row>
            <Row title="Reading mode" desc="Hides the right panel, widens type and calms the chrome for long reads."><Switch label="Reading mode" on={s.readingMode} onChange={(v) => set({ readingMode: v })} /></Row>
            <Row title="Compact media previews" desc="Smaller images and videos in feeds."><Switch label="Compact media" on={s.compactMedia} onChange={(v) => set({ compactMedia: v })} /></Row>
          </Group>

          <Group id="content" title="Feed & content">
            <Row title="Hide promoted posts" desc="Removes anything Reddit marks as promoted or an ad."><Switch label="Hide promoted" on={s.hidePromoted} onChange={(v) => set({ hidePromoted: v })} /></Row>
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

          <Group id="navigation" title="Sidebar" desc="Reorder or hide sidebar sections. You can also do this in-app with the pencil button at the bottom of the sidebar.">
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

          <Group id="filters" title="Filters" desc="Applied to Home, Popular, All and multireddits. A community’s own page always shows everything.">
            <Row title="Muted communities" col><TagList items={s.mutedSubs} prefix="r/" placeholder="r/community" onChange={(v) => set({ mutedSubs: v })} /></Row>
            <Row title="Muted keywords" desc="Posts whose titles contain any of these words are hidden (case-insensitive)." col><TagList items={s.mutedKeywords} placeholder="keyword or phrase" onChange={(v) => set({ mutedKeywords: v })} /></Row>
          </Group>

          <Group id="interface" title="Interface elements" desc="Hide things you don’t need.">
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

          <Group id="keyboard" title="Keyboard">
            <Row title="Keyboard shortcuts" desc="Ctrl/⌘+K always opens the quick switcher."><Switch label="Keyboard shortcuts" on={s.keyboard} onChange={(v) => set({ keyboard: v })} /></Row>
            <div className="keys-grid">
              {SHORTCUTS.map(([g, items]) => (
                <div key={g} style={{ display: 'contents' }}>
                  <h4>{g}</h4>
                  {items.map(([l, keys]) => <div className="kr" key={l}><span>{l}</span><span>{keys.map((k, i) => <kbd className="kbd" key={i}>{k}</kbd>)}</span></div>)}
                </div>
              ))}
            </div>
          </Group>

          <Group id="data" title="Data & privacy" desc="Reddify has no servers. Settings sync through your Chrome profile; history stays on this device.">
            <Row title="Export settings"><button className="btn" onClick={exportJson}><Icon name="share" size={15} />Export JSON</button></Row>
            <Row title="Import settings">
              <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ''; }} />
              <button className="btn" onClick={() => fileRef.current?.click()}>Choose file…</button>
            </Row>
            <Row title="Clear history" desc="Recently viewed posts, communities and searches."><button className="btn danger" onClick={() => { if (confirm('Clear all Reddify history on this device?')) void saveLocal(DEFAULT_LOCAL); }}><Icon name="trash" size={15} />Clear</button></Row>
            <Row title="Reset all settings"><button className="btn danger" onClick={() => { if (confirm('Reset every Reddify setting to its default?')) set(DEFAULT_SETTINGS); }}>Reset to defaults</button></Row>
          </Group>

          <Group id="about" title="About">
            <div className="note">
              <b>Reddify {chrome.runtime.getManifest().version}</b> rebuilds Reddit’s interface on top of Reddit’s own JSON endpoints, using the session you’re already logged into. It never reads or stores your password or cookies, and sends nothing anywhere except reddit.com.
              <ul>
                <li>Pages Reddify doesn’t redesign (settings, post submission, chat, mod tools, wikis) open in classic Reddit, with a button to come back.</li>
                <li>Press <kbd className="kbd">Alt</kbd> <kbd className="kbd">Shift</kbd> <kbd className="kbd">R</kbd> to flip the current tab between Reddify and classic Reddit.</li>
                <li>Reddit doesn’t offer saved-post folders to regular accounts, so saved items are organized by community instead.</li>
              </ul>
            </div>
          </Group>
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Options />);
