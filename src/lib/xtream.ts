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

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const ts = parseInt(String(value), 10);
  return Number.isNaN(ts) ? null : new Date(ts * 1000).toISOString();
}

/**
 * We ALWAYS use the edge function for Xtream Codes.
 * Why? Because browsers block custom User-Agents (403) and HTTP/HTTPS mixed content.
 * The Edge function (Deno) can mimic Smarters/VLC perfectly.
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
        password: creds.password 
      },
    });

    if (error) throw error;
    if (data?.ok === false) return data.account || fallback;
    return data?.account || fallback;
  } catch (err) {
    console.warn('Xtream account info failed via edge function:', err);
    return fallback;
  }
}

export async function fetchXtreamPlaylist(creds: XtreamCredentials): Promise<ParsedPlaylist> {
  const { data, error } = await supabase.functions.invoke('parse-playlist', {
    body: { 
      type: 'xtream', 
      server: creds.server, 
      username: creds.username, 
      password: creds.password 
    },
  });

  if (error) {
    console.error('Edge function error:', error);
    throw new Error('Failed to connect to provider. Check your credentials or server URL.');
  }

  if (data?.ok === false) {
    throw new Error(data.error || 'Provider rejected the connection (403/400).');
  }

  return data as ParsedPlaylist;
}
