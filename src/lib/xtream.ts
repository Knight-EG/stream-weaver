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

/**
 * Fetch account info via the edge function (avoids CORS/mixed-content issues).
 */
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
      return data.account || fallback;
    }

    return data?.account || fallback;
  } catch (err) {
    console.warn('Failed to fetch Xtream account info:', err);
    return fallback;
  }
}

export async function fetchXtreamPlaylist(creds: XtreamCredentials): Promise<ParsedPlaylist> {
  // This is the client-side fallback - most connections go through the edge function
  const base = creds.server.replace(/\/$/, '');
  const prefix = /^https?:\/\//i.test(base) ? base : `http://${base}`;

  const buildUrl = (action: string) =>
    `${prefix}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&action=${action}`;

  const [catsRes, streamsRes] = await Promise.all([
    fetch(buildUrl('get_live_categories')),
    fetch(buildUrl('get_live_streams')),
  ]);

  const categories: { category_id: string; category_name: string }[] = await catsRes.json();
  const streams: any[] = await streamsRes.json();

  const catMap = new Map(categories.map(c => [c.category_id, c.category_name]));

  const channels: Channel[] = streams.map((s) => ({
    id: `xt-${s.stream_id}`,
    name: s.name,
    url: `${prefix}/live/${creds.username}/${creds.password}/${s.stream_id}.m3u8`,
    logo: s.stream_icon || undefined,
    group: catMap.get(s.category_id) || 'Uncategorized',
    tvgId: s.epg_channel_id || undefined,
    type: 'live' as const,
  }));

  return {
    channels,
    categories: Array.from(new Set(channels.map(c => c.group!))).filter(Boolean).sort(),
  };
}
