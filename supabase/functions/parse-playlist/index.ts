import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

// Use User-Agent strings that mimic common IPTV apps to avoid provider blocks
const userAgents = [
  'IPTVSmarters/1.0',
  'TiviMate/4.5.0',
  'okhttp/4.9.3',
  'Dalvik/2.1.0 (Linux; U; Android 12)',
];

function getUpstreamHeaders(agentIndex = 0): Record<string, string> {
  return {
    'Accept': '*/*',
    'User-Agent': userAgents[agentIndex % userAgents.length],
    'Connection': 'keep-alive',
  };
}

function isTlsCertificateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return lower.includes('invalid peer certificate')
    || lower.includes('causedasendentity')
    || lower.includes('certificate subject name');
}

function toHttpUrl(url: string): string | null {
  return url.startsWith('https://') ? `http://${url.slice('https://'.length)}` : null;
}

function looksLikeHtml(content: string): boolean {
  const trimmed = content.trim().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<body') || trimmed.startsWith('<');
}

function safeJsonParse<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const snippet = content.slice(0, 160).replace(/\s+/g, ' ').trim();
    if (looksLikeHtml(content)) {
      throw new PlaylistProviderError('UPSTREAM_INVALID_RESPONSE', `Xtream provider returned HTML instead of JSON. It may be blocking remote requests or the server URL/credentials are invalid. Response preview: ${snippet}`);
    }
    throw new PlaylistProviderError('UPSTREAM_INVALID_RESPONSE', `Xtream provider returned invalid JSON. Response preview: ${snippet}`);
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fetchUpstreamText(url: string, agentIndex = 0): Promise<{ response: Response; text: string }> {
  const headers = getUpstreamHeaders(agentIndex);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await response.text();
    return { response, text };
  } catch (error) {
    const httpFallbackUrl = toHttpUrl(url);

    if (httpFallbackUrl && (isTlsCertificateError(error) || (error instanceof DOMException && error.name === 'AbortError'))) {
      console.warn(`Fetch failed for ${url} (${error instanceof Error ? error.message : 'timeout'}). Retrying over HTTP.`);
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 25000);
      const response = await fetch(httpFallbackUrl, {
        headers,
        redirect: 'follow',
        signal: controller2.signal,
      });
      clearTimeout(timeout2);

      const text = await response.text();
      return { response, text };
    }

    throw error;
  }
}

// Try fetching with multiple User-Agent strings until one works
async function fetchWithRetry(url: string, maxRetries = 3): Promise<{ response: Response; text: string }> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await fetchUpstreamText(url, i);
      // If we got a 403, try next User-Agent
      if (result.response.status === 403 && i < maxRetries - 1) {
        console.log(`Got 403 with agent ${i}, trying next User-Agent...`);
        continue;
      }
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Fetch attempt ${i + 1} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('All fetch attempts failed');
}

function parseM3U(content: string): { channels: Channel[]; categories: string[] } {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const channels: Channel[] = [];
  const categorySet = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXTINF:')) continue;
    const info = lines[i];
    const url = lines[i + 1];
    if (!url || url.startsWith('#')) continue;

    const nameMatch = info.match(/,(.+)$/);
    const logoMatch = info.match(/tvg-logo="([^"]*)"/);
    const groupMatch = info.match(/group-title="([^"]*)"/);

    const name = nameMatch?.[1]?.trim() || 'Unknown';
    const group = groupMatch?.[1] || 'Uncategorized';
    categorySet.add(group);

    let type: 'live' | 'movie' | 'series' = 'live';
    const lowerGroup = group.toLowerCase();
    if (lowerGroup.includes('movie') || lowerGroup.includes('vod') || lowerGroup.includes('film') || lowerGroup.includes('أفلام')) type = 'movie';
    else if (lowerGroup.includes('series') || lowerGroup.includes('مسلسل')) type = 'series';

    channels.push({
      id: `ch-${channels.length}`,
      name,
      url,
      logo: logoMatch?.[1] || undefined,
      group,
      type,
    });
  }

  return { channels, categories: Array.from(categorySet).sort() };
}

function buildXtreamBase(server: string): string {
  let base = server.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) {
    base = 'http://' + base;
  }
  return base;
}

// Build Xtream URL preserving original credential casing
function buildXtreamUrl(base: string, username: string, password: string, action?: string): string {
  // Use credentials as-is (case-sensitive) - do NOT lowercase
  const params = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  if (action) {
    return `${base}/player_api.php?${params}&action=${action}`;
  }
  return `${base}/player_api.php?${params}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userId = user.id;
    const body = await req.json();
    const { type, url, username, password, server } = body;

    if (!type) {
      return jsonResponse({ error: 'Missing type (m3u, xtream, or xtream_account_info)' }, 400);
    }

    // === Xtream Account Info (no caching) ===
    if (type === 'xtream_account_info') {
      if (!server || !username || !password) {
        return jsonResponse({ error: 'Missing xtream credentials' }, 400);
      }
      const base = buildXtreamBase(server);
      const accountUrl = buildXtreamUrl(base, username, password);
      
      try {
        const { response, text } = await fetchWithRetry(accountUrl);
        if (!response.ok) {
          return jsonResponse({ 
            ok: false, 
            error: `Provider returned ${response.status}`,
            account: { username, status: 'Unknown', expDate: null, isTrial: false, activeCons: 0, maxConnections: 1, createdAt: null }
          });
        }

        const data = safeJsonParse<any>(text);
        const info = data.user_info || {};
        
        let expDate: string | null = null;
        if (info.exp_date) {
          const ts = parseInt(info.exp_date, 10);
          if (!isNaN(ts)) expDate = new Date(ts * 1000).toISOString();
        }

        let createdAt: string | null = null;
        if (info.created_at) {
          const ts = parseInt(info.created_at, 10);
          if (!isNaN(ts)) createdAt = new Date(ts * 1000).toISOString();
        }

        return jsonResponse({
          ok: true,
          account: {
            username: info.username || username,
            status: info.status || 'Unknown',
            expDate,
            isTrial: info.is_trial === '1' || info.is_trial === true,
            activeCons: parseInt(info.active_cons, 10) || 0,
            maxConnections: parseInt(info.max_connections, 10) || 1,
            createdAt,
            message: info.message || undefined,
          },
          serverInfo: data.server_info || null,
        });
      } catch (err) {
        console.warn('Xtream account info fetch failed:', err);
        return jsonResponse({ 
          ok: false, 
          error: err instanceof Error ? err.message : 'Failed to fetch account info',
          account: { username, status: 'Unknown', expDate: null, isTrial: false, activeCons: 0, maxConnections: 1, createdAt: null }
        });
      }
    }

    // === Check cache for playlist types ===
    const cacheKey = type === 'm3u' ? url : `${server}:${username}`;
    const { data: cached } = await supabase
      .from('playlist_cache')
      .select('data, channel_count')
      .eq('user_id', userId)
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached) {
      return jsonResponse(cached.data);
    }

    let result;

    if (type === 'm3u') {
      if (!url) {
        return jsonResponse({ error: 'Missing url' }, 400);
      }
      const { response, text } = await fetchWithRetry(url);
      if (!response.ok) throw new Error(`Failed to fetch playlist: ${response.status}`);
      result = parseM3U(text);
    } else if (type === 'xtream') {
      if (!server || !username || !password) {
        return jsonResponse({ error: 'Missing xtream credentials' }, 400);
      }
      const base = buildXtreamBase(server);

      // Try API endpoints with retry (different User-Agents)
      let apiWorked = false;
      try {
        const [catsRes, streamsRes] = await Promise.all([
          fetchWithRetry(buildXtreamUrl(base, username, password, 'get_live_categories')),
          fetchWithRetry(buildXtreamUrl(base, username, password, 'get_live_streams')),
        ]);

        apiWorked = catsRes.response.ok && streamsRes.response.ok;

        if (apiWorked) {
          const categories = safeJsonParse<any[]>(catsRes.text);
          const streams = safeJsonParse<any[]>(streamsRes.text);

          if (Array.isArray(categories) && Array.isArray(streams)) {
            const catMap = new Map(categories.map((c: any) => [c.category_id, c.category_name]));

            // Also fetch VOD and series categories/streams
            let vodChannels: Channel[] = [];
            let seriesChannels: Channel[] = [];

            try {
              const [vodCatsRes, vodStreamsRes] = await Promise.all([
                fetchWithRetry(buildXtreamUrl(base, username, password, 'get_vod_categories')),
                fetchWithRetry(buildXtreamUrl(base, username, password, 'get_vod_streams')),
              ]);
              if (vodCatsRes.response.ok && vodStreamsRes.response.ok) {
                const vodCats = safeJsonParse<any[]>(vodCatsRes.text);
                const vodStreams = safeJsonParse<any[]>(vodStreamsRes.text);
                if (Array.isArray(vodCats) && Array.isArray(vodStreams)) {
                  const vodCatMap = new Map(vodCats.map((c: any) => [c.category_id, c.category_name]));
                  vodChannels = vodStreams.map((s: any) => ({
                    id: `vod-${s.stream_id}`,
                    name: s.name,
                    url: `${base}/movie/${username}/${password}/${s.stream_id}.${s.container_extension || 'mp4'}`,
                    logo: s.stream_icon || undefined,
                    group: vodCatMap.get(s.category_id) || 'VOD',
                    type: 'movie' as const,
                  }));
                }
              }
            } catch { /* VOD fetch optional */ }

            try {
              const [serCatsRes, serStreamsRes] = await Promise.all([
                fetchWithRetry(buildXtreamUrl(base, username, password, 'get_series_categories')),
                fetchWithRetry(buildXtreamUrl(base, username, password, 'get_series')),
              ]);
              if (serCatsRes.response.ok && serStreamsRes.response.ok) {
                const serCats = safeJsonParse<any[]>(serCatsRes.text);
                const serStreams = safeJsonParse<any[]>(serStreamsRes.text);
                if (Array.isArray(serCats) && Array.isArray(serStreams)) {
                  const serCatMap = new Map(serCats.map((c: any) => [c.category_id, c.category_name]));
                  seriesChannels = serStreams.map((s: any) => ({
                    id: `ser-${s.series_id}`,
                    name: s.name,
                    url: '', // Series need episode lookup
                    logo: s.cover || undefined,
                    group: serCatMap.get(s.category_id) || 'Series',
                    type: 'series' as const,
                  }));
                }
              }
            } catch { /* Series fetch optional */ }

            const liveChannels: Channel[] = streams.map((s: any) => ({
              id: `xt-${s.stream_id}`,
              name: s.name,
              url: `${base}/live/${username}/${password}/${s.stream_id}.m3u8`,
              logo: s.stream_icon || undefined,
              group: catMap.get(s.category_id) || 'Uncategorized',
              type: 'live' as const,
            }));

            const allChannels = [...liveChannels, ...vodChannels, ...seriesChannels];
            result = {
              channels: allChannels,
              categories: Array.from(new Set(allChannels.map(c => c.group!))).filter(Boolean).sort(),
            };
          }
        }
      } catch (err) {
        console.warn('Xtream API calls failed:', err instanceof Error ? err.message : err);
      }

      // Fallback: fetch as M3U playlist
      if (!result) {
        console.log('Xtream API failed, falling back to M3U format');
        const m3uUrl = `${base}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`;
        try {
          const m3uRes = await fetchWithRetry(m3uUrl);
          if (!m3uRes.response.ok) {
            throw new PlaylistProviderError('PROVIDER_BLOCKED', `Xtream provider blocked both API and M3U requests (${m3uRes.response.status}). The provider may be restricting server access.\n\nTips:\n1. Make sure username/password are exactly correct (case-sensitive)\n2. Try downloading the M3U file from your provider and uploading it directly\n3. Your provider may block cloud server IPs`);
          }
          result = parseM3U(m3uRes.text);
        } catch (err) {
          if (err instanceof PlaylistProviderError) throw err;
          throw new PlaylistProviderError('PROVIDER_BLOCKED', `Could not connect to Xtream provider. The provider may block cloud server IPs.\n\nTips:\n1. Try uploading an M3U file directly\n2. Check your credentials are correct (case-sensitive)`);
        }
      }
    } else {
      return jsonResponse({ error: 'Invalid type' }, 400);
    }

    // Save to cache
    await supabase.from('playlist_cache').upsert({
      user_id: userId,
      source_url: url || server,
      source_type: type,
      cache_key: cacheKey,
      data: result,
      channel_count: result.channels.length,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    }, { onConflict: 'user_id,cache_key' });

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof PlaylistProviderError) {
      console.warn('parse-playlist upstream warning:', error.code, error.message);
      return jsonResponse({ ok: false, code: error.code, error: error.message });
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('parse-playlist failed:', message);
    return jsonResponse({ error: message }, 500);
  }
});
