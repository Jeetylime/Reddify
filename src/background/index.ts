import { loadSettings, platformEnabled, saveSettings } from '@core/settings';
import type { Msg } from '@core/messages';

const ALARM = 'orbit-unread';

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await saveSettings(await loadSettings()); // fills in defaults for any newly added settings
  if (reason === 'install') await chrome.runtime.openOptionsPage();
  await schedule();
});
chrome.runtime.onStartup.addListener(() => void schedule());
chrome.storage.onChanged.addListener((c) => { if (c.settings || c.settingsFallback) void schedule(); });

/** Optional toolbar badge with your unread Reddit inbox count (uses your existing reddit.com session). */
async function schedule() {
  const s = await loadSettings();
  if (platformEnabled(s, 'reddit') && s.badge) {
    await chrome.alarms.create(ALARM, { periodInMinutes: 3, delayInMinutes: 0.1 });
  } else {
    await chrome.alarms.clear(ALARM);
    await chrome.action.setBadgeText({ text: '' });
  }
}

async function updateBadge() {
  try {
    const res = await fetch('https://www.reddit.com/api/me.json', { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    const n: number = (await res.json())?.data?.inbox_count ?? 0;
    await chrome.action.setBadgeBackgroundColor({ color: '#ff6a3d' });
    await chrome.action.setBadgeTextColor?.({ color: '#ffffff' });
    await chrome.action.setBadgeText({ text: n > 0 ? (n > 99 ? '99+' : String(n)) : '' });
  } catch {
    await chrome.action.setBadgeText({ text: '' }); // logged out or offline: show nothing rather than something wrong
  }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) void updateBadge(); });

/** Fetch fallback for the content script; only ever reddit.com GETs. Tries a few equivalent URLs. */
async function fetchJson(url: string) {
  const u = new URL(url);
  if (!/^(www\.|old\.)?reddit\.com$/.test(u.hostname)) return { status: 400, text: '', via: 'rejected', attempts: [] as string[] };
  const variants: [URL, string][] = [];
  const add = (x: URL, via: string) => { if (!variants.some(([v]) => v.toString() === x.toString())) variants.push([x, via]); };
  const bare = new URL(u); bare.searchParams.delete('sr_detail');
  add(u, 'worker'); add(bare, 'worker-bare');
  // "/r/popular/hot.json" ⇄ "/r/popular.json?sort=hot" — Reddit accepts both shapes on most listings.
  const m = /^(.*?)\/(best|hot|new|top|rising|controversial)\.json$/.exec(bare.pathname);
  if (m && m[1]) { const alt = new URL(bare); alt.pathname = `${m[1]}.json`; alt.searchParams.set('sort', m[2]); add(alt, 'worker-sort-param'); }
  for (const [v, via] of [...variants]) { if (via === 'worker') continue; const o = new URL(v); o.hostname = 'old.reddit.com'; add(o, `old.reddit (${via.replace('worker-', '')})`); }
  const attempts: string[] = [];
  let last = { status: 0, text: '', via: 'worker' };
  for (const [cand, via] of variants) {
    try {
      const res = await fetch(cand.toString(), { credentials: 'include', headers: { Accept: 'application/json' } });
      last = { status: res.status, text: await res.text(), via };
      attempts.push(`${via}: ${res.status} ${res.headers.get('content-type') ?? ''} ${cand.pathname}${cand.search}`);
      if (res.ok && /^\s*[[{]/.test(last.text)) return { ...last, attempts };
      if (res.status === 404) break;
    } catch (e) {
      attempts.push(`${via}: ${(e as Error).message}`);
    }
  }
  return { ...last, attempts };
}

chrome.runtime.onMessage.addListener((msg: Msg, sender, reply) => {
  if (msg.type === 'fetch-json') {
    if (sender.id !== chrome.runtime.id) return false;
    void fetchJson(msg.url).then(reply);
    return true;
  }
  if (msg.type === 'open-options') {
    if (msg.section) void chrome.tabs.create({ url: chrome.runtime.getURL(`options.html#${encodeURIComponent(msg.section)}`) });
    else void chrome.runtime.openOptionsPage();
    reply(true);
  }
  else if (msg.type === 'refresh-badge') { void updateBadge().then(() => reply(true)); return true; }
  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-orbit') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) chrome.tabs.sendMessage(tab.id, { type: 'toggle-classic' } satisfies Msg).catch(() => { /* not a Reddit or X tab */ });
});
