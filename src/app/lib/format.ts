export function timeAgo(sec: number, now = Date.now()): string {
  const d = Math.max(0, Math.floor(now / 1000 - sec));
  if (d < 60) return 'now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d`;
  if (d < 86400 * 365) return `${Math.floor(d / (86400 * 30))}mo`;
  return `${Math.floor(d / (86400 * 365))}y`;
}

export const fullDate = (sec: number) => new Date(sec * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function compact(n: number): string {
  const a = Math.abs(n);
  if (a < 1000) return String(n);
  if (a < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (a < 1_000_000) return Math.round(n / 1000) + 'k';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}

export const plural = (n: number, one: string, many = one + 's') => `${compact(n)} ${n === 1 ? one : many}`;

const palette = ['#7c83ff', '#ff6a3d', '#2fc58a', '#4aa8ff', '#ff5c8a', '#e0a526', '#b074ff', '#22b8cf'];
export function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.toLowerCase().charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export function plainText(md: string, max = 360): string {
  return md.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/&[a-z]+;/g, ' ').replace(/[#>*_`~|]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
