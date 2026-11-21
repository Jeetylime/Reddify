import { loadSettings, saveSettings } from '../shared/settings';
import type { Msg } from '../shared/messages';

const ALARM = 'reddify-unread';

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await saveSettings(await loadSettings()); // fills in defaults for any newly added settings
  if (reason === 'install') await chrome.runtime.openOptionsPage();
  await schedule();
});
chrome.runtime.onStartup.addListener(() => void schedule());
chrome.storage.onChanged.addListener((c) => { if (c.settings || c.settingsFallback) void schedule(); });

/** Optional toolbar badge with your unread inbox count (uses your existing reddit.com session). */
async function schedule() {
  const s = await loadSettings();
  if (s.enabled && s.badge) {
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

chrome.runtime.onMessage.addListener((msg: Msg, _sender, reply) => {
  if (msg.type === 'open-options') { void chrome.runtime.openOptionsPage(); reply(true); }
  else if (msg.type === 'refresh-badge') { void updateBadge().then(() => reply(true)); return true; }
  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-reddify') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) chrome.tabs.sendMessage(tab.id, { type: 'toggle-classic' } satisfies Msg).catch(() => { /* not a Reddit tab */ });
});
