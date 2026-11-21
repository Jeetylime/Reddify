import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import './popup.css';
import { loadSettings, mergeSettings, onSettingsChanged, resolveTheme, saveSettings, themeVars } from '../shared/settings';
import type { Layout, Settings, Theme } from '../shared/settings';
import type { Msg, TabState } from '../shared/messages';
import { Icon, Logo } from '../app/components/Icon';

function Popup() {
  const [s, setS] = useState<Settings | null>(null);
  const [tab, setTab] = useState<{ id?: number; state?: TabState; reddit: boolean }>({ reddit: false });

  useEffect(() => {
    void loadSettings().then(setS);
    const off = onSettingsChanged(setS);
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([t]) => {
      const reddit = !!t?.url && /^https?:\/\/(www\.)?reddit\.com\//.test(t.url);
      let state: TabState | undefined;
      if (reddit && t.id != null) state = await chrome.tabs.sendMessage(t.id, { type: 'get-state' } satisfies Msg).catch(() => undefined);
      setTab({ id: t?.id, state, reddit });
    });
    return off;
  }, []);
  useEffect(() => { if (s) document.body.classList.toggle('light', resolveTheme(s.theme) === 'light'); }, [s?.theme]);
  if (!s) return null;
  const set = (p: Partial<Settings>) => { const n = mergeSettings({ ...s, ...p }); setS(n); void saveSettings(n); };
  const status = !s.enabled ? 'Reddify is turned off' : !tab.reddit ? 'Open Reddit to use Reddify' : tab.state?.active ? 'Active on this tab' : tab.state?.classic ? 'Showing classic Reddit on this tab' : tab.state ? 'This page uses classic Reddit' : 'Reload the Reddit tab to activate';

  return (
    <div className="root" data-theme={resolveTheme(s.theme)} style={themeVars(s) as React.CSSProperties}>
      <div className="head">
        <Logo size={30} />
        <div><b>Reddify</b><small>{chrome.runtime.getManifest().version}</small></div>
        <button className={`switch ${s.enabled ? 'on' : ''}`} role="switch" aria-checked={s.enabled} aria-label="Enable Reddify" onClick={() => set({ enabled: !s.enabled })} />
      </div>
      <div className="status"><span className={`dot ${tab.state?.active && s.enabled ? 'on' : ''}`} />{status}</div>
      <div className="card">
        <div className="row"><span>Theme</span>
          <div className="seg">{([['dark', 'moon'], ['light', 'sun'], ['system', 'sidebar']] as [Theme, 'moon' | 'sun' | 'sidebar'][]).map(([t, ic]) => <button key={t} className={s.theme === t ? 'on' : ''} title={t} aria-label={`${t} theme`} onClick={() => set({ theme: t })}>{t === 'system' ? 'Auto' : <Icon name={ic} size={14} />}</button>)}</div>
        </div>
        <div className="row"><span>Layout</span>
          <div className="seg">{(['comfortable', 'compact', 'gallery', 'minimal'] as Layout[]).map((l) => <button key={l} className={s.layout === l ? 'on' : ''} title={l} aria-label={`${l} layout`} onClick={() => set({ layout: l })}><Icon name={l} size={14} /></button>)}</div>
        </div>
        <div className="row"><span>Reading mode</span><button className={`switch ${s.readingMode ? 'on' : ''}`} role="switch" aria-checked={s.readingMode} aria-label="Reading mode" onClick={() => set({ readingMode: !s.readingMode })} /></div>
      </div>
      <div className="btns">
        {tab.reddit && tab.id != null && s.enabled && tab.state
          ? <button className="btn wide" onClick={() => { void chrome.tabs.sendMessage(tab.id!, { type: 'toggle-classic' } satisfies Msg); window.close(); }}><Icon name="swap" size={14} />{tab.state.classic ? 'Back to Reddify' : 'Switch to classic Reddit'}</button>
          : <button className="btn wide primary" onClick={() => { void chrome.tabs.create({ url: 'https://www.reddit.com/' }); window.close(); }}><Icon name="external" size={14} />Open Reddit</button>}
        <button className="btn" onClick={() => { void chrome.runtime.openOptionsPage(); window.close(); }}><Icon name="settings" size={14} />Settings</button>
        <button className="btn" onClick={() => { void chrome.tabs.create({ url: chrome.runtime.getURL('options.html#keyboard') }); window.close(); }}><Icon name="keyboard" size={14} />Shortcuts</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
