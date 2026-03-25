import type { Channel, ParsedPlaylist } from './m3u-parser';

const CACHE_PREFIX = 'iptv_playlist_';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  data: ParsedPlaylist;
  timestamp: number;
  channelCount: number;
}

function getCacheKey(source: string): string {
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  return CACHE_PREFIX + Math.abs(hash).toString(36);
}

export function getCachedPlaylist(source: string): ParsedPlaylist | null {
  try {
    const key = getCacheKey(source);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCachedPlaylist(source: string, data: ParsedPlaylist): void {
  try {
    const key = getCacheKey(source);
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      channelCount: data.channels.length,
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage full — evict old caches
    evictOldCaches();
  }
}

function evictOldCaches(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
  }
  // Remove all playlist caches
  keys.forEach(k => localStorage.removeItem(k));
}

/**
 * For very large playlists (50k+), we chunk channels into pages.
 * This avoids rendering all channels at once.
 */
export function paginateChannels(channels: Channel[], page: number, pageSize: number = 100): {
  items: Channel[];
  totalPages: number;
  hasMore: boolean;
} {
  const start = page * pageSize;
  const items = channels.slice(start, start + pageSize);
  const totalPages = Math.ceil(channels.length / pageSize);
  return {
    items,
    totalPages,
    hasMore: start + pageSize < channels.length,
  };
}

/**
 * Build a category index for fast filtering without scanning all channels.
 */
export function buildCategoryIndex(channels: Channel[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  channels.forEach((ch, i) => {
    const group = ch.group || 'Uncategorized';
    const arr = index.get(group) || [];
    arr.push(i);
    index.set(group, arr);
  });
  return index;
}

/**
 * Search channels using a pre-built lowercase name index for O(1) lookup.
 */
export function buildSearchIndex(channels: Channel[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  channels.forEach((ch, i) => {
    const words = ch.name.toLowerCase().split(/\s+/);
    words.forEach(word => {
      const prefix = word.substring(0, 3);
      const arr = index.get(prefix) || [];
      arr.push(i);
      index.set(prefix, arr);
    });
  });
  return index;
}
