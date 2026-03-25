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

class XtreamConnectionError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'XtreamConnectionError';
  }
}

function isSecureBrowserContext(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
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

function canUseBrowserDirect(server: string): boolean {
  if (!isSecureBrowserContext()) return true;
  return /^https:\/\//i.test(server.trim());
}

function getMixedContentMessage(): string {
  return 'هذا المزود يعمل عبر HTTP فقط، والمتصفح يمنع الاتصال المباشر لأن التطبيق يعمل على HTTPS.';
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

export async function fetchXtreamAccountInfo(creds: XtreamCredentials): Promise<XtreamAccountInfo> {
  const fallback: XtreamAccountInfo = {
    username: creds.username,
    status: 'Unknown',
    expDate: null,
    isTrial: false,
    activeCons: 0,
    maxConnections: 1,
    createdAt: null,
  };

  const directAllowed = canUseBrowserDirect(creds.server);

  if (directAllowed) {
    try {
      const base = buildBase(creds.server);
      const url = buildApiUrl(base, creds.username, creds.password);
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new XtreamConnectionError('DIRECT_ACCOUNT_FAILED', `Account info request returned ${res.status}`);
      const data = await res.json();
      return parseAccountInfo(data, creds.username);
    } catch (err) {
      console.warn('Direct Xtream account info failed, trying edge function:', err);
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke('parse-playlist', {
      body: {
        type: 'xtream_account_info',
        server: creds.server,
        username: creds.username,
        password: creds.password,
      },
    });

    if (error) throw error;
    if (data?.ok === false) {
      console.warn('Xtream account info error:', data.error);
      if (!directAllowed) {
        return {
          ...(data.account || fallback),
          status: 'Unavailable',
          message: `${getMixedContentMessage()} والسيرفر الخلفي راجع 403 من المزود.`,
        };
      }
      return data.account || fallback;
    }

    return data?.account || fallback;
  } catch (err) {
    console.warn('Edge function account info also failed:', err);
    if (!directAllowed) {
      return {
        ...fallback,
        status: 'Unavailable',
        message: `${getMixedContentMessage()} والمزود لا يسمح بالاتصال من السيرفر الخلفي.`,
      };
    }
    return fallback;
  }
}

export async function fetchXtreamPlaylist(creds: XtreamCredentials): Promise<ParsedPlaylist> {
  if (!canUseBrowserDirect(creds.server)) {
    throw new XtreamConnectionError('DIRECT_HTTP_BLOCKED', getMixedContentMessage());
  }

  const base = buildBase(creds.server);
  const buildUrl = (action: string) => buildApiUrl(base, creds.username, creds.password, action);

  const [catsRes, streamsRes] = await Promise.all([
    fetch(buildUrl('get_live_categories'), { signal: AbortSignal.timeout(15000) }),
    fetch(buildUrl('get_live_streams'), { signal: AbortSignal.timeout(15000) }),
  ]);

  if (!catsRes.ok || !streamsRes.ok) {
    throw new XtreamConnectionError('DIRECT_PLAYLIST_FAILED', `Xtream direct request failed (${catsRes.status}/${streamsRes.status})`);
  }

  const categories: any[] = await catsRes.json();
  const streams: any[] = await streamsRes.json();
  const catMap = new Map((Array.isArray(categories) ? categories : []).map((c: any) => [c.category_id, c.category_name]));

  const liveChannels: Channel[] = (Array.isArray(streams) ? streams : []).map((s: any) => ({
    id: `xt-${s.stream_id}`,
    name: s.name,
    url: `${base}/live/${creds.username}/${creds.password}/${s.stream_id}.m3u8`,
    logo: s.stream_icon || undefined,
    group: catMap.get(s.category_id) || 'Uncategorized',
    tvgId: s.epg_channel_id || undefined,
    type: 'live' as const,
  }));

  let vodChannels: Channel[] = [];
  try {
    const [vodCatsRes, vodStreamsRes] = await Promise.all([
      fetch(buildUrl('get_vod_categories'), { signal: AbortSignal.timeout(15000) }),
      fetch(buildUrl('get_vod_streams'), { signal: AbortSignal.timeout(15000) }),
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
  } catch {
    // optional
  }

  let seriesChannels: Channel[] = [];
  try {
    const [serCatsRes, serStreamsRes] = await Promise.all([
      fetch(buildUrl('get_series_categories'), { signal: AbortSignal.timeout(15000) }),
      fetch(buildUrl('get_series'), { signal: AbortSignal.timeout(15000) }),
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
  } catch {
    // optional
  }

  const allChannels = [...liveChannels, ...vodChannels, ...seriesChannels];
  return {
    channels: allChannels,
    categories: Array.from(new Set(allChannels.map(c => c.group!))).filter(Boolean).sort(),
  };
}
