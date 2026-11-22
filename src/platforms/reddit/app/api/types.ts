export type Vote = 1 | 0 | -1;

export interface Flair { text: string; bg?: string; fg?: 'light' | 'dark'; emojis?: { e: string; u: string }[] }
export interface ImageSrc { url: string; w: number; h: number }

export interface MediaImage { kind: 'image'; src: ImageSrc; preview?: ImageSrc }
export interface MediaGallery { kind: 'gallery'; items: { src: ImageSrc; preview?: ImageSrc; caption?: string }[] }
export interface MediaVideo { kind: 'video'; url: string; audioUrl?: string; poster?: ImageSrc; w: number; h: number; gif: boolean; duration?: number }
export interface MediaEmbed { kind: 'embed'; html: string; w: number; h: number; provider?: string; poster?: ImageSrc }
export interface MediaLink { kind: 'link'; url: string; domain: string; preview?: ImageSrc }
export type Media = MediaImage | MediaGallery | MediaVideo | MediaEmbed | MediaLink;

/** Fields needed for voting/saving — shared by posts and comments. */
export interface Votable { name: string; likes: Vote; saved: boolean; score: number }

export interface Post extends Votable {
  kind: 'post';
  id: string;
  title: string;
  sub: string;
  subIcon?: string;
  author: string;
  created: number;
  ratio?: number;
  comments: number;
  permalink: string;
  url: string;
  domain: string;
  isSelf: boolean;
  selftext?: string;
  selftextHtml?: string;
  flair?: Flair;
  nsfw: boolean;
  spoiler: boolean;
  stickied: boolean;
  locked: boolean;
  archived: boolean;
  promoted: boolean;
  distinguished?: string;
  media?: Media;
  thumb?: string;
  crosspostOf?: { sub: string; permalink: string; author: string };
  awards: number;
  edited: boolean;
}

export interface Comment extends Votable {
  kind: 'comment';
  id: string;
  author: string;
  authorFlair?: Flair;
  body: string;
  bodyHtml: string;
  created: number;
  edited: boolean;
  scoreHidden: boolean;
  depth: number;
  isOp: boolean;
  distinguished?: string;
  stickied: boolean;
  permalink: string;
  controversial: boolean;
  awards: number;
  replies: CommentNode[];
  parent: string;
  collapsedByDefault: boolean;
  sub?: string;
  linkTitle?: string;
}
export interface More { kind: 'more'; id: string; parent: string; children: string[]; count: number; depth: number }
export type CommentNode = Comment | More;

export interface Community {
  name: string;
  title: string;
  icon?: string;
  banner?: string;
  color?: string;
  subscribers: number;
  active?: number;
  descriptionHtml?: string;
  publicDescription?: string;
  created: number;
  nsfw: boolean;
  subscribed?: boolean;
  type?: string;
  fullname?: string;
}

export interface UserAbout { name: string; icon?: string; banner?: string; linkKarma: number; commentKarma: number; created: number; bio?: string }
export interface Me { name: string; modhash?: string; inbox: number; icon?: string; karma: number }
export interface Message { name: string; author: string; subject: string; bodyHtml: string; created: number; unread: boolean; context?: string; sub?: string }
export interface Rule { name: string; html: string }

export type Item = Post | Comment;
export interface Page<T> { items: T[]; after: string | null }
