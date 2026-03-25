import type { Channel, ParsedPlaylist } from './m3u-parser';

export interface XtreamCredentials {
  server: string;
  username: string;
  password: string;
}

export interface XtreamAccountInfo {
  username: string;
  status: string;
  expDate: string | null;
  isTrial: boolean;
  activeCons: number;
  maxConnections: number;
  createdAt: string | null;
  message?: string;
}

function buildBase(server: string): string {
  let base = server.trim().replace(/\/$/, '');
  base = base.replace(/^https:\/\//i, 'http://');
  if (!/^http:\/\//i.test(base)) base = `http://${base}`;
  return base;
}

function extractHostname(server: string): string {
  try {
    return new URL(buildBase(server)).hostname;
  } catch {
    return server.replace(/^https?:\/\//i, '').split(':')[0].split('/')[0];
  }
}

/** Use the server URL as-is — don't guess ports */
function getAlternativeBases(server: string): string[] {
  return [buildBase(server)];
}

function apiPath(username: string, password: string, action?: string): string {
  const params = `username=${username}&password=${password}`;
  return action
    ? `/player_api.php?${params}&action=${action}`
    : `/player_api.php?${params}`;
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const ts = parseInt(String(value), 10);
  return Number.isNaN(ts) ? null : new Date(ts * 1000).toISOString();
}

/** Check if we need a CORS proxy (running on HTTPS but target is HTTP) */
function needsProxy(): boolean {
  if (typeof window === 'undefined') return false;
  const proto = window.location.protocol;
  // On HTTP, file://, or localhost — direct connection works fine
  return proto === 'https:';
}

const CORS_PROXIES = [
  (url: string) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    return `https://${projectId}.supabase.co/functions/v1/cors-proxy?url=${encodeURIComponent(url)}`;
  },
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

/** Wrap URL with CORS proxy if needed (HTTPS → HTTP) */
function proxyUrl(url: string): string {
  if (!needsProxy()) return url;
  return CORS_PROXIES[0](url);
}

/**
 * Fetch from user's browser. Uses CORS proxy automatically when on HTTPS.
 * On TV/HTTP — connects directly without any proxy.
 */
async function directFetch(url: string, timeoutMs = 20000): Promise<any> {
  const finalUrl = proxyUrl(url);
  const res = await fetch(finalUrl, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Try multiple base URLs until one works, with proxy fallback on HTTPS */
async function fetchWithFallback(path: string, server: string): Promise<any> {
  const bases = getAlternativeBases(server);
  let lastError: Error | null = null;

  // Try each base with default proxy strategy
  for (const base of bases) {
    try {
      return await directFetch(`${base}${path}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Failed ${base}${path}:`, lastError.message);
    }
  }

  // If on HTTPS and first proxy failed, try second proxy
  if (needsProxy() && CORS_PROXIES.length > 1) {
    for (const base of bases) {
      try {
        const url = CORS_PROXIES[1](`${base}${path}`);
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) continue;
        return await res.json();
      } catch { /* try next */ }
    }
  }
  throw lastError || new Error('All connection attempts failed');
}

// ============ Account Info ============

export async function fetchXtreamAccountInfo(creds: XtreamCredentials): Promise<XtreamAccountInfo> {
  const fallback: XtreamAccountInfo = {
    username: creds.username, status: 'Unknown', expDate: null,
    isTrial: false, activeCons: 0, maxConnections: 1, createdAt: null,
  };

  try {
    const path = apiPath(creds.username, creds.password);
    const data = await fetchWithFallback(path, creds.server);
    const info = data?.user_info || {};
    return {
      username: info.username || creds.username,
      status: info.status || 'Unknown',
      expDate: toIsoDate(info.exp_date),
      isTrial: info.is_trial === '1' || info.is_trial === true,
      activeCons: parseInt(info.active_cons, 10) || 0,
      maxConnections: parseInt(info.max_connections, 10) || 1,
      createdAt: toIsoDate(info.created_at),
      message: info.message || undefined,
    };
  } catch (err) {
    console.warn('Account info failed:', err);
    return fallback;
  }
}

// ============ Playlist ============

export async function fetchXtreamPlaylist(creds: XtreamCredentials): Promise<ParsedPlaylist> {
  // Find a working base URL
  const path = apiPath(creds.username, creds.password);
  let workingBase = '';
  const bases = getAlternativeBases(creds.server);

  for (const base of bases) {
    try {
      const data = await directFetch(`${base}${path}`, 15000);
      if (data?.user_info) {
        workingBase = base;
        break;
      }
    } catch {
      // try next
    }
  }

  if (!workingBase) {
    throw new Error(
      'فشل الاتصال بالمزود.\n' +
      'تأكد من صحة بيانات الدخول أو جرب رفع ملف M3U من تبويب "Upload File".'
    );
  }

  const api = `${workingBase}${path}`;

  // Fetch all data in parallel from user's browser directly
  const [liveCats, liveStreams, vodCats, vodStreams, serCats, serList] = await Promise.all([
    directFetch(`${api}&action=get_live_categories`).catch(() => []),
    directFetch(`${api}&action=get_live_streams`, 30000).catch(() => []),
    directFetch(`${api}&action=get_vod_categories`).catch(() => []),
    directFetch(`${api}&action=get_vod_streams`, 30000).catch(() => []),
    directFetch(`${api}&action=get_series_categories`).catch(() => []),
    directFetch(`${api}&action=get_series`).catch(() => []),
  ]);

  const channels: Channel[] = [];

  // Live
  if (Array.isArray(liveStreams) && Array.isArray(liveCats)) {
    const catMap = new Map(liveCats.map((c: any) => [String(c.category_id), c.category_name || 'Live']));
    for (const s of liveStreams) {
      if (!s.stream_id) continue;
      channels.push({
        id: `xt-${s.stream_id}`,
        name: s.name || `Channel ${s.stream_id}`,
        url: `${workingBase}/live/${creds.username}/${creds.password}/${s.stream_id}.ts`,
        logo: s.stream_icon || undefined,
        group: catMap.get(String(s.category_id)) || 'Live',
        tvgId: s.epg_channel_id || undefined,
        type: 'live' as const,
      });
    }
  }

  // VOD
  if (Array.isArray(vodStreams) && Array.isArray(vodCats)) {
    const catMap = new Map(vodCats.map((c: any) => [String(c.category_id), c.category_name || 'Movies']));
    for (const s of vodStreams) {
      if (!s.stream_id) continue;
      channels.push({
        id: `vod-${s.stream_id}`,
        name: s.name || `Movie ${s.stream_id}`,
        url: `${workingBase}/movie/${creds.username}/${creds.password}/${s.stream_id}.${s.container_extension || 'mp4'}`,
        logo: s.stream_icon || undefined,
        group: catMap.get(String(s.category_id)) || 'Movies',
        type: 'movie' as const,
      });
    }
  }

  // Series
  if (Array.isArray(serList) && Array.isArray(serCats)) {
    const catMap = new Map(serCats.map((c: any) => [String(c.category_id), c.category_name || 'Series']));
    for (const s of serList) {
      if (!s.series_id) continue;
      channels.push({
        id: `ser-${s.series_id}`,
        name: s.name || `Series ${s.series_id}`,
        url: '',
        logo: s.cover || undefined,
        group: catMap.get(String(s.category_id)) || 'Series',
        type: 'series' as const,
      });
    }
  }

  if (channels.length === 0) {
    throw new Error('لم يتم العثور على أي قنوات. تأكد من صحة بيانات الدخول.');
  }

  const categories = Array.from(new Set(channels.map(c => c.group!).filter(Boolean))).sort();
  return { channels, categories };
}
