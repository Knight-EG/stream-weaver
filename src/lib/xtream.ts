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

// Cache the user's public IP
let cachedClientIp: string | null = null;

async function getClientIp(): Promise<string | null> {
  if (cachedClientIp) return cachedClientIp;
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    cachedClientIp = data.ip || null;
    return cachedClientIp;
  } catch {
    return null;
  }
}

function buildEdgeFunctionHeaders(clientIp: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (clientIp) {
    headers['x-client-ip'] = clientIp;
  }
  return headers;
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

  const clientIp = await getClientIp();

  try {
    const { data, error } = await supabase.functions.invoke('parse-playlist', {
      body: {
        type: 'xtream_account_info',
        server: creds.server,
        username: creds.username,
        password: creds.password,
      },
      headers: buildEdgeFunctionHeaders(clientIp),
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
  const clientIp = await getClientIp();

  const { data, error } = await supabase.functions.invoke('parse-playlist', {
    body: {
      type: 'xtream',
      server: creds.server,
      username: creds.username,
      password: creds.password,
    },
    headers: buildEdgeFunctionHeaders(clientIp),
  });

  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || 'Provider error');

  return data as ParsedPlaylist;
}
