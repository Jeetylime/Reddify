import { createContext, memo, useContext, useState } from 'react';
import { Icon } from './Icon';
import { FlairChip, Menu, MenuItem, Spinner } from '../lib/ui';
import { SaveBtn, ShareBtn, Votes, absUrl, copy, useRegister } from './Actions';
import { compact, fullDate, timeAgo } from '../lib/format';
import { sanitize } from '../lib/sanitize';
import { trustedHTML } from '../lib/trusted';
import { reply } from '../api/reddit';
import type { Comment, CommentNode, More } from '../api/types';
import { toast, useApp, useEffective } from '../state/store';

export function Html({ html, className = '' }: { html: string; className?: string }) {
  // Reddit's pre-rendered HTML, passed through a strict allow-list sanitizer (lib/sanitize.ts).
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: trustedHTML(sanitize(html)) }} />;
}

export interface ThreadCtx {
  collapsed: Set<string>;
  toggle: (name: string) => void;
  loadMore: (m: More) => Promise<void>;
  addReply: (parent: string, c: Comment) => void;
  canReply: boolean;
  postPermalink: string;
}
export const Ctx = createContext<ThreadCtx | null>(null);
const useCtx = () => useContext(Ctx)!;

const countDescendants = (c: Comment): number => c.replies.reduce((n, r) => n + (r.kind === 'comment' ? 1 + countDescendants(r) : r.count), 0);

export function Composer({ parent, depth, placeholder, onPosted, onCancel, autoFocus }: {
  parent: string; depth: number; placeholder: string; onPosted: (c: Comment) => void; onCancel?: () => void; autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(!!autoFocus);
  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try { onPosted(await reply(parent, text, depth)); setText(''); setOpen(false); toast('Comment posted', 'success'); onCancel?.(); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div className={`composer ${open || text ? 'open' : ''}`}>
      <textarea value={text} autoFocus={autoFocus} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void submit(); if (e.key === 'Escape') { onCancel?.(); setOpen(false); (e.target as HTMLElement).blur(); } }} />
      {(open || text) && (
        <div className="composer-foot">
          <span className="mute">Markdown supported · <kbd className="kbd">⌘/Ctrl</kbd> <kbd className="kbd">↵</kbd> to send</span>
          <span style={{ display: 'flex', gap: 6 }}>
            {onCancel && <button className="btn sm ghost" onClick={onCancel}>Cancel</button>}
            <button className="btn sm primary" disabled={busy || !text.trim()} onClick={submit}>{busy ? 'Posting…' : 'Comment'}</button>
          </span>
        </div>
      )}
    </div>
  );
}

export function MoreButton({ m, top }: { m: More; top?: boolean }) {
  const ctx = useCtx();
  const [busy, setBusy] = useState(false);
  if (m.children.length === 0) {
    // Reddit signals "continue this thread" with an empty children list: link to the deeper thread.
    return <a className={`more-btn ${top ? 'top' : ''}`} href={`${ctx.postPermalink}${m.parent.replace(/^t1_/, '')}/`}><Icon name="chev-right" size={14} />Continue this thread</a>;
  }
  return (
    <button className={`more-btn ${top ? 'top' : ''}`} disabled={busy} onClick={async () => { setBusy(true); try { await ctx.loadMore(m); } catch (e) { toast((e as Error).message, 'error'); setBusy(false); } }}>
      {busy ? <Spinner /> : <Icon name="plus" size={14} />}{`${compact(m.count || m.children.length)} more ${(m.count || m.children.length) === 1 ? 'reply' : 'replies'}`}
    </button>
  );
}

export const CommentView = memo(function CommentView({ c }: { c: Comment }) {
  const ctx = useCtx();
  const focused = useApp((s) => s.focused === c.name);
  const e = useEffective(c);
  const [replying, setReplying] = useState(false);
  const collapsed = ctx.collapsed.has(c.name);
  const removed = c.body === '[deleted]' || c.body === '[removed]';
  useRegister({ kind: 'comment', item: c, href: c.permalink, comment: c, toggle: () => ctx.toggle(c.name) });
  const hidden = collapsed ? countDescendants(c) : 0;

  return (
    <div className={`cmt d${Math.min(c.depth, 6)} ${collapsed ? 'collapsed' : ''} ${focused ? 'focused' : ''}`} data-nav="comment" data-name={c.name} id={`t1_${c.id}`}>
      <div className="c-main">
        <div className="c-head">
          <button className="c-toggle" onClick={() => ctx.toggle(c.name)} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand' : 'Collapse'} title="Collapse (X)">
            <Icon name={collapsed ? 'plus' : 'minus'} size={13} />
          </button>
          {c.author === '[deleted]' ? <span>[deleted]</span> : <a className={`c-au ${c.isOp ? 'op' : ''}`} href={`/user/${c.author}`}>{c.author}</a>}
          {c.isOp && <span className="tag op">OP</span>}
          {c.distinguished === 'moderator' && <span className="tag mod">Mod</span>}
          {c.distinguished === 'admin' && <span className="tag admin">Admin</span>}
          {c.stickied && <span className="tag pin">Pinned</span>}
          <FlairChip flair={c.authorFlair} />
          <span className="sep" />
          <a className="c-time" href={c.permalink} title={fullDate(c.created)}>{timeAgo(c.created)}{c.edited ? '*' : ''}</a>
          {c.awards > 0 && <span className="awards"><span className="sep" /> {c.awards} award{c.awards === 1 ? '' : 's'}</span>}
          {c.controversial && <span title="Controversial" style={{ color: 'var(--danger)' }}>†</span>}
          <span className="c-collapsed-note"><span className="sep" /> {c.scoreHidden ? '' : `${compact(e.score)} pts · `}{hidden ? `${hidden} repl${hidden === 1 ? 'y' : 'ies'}` : 'collapsed'}</span>
        </div>
        <div className="c-body">{removed ? <span className="mute">[{c.body.slice(1, -1)}]</span> : <Html html={c.bodyHtml} />}</div>
        <div className="c-foot" onClick={(ev) => ev.stopPropagation()}>
          <Votes item={c} row hideScore={c.scoreHidden} />
          {ctx.canReply && <button className="act" onClick={() => setReplying((v) => !v)}><Icon name="comment" size={15} />Reply</button>}
          <ShareBtn path={c.permalink} cls="act dim" />
          <SaveBtn item={c} cls="act dim" />
          <Menu label="More" buttonClass="act dim" button={<Icon name="more" size={16} />} up>
            {(close) => (<>
              <MenuItem icon="copy" label="Copy text" onClick={() => { close(); void copy(c.body, 'Comment'); }} />
              <MenuItem icon="link" label="Copy permalink" onClick={() => { close(); void copy(absUrl(c.permalink)); }} />
              <MenuItem icon="layers" label="Open thread from here" href={c.permalink} onClick={close} />
            </>)}
          </Menu>
        </div>
      </div>
      {replying && (
        <div className="reply-wrap">
          <Composer parent={c.name} depth={c.depth + 1} autoFocus placeholder={`Reply to u/${c.author}…`} onCancel={() => setReplying(false)} onPosted={(r) => ctx.addReply(c.name, r)} />
        </div>
      )}
      {c.replies.length > 0 && (
        <div className="c-kids">
          <div className="c-guide" onClick={() => ctx.toggle(c.name)} title="Collapse thread" />
          {c.replies.map((k) => (k.kind === 'comment' ? <CommentView key={k.name} c={k} /> : <MoreButton key={k.id} m={k} />))}
        </div>
      )}
    </div>
  );
});

export function CommentTree({ nodes }: { nodes: CommentNode[] }) {
  const focused = useApp((s) => s.focused);
  return (
    <div className="comments">
      {nodes.map((n) => n.kind === 'comment'
        ? <div key={n.name} className={`thread ${focused === n.name ? 'focused' : ''}`} data-nav="thread" data-name={n.name}><CommentView c={n} /></div>
        : <MoreButton key={n.id} m={n} top />)}
    </div>
  );
}

/** A comment shown outside its thread (profiles, saved, search) with context. */
export function CommentItem({ c }: { c: Comment }) {
  return (
    <div className="ctx-item">
      <div className="src">
        <Icon name="comment" size={13} />
        <a href={`/user/${c.author}`}>u/{c.author}</a>commented in<a href={`/r/${c.sub}`}>r/{c.sub}</a>
        <span className="sep" /><span>{timeAgo(c.created)}</span><span className="sep" /><span>{compact(c.score)} pts</span>
      </div>
      {c.linkTitle && <a href={c.permalink} style={{ display: 'block', fontWeight: 620, marginBottom: 6 }}>{c.linkTitle}</a>}
      <Html html={c.bodyHtml} />
    </div>
  );
}
