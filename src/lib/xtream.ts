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
 * All Xtream requests go through the Edge Function (backend proxy).
 * The Edge Function can set proper User-Agent headers (IPTVSmartersPro)
 * which browsers cannot do. This avoids 403 blocks from providers.
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
    if (data?.ok === false) {
      console.warn('Xtream account info error:', data.error);
      return data.account || fallback;
    }
    return data?.account || fallback;
  } catch (err) {
    console.warn('Edge function account info failed:', err);
    return fallback;
  }
}

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
  if (data?.ok === false) throw new Error(data.error || 'Provider error');
  return data as ParsedPlaylist;
}
