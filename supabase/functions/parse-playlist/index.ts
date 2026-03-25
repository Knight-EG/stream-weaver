import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-ip',
};

interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  type: 'live' | 'movie' | 'series';
}

class PlaylistProviderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'PlaylistProviderError';
  }
}

// Fixed User-Agents to mimic IPTV Smarters Pro and VLC perfectly
const userAgents = [
  'IPTVSmartersPro',                     // Best for 403 bypass
  'IPTVSmarts',                          // Legacy Smarters
  'VLC/3.0.18 LibVLC/3.0.18',            // VLC media player
  'Dalvik/2.1.0 (Linux; U; Android 12; SM-G991B)', // Android default player
];

function getUpstreamHeaders(agentIndex: number): Record<string, string> {
  return {
    'Accept': '*/*',
    'User-Agent': userAgents[agentIndex % userAgents.length],
    'Connection': 'keep-alive',
    // DO NOT forward X-Forwarded-For as some IPTV panels block proxies/datacenter IPs
  };
}

function isTlsCertificateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return lower.includes('invalid peer certificate') || lower.includes('causedasendentity');
}

function toHttpUrl(url: string): string | null {
  return url.startsWith('https://') ? `http://${url.slice('https://'.length)}` : null;
}

function safeJsonParse<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const trimmed = content.trim();
    if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
      throw new PlaylistProviderError('UPSTREAM_INVALID_RESPONSE', `Provider returned HTML (403/400). It may be blocking this server's IP.`);
    }
    throw new PlaylistProviderError('UPSTREAM_INVALID_RESPONSE', `Provider returned invalid JSON.`);
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fetchUpstreamText(url: string, agentIndex: number): Promise<{ response: Response; text: string }> {
  const headers = getUpstreamHeaders(agentIndex);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, { headers, redirect: 'follow', signal: controller.signal });
    clearTimeout(timeout);
    const text = await response.text();
    return { response, text };
  } catch (error) {
    const httpFallbackUrl = toHttpUrl(url);
    if (httpFallbackUrl && isTlsCertificateError(error)) {
      const response = await fetch(httpFallbackUrl, { headers, redirect: 'follow' });
      const text = await response.text();
      return { response, text };
    }
    throw error;
  }
}

async function fetchWithRetry(url: string): Promise<{ response: Response; text: string }> {
  let lastError: Error | null = null;
  for (let i = 0; i < userAgents.length; i++) {
    try {
      const result = await fetchUpstreamText(url, i);
      if (result.response.status === 403 && i < userAgents.length - 1) continue;
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError || new Error('All fetch attempts failed');
}

function buildXtreamUrl(base: string, username: string, password: string, action?: string): string {
  // Use simple encoding for credentials as complex encoding can trigger 400 on old panels
  const u = encodeURIComponent(username);
  const p = encodeURIComponent(password);
  const baseApi = `${base}/player_api.php?username=${u}&password=${p}`;
  return action ? `${baseApi}&action=${action}` : baseApi;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { 
      global: { headers: { Authorization: authHeader } } 
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const { type, username, password, server } = body;

    if (!type || !server || !username || !password) {
      return jsonResponse({ error: 'Missing credentials' }, 400);
    }

    const base = server.replace(/\/$/, '');
    const finalBase = /^https?:\/\//i.test(base) ? base : `http://${base}`;

    if (type === 'xtream_account_info') {
      const { response, text } = await fetchWithRetry(buildXtreamUrl(finalBase, username, password));
      if (!response.ok) return jsonResponse({ ok: false, error: `Provider returned ${response.status}` });
      const data = safeJsonParse<any>(text);
      const info = data.user_info || {};
      const toIso = (v: any) => { const ts = parseInt(v, 10); return isNaN(ts) ? null : new Date(ts * 1000).toISOString(); };
      return jsonResponse({
        ok: true,
        account: {
          username: info.username || username,
          status: info.status || 'Unknown',
          expDate: info.exp_date ? toIso(info.exp_date) : null,
          isTrial: info.is_trial === '1' || info.is_trial === true,
          activeCons: parseInt(info.active_cons, 10) || 0,
          maxConnections: parseInt(info.max_connections, 10) || 1,
          createdAt: info.created_at ? toIso(info.created_at) : null,
        },
      });
    }

    if (type === 'xtream') {
      const [catsRes, streamsRes] = await Promise.all([
        fetchWithRetry(buildXtreamUrl(finalBase, username, password, 'get_live_categories')),
        fetchWithRetry(buildXtreamUrl(finalBase, username, password, 'get_live_streams')),
      ]);

      if (!catsRes.response.ok || !streamsRes.response.ok) {
        throw new PlaylistProviderError('PROVIDER_ERROR', `API Error: ${catsRes.response.status}/${streamsRes.response.status}`);
      }

      const categories = safeJsonParse<any[]>(catsRes.text);
      const streams = safeJsonParse<any[]>(streamsRes.text);
      const catMap = new Map(categories.map((c: any) => [c.category_id, c.category_name]));

      const channels: Channel[] = streams.map((s: any) => ({
        id: `xt-${s.stream_id}`,
        name: s.name,
        url: `${finalBase}/live/${username}/${password}/${s.stream_id}.ts`,
        logo: s.stream_icon || undefined,
        group: catMap.get(s.category_id) || 'Uncategorized',
        type: 'live' as const,
      }));

      return jsonResponse({
        ok: true,
        channels,
        categories: Array.from(new Set(channels.map(c => c.group!))).filter(Boolean).sort(),
      });
    }

    return jsonResponse({ error: 'Invalid type' }, 400);
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }
});
