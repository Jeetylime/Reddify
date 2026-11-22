import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import './popup.css';
import { loadSettings, mergeSettings, onSettingsChanged, platformEnabled, resolveTheme, saveSettings, themeVars } from '@core/settings';
import type { Layout, Settings, Theme, XPostStyle } from '@core/settings';
import type { Msg, TabState } from '@core/messages';
import { PLATFORMS, PLATFORM_ORDER, destination, loadSpots, platformOfUrl } from '@core/platforms';
import type { PlatformId } from '@core/platforms';
import { Icon, Logo, PlatformIcon } from '@core/Icon';

function Popup() {
  const [s, setS] = useState<Settings | null>(null);
  const [tab, setTab] = useState<{ id?: number; state?: TabState; platform: PlatformId | null }>({ platform: null });

  useEffect(() => {
    void loadSettings().then(setS);
    const off = onSettingsChanged(setS);
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([t]) => {
      const platform = platformOfUrl(t?.url);
      let state: TabState | undefined;
      if (platform && t.id != null) state = await chrome.tabs.sendMessage(t.id, { type: 'get-state' } satisfies Msg).catch(() => undefined);
      setTab({ id: t?.id, state, platform });
    });
    return off;
  }, []);
  useEffect(() => { if (s) document.body.classList.toggle('light', resolveTheme(s.theme) === 'light'); }, [s?.theme]);
  if (!s) return null;
  const set = (p: Partial<Settings>) => { const n = mergeSettings({ ...s, ...p }); setS(n); void saveSettings(n); };
  const p = tab.platform;
  const name = p ? PLATFORMS[p].name : '';
  const on = p ? platformEnabled(s, p) : s.enabled;
  const status = !s.enabled ? 'Orbit is turned off'
    : !p ? 'Open Reddit or X to use Orbit'
    : !on ? `Orbit is off for ${name}`
    : tab.state?.active ? `Active on this ${name} tab`
    : tab.state?.classic ? `Showing classic ${name} on this tab`
    : tab.state ? `This page uses classic ${name}`
    : `Reload the ${name} tab to activate`;

  const open = async (id: PlatformId) => {
    const url = destination(id, await loadSpots(), s.rememberState);
    if (tab.id != null && tab.platform) await chrome.tabs.update(tab.id, { url });
    else await chrome.tabs.create({ url });
    window.close();
  };

  return (
    <div className="root" data-theme={resolveTheme(s.theme)} style={themeVars(s) as React.CSSProperties}>
      <div className="head">
        <Logo size={30} />
        <div><b>Orbit</b><small>{chrome.runtime.getManifest().version} · Reddit & X</small></div>
        <button className={`switch ${s.enabled ? 'on' : ''}`} role="switch" aria-checked={s.enabled} aria-label="Enable Orbit" onClick={() => set({ enabled: !s.enabled })} />
      </div>
      <div className="status"><span className={`dot ${tab.state?.active && on ? 'on' : ''}`} />{status}</div>
      <div className="plats">
        {PLATFORM_ORDER.map((id) => (
          <button key={id} className={`plat ${p === id ? 'cur' : ''}`} onClick={() => void open(id)} title={p === id ? `You’re on ${PLATFORMS[id].name}` : `Open ${PLATFORMS[id].name}`}>
            <PlatformIcon id={id} size={26} /><span>{PLATFORMS[id].label}</span>
            {p === id ? <span className="here">Here</span> : <Icon name="chev-right" size={14} />}
          </button>
        ))}
      </div>
      <div className="card">
        <div className="row"><span>Theme</span>
          <div className="seg">{([['dark', 'moon'], ['light', 'sun'], ['system', 'sidebar']] as [Theme, 'moon' | 'sun' | 'sidebar'][]).map(([t, ic]) => <button key={t} className={s.theme === t ? 'on' : ''} title={t} aria-label={`${t} theme`} onClick={() => set({ theme: t })}>{t === 'system' ? 'Auto' : <Icon name={ic} size={14} />}</button>)}</div>
        </div>
        {p === 'x' ? (
          <div className="row"><span>Posts</span>
            <div className="seg">{([['cards', 'Cards'], ['list', 'List']] as [XPostStyle, string][]).map(([v, l]) => <button key={v} className={s.x.postStyle === v ? 'on' : ''} onClick={() => set({ x: { ...s.x, postStyle: v } })}>{l}</button>)}</div>
          </div>
        ) : (
          <div className="row"><span>Reddit layout</span>
            <div className="seg">{(['comfortable', 'compact', 'gallery', 'minimal'] as Layout[]).map((l) => <button key={l} className={s.layout === l ? 'on' : ''} title={l} aria-label={`${l} layout`} onClick={() => set({ layout: l })}><Icon name={l} size={14} /></button>)}</div>
          </div>
        )}
        {p && <div className="row"><span>Orbit on {name}</span><button className={`switch ${s.platforms[p] ? 'on' : ''}`} role="switch" aria-checked={s.platforms[p]} aria-label={`Orbit on ${name}`} onClick={() => set({ platforms: { ...s.platforms, [p]: !s.platforms[p] } })} /></div>}
      </div>
      <div className="btns">
        {p && tab.id != null && on && tab.state && (
          <button className="btn wide" onClick={() => { void chrome.tabs.sendMessage(tab.id!, { type: 'toggle-classic' } satisfies Msg); window.close(); }}><Icon name="swap" size={14} />{tab.state.classic ? 'Back to Orbit' : `Switch to classic ${name}`}</button>
        )}
        <button className="btn" onClick={() => { void chrome.tabs.create({ url: chrome.runtime.getURL(`options.html${p ? `#${p}` : ''}`) }); window.close(); }}><Icon name="settings" size={14} />Settings</button>
        <button className="btn" onClick={() => { void chrome.tabs.create({ url: chrome.runtime.getURL('options.html#keyboard') }); window.close(); }}><Icon name="keyboard" size={14} />Shortcuts</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
