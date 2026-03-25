import type { Channel, ParsedPlaylist } from './m3u-parser';
import { supabase } from '@/integrations/supabase/client';

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
  // Force HTTP always — IPTV providers work on HTTP only
  base = base.replace(/^https:\/\//i, 'http://');
  if (!/^http:\/\//i.test(base)) base = `http://${base}`;
  return base;
}

function apiUrl(base: string, username: string, password: string, action?: string): string {
  const params = `username=${username}&password=${password}`;
  return action
    ? `${base}/player_api.php?${params}&action=${action}`
    : `${base}/player_api.php?${params}`;
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const ts = parseInt(String(value), 10);
  return Number.isNaN(ts) ? null : new Date(ts * 1000).toISOString();
}

/**
 * Try fetching from the Xtream server directly from the browser.
 * This works when:
 *  - Both the app and server use HTTP, or
 *  - The server supports HTTPS, or
 *  - The browser doesn't block the request (mixed content)
 */
async function browserFetch(url: string, timeoutMs = 15000): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Try fetching via Edge Function (server-side proxy).
 * This avoids mixed content but may get blocked by some providers (403).
 */
async function edgeFetch(body: Record<string, any>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('parse-playlist', { body });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || 'Edge function failed');
  return data;
}

// ============ Account Info ============

export async function fetchXtreamAccountInfo(creds: XtreamCredentials): Promise<XtreamAccountInfo> {
  const fallback: XtreamAccountInfo = {
    username: creds.username, status: 'Unknown', expDate: null,
    isTrial: false, activeCons: 0, maxConnections: 1, createdAt: null,
  };

  const base = buildBase(creds.server);
  const url = apiUrl(base, creds.username, creds.password);

  // 1) Try browser direct (user's IP — most reliable)
  try {
    const data = await browserFetch(url, 12000);
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
  } catch (directErr) {
    console.warn('Direct account info failed:', directErr);
  }

  // 2) Fallback: Edge Function
  try {
    const data = await edgeFetch({
      type: 'xtream_account_info',
      server: creds.server,
      username: creds.username,
      password: creds.password,
    });
    return data?.account || fallback;
  } catch (err) {
    console.warn('Edge function account info also failed:', err);
    return fallback;
  }
}

// ============ Playlist ============

export async function fetchXtreamPlaylist(creds: XtreamCredentials): Promise<ParsedPlaylist> {
  const base = buildBase(creds.server);

  // 1) Try browser direct (user's real IP — avoids datacenter IP blocks)
  try {
    const api = (action: string) => apiUrl(base, creds.username, creds.password, action);

    // Fetch live, VOD, and series in parallel
    const [liveCats, liveStreams] = await Promise.all([
      browserFetch(api('get_live_categories')),
      browserFetch(api('get_live_streams'), 20000),
    ]);

    if (!Array.isArray(liveStreams)) throw new Error('Invalid response');

    const liveCatMap = new Map(
      Array.isArray(liveCats) ? liveCats.map((c: any) => [String(c.category_id), c.category_name]) : []
    );

    const channels: Channel[] = liveStreams.map((s: any) => ({
      id: `xt-${s.stream_id}`,
      name: s.name || `Channel ${s.stream_id}`,
      url: `${base}/live/${creds.username}/${creds.password}/${s.stream_id}.ts`,
      logo: s.stream_icon || undefined,
      group: liveCatMap.get(String(s.category_id)) || 'Live',
      tvgId: s.epg_channel_id || undefined,
      type: 'live' as const,
    }));

    // VOD (optional)
    try {
      const [vodCats, vodStreams] = await Promise.all([
        browserFetch(api('get_vod_categories')),
        browserFetch(api('get_vod_streams'), 20000),
      ]);
      if (Array.isArray(vodStreams) && Array.isArray(vodCats)) {
        const vodCatMap = new Map(vodCats.map((c: any) => [String(c.category_id), c.category_name]));
        for (const s of vodStreams) {
          channels.push({
            id: `vod-${s.stream_id}`, name: s.name,
            url: `${base}/movie/${creds.username}/${creds.password}/${s.stream_id}.${s.container_extension || 'mp4'}`,
            logo: s.stream_icon || undefined,
            group: vodCatMap.get(String(s.category_id)) || 'Movies',
            type: 'movie' as const,
          });
        }
      }
    } catch { /* VOD is optional */ }

    // Series (optional)
    try {
      const [serCats, serList] = await Promise.all([
        browserFetch(api('get_series_categories')),
        browserFetch(api('get_series')),
      ]);
      if (Array.isArray(serList) && Array.isArray(serCats)) {
        const serCatMap = new Map(serCats.map((c: any) => [String(c.category_id), c.category_name]));
        for (const s of serList) {
          channels.push({
            id: `ser-${s.series_id}`, name: s.name, url: '',
            logo: s.cover || undefined,
            group: serCatMap.get(String(s.category_id)) || 'Series',
            type: 'series' as const,
          });
        }
      }
    } catch { /* Series is optional */ }

    const categories = Array.from(new Set(channels.map(c => c.group!).filter(Boolean))).sort();
    return { channels, categories };

  } catch (directErr) {
    console.warn('Browser direct Xtream fetch failed:', directErr);
  }

  // 2) Fallback: Edge Function
  try {
    const data = await edgeFetch({
      type: 'xtream',
      server: creds.server,
      username: creds.username,
      password: creds.password,
    });
    return data as ParsedPlaylist;
  } catch (edgeErr) {
    throw new Error(
      `فشل الاتصال بالمزود.\n\n` +
      `السبب المحتمل: التطبيق يعمل على HTTPS والمزود على HTTP (محتوى مختلط).\n\n` +
      `الحل: حمّل ملف M3U من الزر أدناه وارفعه في تبويب "File".`
    );
  }
}
