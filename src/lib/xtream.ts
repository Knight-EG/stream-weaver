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
 * Fetch account info via Edge Function (avoids mixed content & CORS issues).
 */
export async function fetchXtreamAccountInfo(creds: XtreamCredentials): Promise<XtreamAccountInfo> {
  const fallback: XtreamAccountInfo = {
    username: creds.username, status: 'Unknown', expDate: null,
    isTrial: false, activeCons: 0, maxConnections: 1, createdAt: null,
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
    return data?.account || fallback;
  } catch (err) {
    console.warn('Account info fetch failed:', err);
    return fallback;
  }
}

/**
 * Fetch full Xtream playlist via Edge Function.
 * Uses player_api.php with actions (get_live_streams, get_vod_streams, get_series).
 */
export async function fetchXtreamPlaylist(creds: XtreamCredentials): Promise<ParsedPlaylist> {
  const { data, error } = await supabase.functions.invoke('parse-playlist', {
    body: {
      type: 'xtream',
      server: creds.server,
      username: creds.username,
      password: creds.password,
    },
  });

  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || 'فشل الاتصال بالمزود');
  return data as ParsedPlaylist;
}
