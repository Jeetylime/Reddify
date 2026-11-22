import { useEffect, useSyncExternalStore } from 'react';
import { ApiError } from '../api/reddit';
import type { Page } from '../api/types';

/**
 * A cached, paginated resource. Instances are kept in a small LRU so that Back restores a feed
 * (items *and* scroll position) instantly instead of refetching.
 */
export class Paged<T> {
  items: T[] = [];
  after: string | null = null;
  status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  loadingMore = false;
  moreError?: ApiError;
  error?: ApiError;
  exhausted = false;
  scrollTop = 0;
  private version = 0;
  private listeners = new Set<() => void>();

  constructor(private fetcher: (after: string | null) => Promise<Page<T>>, private idOf: (t: T) => string) {}

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getVersion = () => this.version;
  private emit() { this.version++; this.listeners.forEach((l) => l()); }

  async load() {
    if (this.status === 'loading') return;
    this.status = 'loading'; this.error = undefined; this.emit();
    try {
      const res = await this.fetcher(null);
      this.items = dedupe(res.items, this.idOf);
      this.after = res.after;
      this.exhausted = !res.after;
      this.status = 'ready';
    } catch (e) {
      this.error = asApiError(e);
      this.status = 'error';
    }
    this.emit();
  }

  async more() {
    if (this.status !== 'ready' || this.loadingMore || this.exhausted) return;
    this.loadingMore = true; this.moreError = undefined; this.emit();
    try {
      const res = await this.fetcher(this.after);
      const seen = new Set(this.items.map(this.idOf));
      this.items = [...this.items, ...res.items.filter((i) => !seen.has(this.idOf(i)))];
      this.after = res.after;
      this.exhausted = !res.after || res.items.length === 0;
    } catch (e) {
      this.moreError = asApiError(e);
    }
    this.loadingMore = false;
    this.emit();
  }
}

function dedupe<T>(items: T[], id: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((i) => { const k = id(i); if (seen.has(k)) return false; seen.add(k); return true; });
}

export const asApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(0, (e as Error)?.message ?? 'Unknown error', 'network'));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, Paged<any>>();

export function getPaged<T>(key: string, make: () => Paged<T>, fresh: boolean): Paged<T> {
  const hit = cache.get(key) as Paged<T> | undefined;
  if (hit && !fresh && hit.status !== 'error') { cache.delete(key); cache.set(key, hit); return hit; }
  const p = make();
  cache.set(key, p);
  while (cache.size > 16) cache.delete(cache.keys().next().value as string);
  return p;
}

export function usePaged<T>(p: Paged<T>): Paged<T> {
  useSyncExternalStore(p.subscribe, p.getVersion);
  useEffect(() => { if (p.status === 'idle') void p.load(); }, [p]);
  return p;
}
