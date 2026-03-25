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
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  return base;
}

function buildApiUrl(base: string, username: string, password: string, action?: string): string {
  const params = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  if (action) return `${base}/player_api.php?${params}&action=${action}`;
  return `${base}/player_api.php?${params}`;
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const ts = parseInt(String(value), 10);
  return Number.isNaN(ts) ? null : new Date(ts * 1000).toISOString();
}

function parseAccountInfo(data: any, fallbackUsername: string): XtreamAccountInfo {
  const info = data?.user_info || {};
  return {
    username: info.username || fallbackUsername,
    status: info.status || 'Unknown',
    expDate: toIsoDate(info.exp_date),
    isTrial: info.is_trial === '1' || info.is_trial === true,
    activeCons: parseInt(info.active_cons, 10) || 0,
    maxConnections: parseInt(info.max_connections, 10) || 1,
    createdAt: toIsoDate(info.created_at),
    message: info.message || undefined,
  };
}

/**
 * Try direct browser fetch first (user's real IP, bypasses Cloudflare datacenter blocks).
 * Falls back to edge function if direct fetch fails.
 */
async function directFetch(url: string, timeoutMs = 12000): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}

export async function fetchXtreamAccountInfo(creds: XtreamCredentials): Promise<XtreamAccountInfo> {
  const fallback: XtreamAccountInfo = {
    username: creds.username, status: 'Unknown', expDate: null,
    isTrial: false, activeCons: 0, maxConnections: 1, createdAt: null,
  };

  const base = buildBase(creds.server);
  const url = buildApiUrl(base, creds.username, creds.password);

  // 1) Try direct from browser (user's IP)
  try {
    const res = await directFetch(url);
    if (res.ok) {
      const data = await res.json();
      return parseAccountInfo(data, creds.username);
    }
  } catch (err) {
    console.warn('Direct Xtream account info failed:', err);
  }

  // 2) Fallback to edge function
  try {
    const { data, error } = await supabase.functions.invoke('parse-playlist', {
      body: { type: 'xtream_account_info', server: creds.server, username: creds.username, password: creds.password },
    });
    if (error) throw error;
    if (data?.ok === false) return data.account || fallback;
    return data?.account || fallback;
  } catch (err) {
    console.warn('Edge function account info also failed:', err);
    return fallback;
  }
}

export async function fetchXtreamPlaylist(creds: XtreamCredentials): Promise<ParsedPlaylist> {
  const base = buildBase(creds.server);

  // 1) Try direct browser fetch first (user's real IP)
  try {
    const [catsRes, streamsRes] = await Promise.all([
      directFetch(buildApiUrl(base, creds.username, creds.password, 'get_live_categories')),
      directFetch(buildApiUrl(base, creds.username, creds.password, 'get_live_streams'), 20000),
    ]);

    if (catsRes.ok && streamsRes.ok) {
      const categories: any[] = await catsRes.json();
      const streams: any[] = await streamsRes.json();

      if (Array.isArray(categories) && Array.isArray(streams)) {
        const catMap = new Map(categories.map((c: any) => [c.category_id, c.category_name]));

        const liveChannels: Channel[] = streams.map((s: any) => ({
          id: `xt-${s.stream_id}`,
          name: s.name,
          url: `${base}/live/${creds.username}/${creds.password}/${s.stream_id}.ts`,
          logo: s.stream_icon || undefined,
          group: catMap.get(s.category_id) || 'Uncategorized',
          tvgId: s.epg_channel_id || undefined,
          type: 'live' as const,
        }));

        // VOD
        let vodChannels: Channel[] = [];
        try {
          const [vodCatsRes, vodStreamsRes] = await Promise.all([
            directFetch(buildApiUrl(base, creds.username, creds.password, 'get_vod_categories')),
            directFetch(buildApiUrl(base, creds.username, creds.password, 'get_vod_streams'), 20000),
          ]);
          if (vodCatsRes.ok && vodStreamsRes.ok) {
            const vodCats: any[] = await vodCatsRes.json();
            const vodStreams: any[] = await vodStreamsRes.json();
            if (Array.isArray(vodCats) && Array.isArray(vodStreams)) {
              const vodCatMap = new Map(vodCats.map((c: any) => [c.category_id, c.category_name]));
              vodChannels = vodStreams.map((s: any) => ({
                id: `vod-${s.stream_id}`,
                name: s.name,
                url: `${base}/movie/${creds.username}/${creds.password}/${s.stream_id}.${s.container_extension || 'mp4'}`,
                logo: s.stream_icon || undefined,
                group: vodCatMap.get(s.category_id) || 'VOD',
                type: 'movie' as const,
              }));
            }
          }
        } catch { /* optional */ }

        // Series
        let seriesChannels: Channel[] = [];
        try {
          const [serCatsRes, serStreamsRes] = await Promise.all([
            directFetch(buildApiUrl(base, creds.username, creds.password, 'get_series_categories')),
            directFetch(buildApiUrl(base, creds.username, creds.password, 'get_series')),
          ]);
          if (serCatsRes.ok && serStreamsRes.ok) {
            const serCats: any[] = await serCatsRes.json();
            const serStreams: any[] = await serStreamsRes.json();
            if (Array.isArray(serCats) && Array.isArray(serStreams)) {
              const serCatMap = new Map(serCats.map((c: any) => [c.category_id, c.category_name]));
              seriesChannels = serStreams.map((s: any) => ({
                id: `ser-${s.series_id}`,
                name: s.name,
                url: '',
                logo: s.cover || undefined,
                group: serCatMap.get(s.category_id) || 'Series',
                type: 'series' as const,
              }));
            }
          }
        } catch { /* optional */ }

        const allChannels = [...liveChannels, ...vodChannels, ...seriesChannels];
        return {
          channels: allChannels,
          categories: Array.from(new Set(allChannels.map(c => c.group!))).filter(Boolean).sort(),
        };
      }
    }
    // If we got non-ok responses, fall through to edge function
    throw new Error(`Direct API returned ${catsRes.status}/${streamsRes.status}`);
  } catch (directErr) {
    console.warn('Direct Xtream fetch failed, trying edge function:', directErr);
  }

  // 2) Fallback to edge function (for cases where direct works but CORS blocks, etc.)
  const { data, error } = await supabase.functions.invoke('parse-playlist', {
    body: { type: 'xtream', server: creds.server, username: creds.username, password: creds.password },
  });

  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || 'Provider error');
  return data as ParsedPlaylist;
}
