import { useEffect } from 'react';
import { Icon } from './Icon';
import { Menu, MenuItem } from '../lib/ui';
import { castVote, getState, hidePost, toast, toggleSave, updateSettings, useEffective } from '../state/store';
import { compact } from '../lib/format';
import type { Comment, Post, Votable } from '../api/types';

/** What's on screen, so keyboard shortcuts can act on the focused item without prop-drilling. */
export interface Entry { kind: 'post' | 'comment'; item: Votable; href: string; post?: Post; comment?: Comment; toggle?: () => void }
export const registry = new Map<string, Entry>();

export function useRegister(entry: Entry) {
  useEffect(() => {
    registry.set(entry.item.name, entry);
    return () => { if (registry.get(entry.item.name) === entry) registry.delete(entry.item.name); };
  });
}

export const absUrl = (path: string) => new URL(path, location.origin).toString();

export async function copy(text: string, what = 'Link') {
  try { await navigator.clipboard.writeText(text); toast(`${what} copied`, 'success'); }
  catch { toast('Clipboard access was blocked by the browser', 'error'); }
}

export function Votes({ item, row, hideScore }: { item: Votable; row?: boolean; hideScore?: boolean }) {
  const e = useEffective(item);
  return (
    <div className={`votes ${row ? 'row' : ''} ${hideScore ? 'no-score' : ''}`} onClick={(ev) => ev.stopPropagation()}>
      <button className={`vbtn up ${e.likes === 1 ? 'on' : ''}`} aria-label="Upvote" aria-pressed={e.likes === 1} onClick={() => castVote(item, 1)}><Icon name="up" size={18} fill={e.likes === 1} /></button>
      <span className={`score ${e.likes === 1 ? 'up' : e.likes === -1 ? 'down' : ''}`} title={`${e.score.toLocaleString()} points`}>{compact(e.score)}</span>
      <button className={`vbtn down ${e.likes === -1 ? 'on' : ''}`} aria-label="Downvote" aria-pressed={e.likes === -1} onClick={() => castVote(item, -1)}><Icon name="down" size={18} fill={e.likes === -1} /></button>
    </div>
  );
}

export function SaveBtn({ item, label, cls = 'act' }: { item: Votable; label?: boolean; cls?: string }) {
  const e = useEffective(item);
  return (
    <button className={`${cls} ${e.saved ? 'saved' : ''}`} onClick={(ev) => { ev.stopPropagation(); toggleSave(item); }} title={e.saved ? 'Unsave (S)' : 'Save (S)'} aria-pressed={e.saved}>
      <Icon name="bookmark" size={16} fill={e.saved} />{label && <span>{e.saved ? 'Saved' : 'Save'}</span>}
    </button>
  );
}

export function ShareBtn({ path, label, cls = 'act' }: { path: string; label?: boolean; cls?: string }) {
  return (
    <button className={cls} onClick={(ev) => { ev.stopPropagation(); void copy(absUrl(path)); }} title="Copy link">
      <Icon name="share" size={16} />{label && <span>Share</span>}
    </button>
  );
}

export function PostMenu({ post, cls = 'act' }: { post: Post; cls?: string }) {
  const muted = getState().settings.mutedSubs.some((m) => m.toLowerCase() === post.sub.toLowerCase());
  const toggleMute = () => {
    if (muted) { updateSettings((s) => ({ mutedSubs: s.mutedSubs.filter((m) => m.toLowerCase() !== post.sub.toLowerCase()) })); toast(`Unmuted r/${post.sub}`); return; }
    updateSettings((s) => ({ mutedSubs: [...s.mutedSubs, post.sub] }));
    toast(`r/${post.sub} muted in Home, Popular and All`, 'info', { label: 'Undo', run: () => updateSettings((s) => ({ mutedSubs: s.mutedSubs.filter((m) => m !== post.sub) })) });
  };
  return (
    <Menu label="More actions" buttonClass={cls} button={<Icon name="more" size={17} />}>
      {(close) => (<>
        <MenuItem icon="copy" label="Copy link" onClick={() => { close(); void copy(absUrl(post.permalink)); }} />
        <MenuItem icon="external" label="Open in new tab" onClick={() => { close(); window.open(absUrl(post.permalink), '_blank', 'noopener'); }} />
        {!post.isSelf && post.url && <MenuItem icon="link" label={`Open ${post.domain}`} onClick={() => { close(); window.open(post.url, '_blank', 'noopener,noreferrer'); }} />}
        {post.media && post.media.kind !== 'link' && <MenuItem icon="maximize" label="View media" hint="M" onClick={() => { close(); window.dispatchEvent(new CustomEvent('reddify:media', { detail: post.name })); }} />}
        <div className="pop-sep" />
        <MenuItem icon="eye-off" label="Hide post" hint="H" onClick={() => { close(); hidePost(post.name); }} />
        <MenuItem icon="filter" label={`${muted ? 'Unmute' : 'Mute'} r/${post.sub}`} onClick={() => { close(); toggleMute(); }} />
      </>)}
    </Menu>
  );
}
