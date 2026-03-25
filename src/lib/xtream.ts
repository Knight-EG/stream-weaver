import type { Channel, ParsedPlaylist } from './m3u-parser';
import { supabase } from '@/integrations/supabase/client';
  username: string;
  password: string;
}

export interface XtreamAccountInfo {
  username: string;
  status: string;
  expDate: string | null; // ISO date string
  isTrial: boolean;
  activeCons: number;
  maxConnections: number;
  createdAt: string | null;
  message?: string;
}

interface XtreamCategory {
  category_id: string;
  category_name: string;
}

interface XtreamStream {
  num: number;
  name: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  category_id: string;
  stream_type?: string;
}

function buildUrl(creds: XtreamCredentials, action?: string): string {
  const base = creds.server.replace(/\/$/, '');
  const prefix = /^https?:\/\//i.test(base) ? base : `http://${base}`;
  const params = `username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`;
  return action
    ? `${prefix}/player_api.php?${params}&action=${action}`
    : `${prefix}/player_api.php?${params}`;
}

/**
 * Fetch account info from Xtream Codes provider.
 * GET /player_api.php?username=X&password=X (no action) returns user_info.
 */
export async function fetchXtreamAccountInfo(creds: XtreamCredentials): Promise<XtreamAccountInfo> {
  try {
    const res = await fetch(buildUrl(creds));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const info = data.user_info || {};
    
    let expDate: string | null = null;
    if (info.exp_date) {
      // exp_date is usually a Unix timestamp (seconds)
      const ts = parseInt(info.exp_date, 10);
      if (!isNaN(ts)) {
        expDate = new Date(ts * 1000).toISOString();
      }
    }

    let createdAt: string | null = null;
    if (info.created_at) {
      const ts = parseInt(info.created_at, 10);
      if (!isNaN(ts)) createdAt = new Date(ts * 1000).toISOString();
    }

    return {
      username: info.username || creds.username,
      status: info.status || 'Unknown',
      expDate,
      isTrial: info.is_trial === '1' || info.is_trial === true,
      activeCons: parseInt(info.active_cons, 10) || 0,
      maxConnections: parseInt(info.max_connections, 10) || 1,
      createdAt,
      message: info.message || data.server_info?.server_protocol,
    };
  } catch (err) {
    console.warn('Failed to fetch Xtream account info:', err);
    return {
      username: creds.username,
      status: 'Unknown',
      expDate: null,
      isTrial: false,
      activeCons: 0,
      maxConnections: 1,
      createdAt: null,
    };
  }
}

export async function fetchXtreamPlaylist(creds: XtreamCredentials): Promise<ParsedPlaylist> {
  const [catsRes, streamsRes] = await Promise.all([
    fetch(buildUrl(creds, 'get_live_categories')),
    fetch(buildUrl(creds, 'get_live_streams')),
  ]);

  const categories: XtreamCategory[] = await catsRes.json();
  const streams: XtreamStream[] = await streamsRes.json();

  const catMap = new Map(categories.map(c => [c.category_id, c.category_name]));
  const base = creds.server.replace(/\/$/, '');
  const prefix = /^https?:\/\//i.test(base) ? base : `http://${base}`;

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
