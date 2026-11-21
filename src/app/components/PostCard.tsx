import { memo } from 'react';
import { Icon } from './Icon';
import { PostMedia, openLightbox, thumbOf } from './Media';
import { PostMenu, SaveBtn, ShareBtn, Votes, absUrl, useRegister } from './Actions';
import { Avatar, FlairChip } from '../lib/ui';
import { castVote, toggleSave, useApp, useEffective } from '../state/store';
import { navigate } from '../lib/router';
import { compact, fullDate, plainText, timeAgo } from '../lib/format';
import type { Post } from '../api/types';
import type { Layout } from '../../shared/settings';

export function PostMeta({ post, showSub = true, full, comments }: { post: Post; showSub?: boolean; full?: boolean; comments?: boolean }) {
  return (
    <div className="p-meta">
      {showSub && <a className="p-sub" href={`/r/${post.sub}`}><Avatar name={post.sub} src={post.subIcon} size="xs" />r/{post.sub}</a>}
      {showSub && <span className="sep" />}
      <a href={`/user/${post.author}`}>u/{post.author}</a>
      {post.distinguished === 'moderator' && <span className="tag mod">Mod</span>}
      {post.distinguished === 'admin' && <span className="tag admin">Admin</span>}
      <span className="sep" />
      <time title={fullDate(post.created)}>{timeAgo(post.created)}{post.edited ? ' (edited)' : ''}</time>
      {post.stickied && <span className="tag pin">Pinned</span>}
      {post.nsfw && <span className="tag nsfw">NSFW</span>}
      {post.spoiler && <span className="tag spoiler">Spoiler</span>}
      {post.locked && <span className="tag lock">Locked</span>}
      {!post.isSelf && post.domain && !/^(i|v)\.redd\.it$|^reddit\.com$/.test(post.domain) && (
        <span className="p-domain"><span className="sep" /> <a href={post.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{post.domain}</a></span>
      )}
      {post.crosspostOf && <><span className="sep" /><span>crossposted from <a href={`/r/${post.crosspostOf.sub}`}>r/{post.crosspostOf.sub}</a></span></>}
      {full && post.awards > 0 && <span className="awards"><span className="sep" /> {post.awards} award{post.awards === 1 ? '' : 's'}</span>}
      {comments && <><span className="sep" /><a className="cc" href={post.permalink}><Icon name="comment" size={12} />{compact(post.comments)}</a></>}
    </div>
  );
}

/** Card click → open the post, unless the click landed on something interactive or text is being selected. */
function onCardClick(post: Post, e: React.MouseEvent) {
  const t = e.target as HTMLElement;
  if (t.closest('a, button, input, textarea, .media, .link-card, .pop-wrap, .votes, video')) return;
  if (window.getSelection()?.toString()) return;
  if (e.ctrlKey || e.metaKey || e.button === 1) { window.open(absUrl(post.permalink), '_blank', 'noopener'); return; }
  navigate(post.permalink);
}

interface CardProps { post: Post; layout: Exclude<Layout, 'gallery'>; focused: boolean; visited: boolean }

export const PostCard = memo(function PostCard({ post, layout, focused, visited }: CardProps) {
  const hide = useApp((s) => s.settings.hide);
  const e = useEffective(post);
  useRegister({ kind: 'post', item: post, href: post.permalink, post });
  if (e.hidden) return null;
  const cls = `post ${layout} ${focused ? 'focused' : ''} ${visited ? 'visited' : ''}`;
  const common = { className: cls, 'data-nav': 'post', 'data-name': post.name, onClick: (ev: React.MouseEvent) => onCardClick(post, ev) };

  if (layout === 'minimal') {
    return (
      <article {...common}>
        <span className={`score ${e.likes === 1 ? 'up' : e.likes === -1 ? 'down' : ''}`}>{hide.voteScore ? '' : compact(e.score)}</span>
        <h2 className="p-title"><a href={post.permalink}>{post.title}</a></h2>
        <div className="m-end">
          <span className="m-votes" onClick={(ev) => ev.stopPropagation()}>
            <button className={`vbtn up ${e.likes === 1 ? 'on' : ''}`} aria-label="Upvote" onClick={() => castVote(post, 1)}><Icon name="up" size={15} fill={e.likes === 1} /></button>
            <button className={`vbtn down ${e.likes === -1 ? 'on' : ''}`} aria-label="Downvote" onClick={() => castVote(post, -1)}><Icon name="down" size={15} fill={e.likes === -1} /></button>
          </span>
          <a className="m-sub" href={`/r/${post.sub}`}>r/{post.sub}</a>
          <a className="m-com" href={post.permalink} aria-label={`${post.comments} comments`}><Icon name="comment" size={13} />{compact(post.comments)}</a>
          <time className="m-age" title={fullDate(post.created)}>{timeAgo(post.created)}</time>
        </div>
      </article>
    );
  }

  if (layout === 'compact') {
    const th = thumbOf(post);
    const k = post.media?.kind;
    return (
      <article {...common}>
        <Votes item={post} hideScore={hide.voteScore} />
        <div className="p-body">
          <PostMeta post={post} comments />
          <h2 className="p-title"><a href={post.permalink}>{post.title}</a>{!hide.flairs && <FlairChip flair={post.flair} />}</h2>
        </div>
        <div className="quick" onClick={(ev) => ev.stopPropagation()}>
          <ShareBtn path={post.permalink} />
          <SaveBtn item={post} />
          <PostMenu post={post} />
        </div>
        <a className={`thumb ${post.nsfw || post.spoiler ? 'nsfw' : ''} ${th ? '' : 'empty'}`} href={post.permalink} aria-label="Open post"
          onClick={(ev) => { if (k === 'image' && th && !post.nsfw && !post.spoiler && post.media?.kind === 'image') { ev.preventDefault(); ev.stopPropagation(); openLightbox([{ url: post.media.src.url, w: post.media.src.w, h: post.media.src.h }], 0, post.title); } }}>
          {th ? <img src={th} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Icon name={k === 'link' ? 'link' : post.isSelf ? 'comment' : 'image'} size={18} />}
          {k === 'video' && <span className="ti"><Icon name="play" size={10} fill /></span>}
          {k === 'gallery' && <span className="ti"><Icon name="layers" size={11} /></span>}
          {k === 'link' && th && <span className="ti"><Icon name="link" size={11} /></span>}
        </a>
      </article>
    );
  }

  const preview = (!post.media || post.media.kind === 'link') && post.selftext ? plainText(post.selftext) : undefined;
  return (
    <article {...common}>
      <Votes item={post} hideScore={hide.voteScore} />
      <div className="p-body">
        <PostMeta post={post} />
        <h2 className="p-title"><a href={post.permalink}>{post.title}</a>{!hide.flairs && <FlairChip flair={post.flair} />}</h2>
        {preview && <p className="p-text">{preview}</p>}
        <PostMedia post={post} />
        <div className="p-actions">
          <a className="act" href={post.permalink} title="Comments (C)"><Icon name="comment" size={16} />{compact(post.comments)}<span className="sr"> comments</span></a>
          <ShareBtn path={post.permalink} label />
          <SaveBtn item={post} label />
          <PostMenu post={post} />
        </div>
      </div>
    </article>
  );
});

export const GalleryTile = memo(function GalleryTile({ post, focused }: { post: Post; focused: boolean }) {
  const e = useEffective(post);
  const blur = useApp((s) => (post.nsfw && s.settings.blurNsfw) || (post.spoiler && s.settings.blurSpoilers));
  useRegister({ kind: 'post', item: post, href: post.permalink, post });
  if (e.hidden) return null;
  const m = post.media;
  const th = thumbOf(post);
  const visual = th && m && m.kind !== 'link';
  const dims = m?.kind === 'image' ? m.preview ?? m.src : m?.kind === 'gallery' ? m.items[0].preview ?? m.items[0].src : m?.kind === 'video' ? { w: m.w, h: m.h } : undefined;
  return (
    <article className={`tile ${focused ? 'focused' : ''}`} data-nav="post" data-name={post.name} onClick={(ev) => onCardClick(post, ev)}>
      {visual ? (
        <>
          <div className={blur ? 'blur' : ''} style={{ overflow: 'hidden' }}>
            <img src={th} alt={post.title} loading="lazy" referrerPolicy="no-referrer" style={dims && dims.w ? { aspectRatio: `${dims.w} / ${dims.h}` } : { minHeight: 140 }} />
          </div>
          <div className="tile-top">
            <span className="tchip">r/{post.sub}</span>
            <span className="right" style={{ display: 'flex', gap: 4, transition: 'opacity 180ms' }}>
              {m.kind === 'gallery' && <span className="tchip"><Icon name="layers" size={12} />{m.items.length}</span>}
              {m.kind === 'video' && <span className="tchip"><Icon name="play" size={10} fill />{m.gif ? 'GIF' : 'Video'}</span>}
              {post.nsfw && <span className="tchip">NSFW</span>}
            </span>
          </div>
          <div className="tile-acts" onClick={(ev) => ev.stopPropagation()}>
            <button className={e.likes === 1 ? 'up' : ''} onClick={() => castVote(post, 1)} aria-label="Upvote"><Icon name="up" size={15} fill={e.likes === 1} /></button>
            <button className={e.saved ? 'saved' : ''} onClick={() => toggleSave(post)} aria-label="Save"><Icon name="bookmark" size={15} fill={e.saved} /></button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('reddify:media', { detail: post.name }))} aria-label="View media"><Icon name="maximize" size={14} /></button>
          </div>
          <div className="tile-over">
            <div className="t">{post.title}</div>
            <div className="m"><span>▲ {compact(e.score)}</span><span>{compact(post.comments)} comments</span><span>{timeAgo(post.created)}</span></div>
          </div>
        </>
      ) : (
        <div className="tile-txt">
          <PostMeta post={post} />
          <h2 className="p-title"><a href={post.permalink}>{post.title}</a></h2>
          {post.selftext && <p className="p-text">{plainText(post.selftext, 400)}</p>}
          {m?.kind === 'link' && <div className="p-meta" style={{ marginTop: 6 }}><Icon name="link" size={12} />{m.domain}</div>}
          <div className="p-meta" style={{ marginTop: 10 }}><span>▲ {compact(e.score)}</span><span className="sep" /><span>{compact(post.comments)} comments</span></div>
        </div>
      )}
    </article>
  );
});
