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

const upstreamHeaders = {
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (compatible; LovablePlaylistParser/1.0; +https://lovable.dev)',
};

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

async function fetchUpstreamText(url: string): Promise<{ response: Response; text: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const response = await fetch(url, {
      headers: upstreamHeaders,
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
        headers: upstreamHeaders,
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
    if (lowerGroup.includes('movie') || lowerGroup.includes('vod')) type = 'movie';
    else if (lowerGroup.includes('series')) type = 'series';

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
      return jsonResponse({ error: 'Missing type (m3u or xtream)' }, 400);
    }

    // Check cache
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
      const { response, text } = await fetchUpstreamText(url);
      if (!response.ok) throw new Error(`Failed to fetch playlist: ${response.status}`);
      result = parseM3U(text);
    } else if (type === 'xtream') {
      if (!server || !username || !password) {
        return jsonResponse({ error: 'Missing xtream credentials' }, 400);
      }
      let base = server.replace(/\/$/, '');
      if (!/^https?:\/\//i.test(base)) {
        base = 'http://' + base;
      }
      const [catsRes, streamsRes] = await Promise.all([
        fetchUpstreamText(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_categories`),
        fetchUpstreamText(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`),
      ]);

      const apiWorked = catsRes.response.ok && streamsRes.response.ok;

      if (apiWorked) {
        const categories = safeJsonParse<any[]>(catsRes.text);
        const streams = safeJsonParse<any[]>(streamsRes.text);

        if (Array.isArray(categories) && Array.isArray(streams)) {
          const catMap = new Map(categories.map((c: any) => [c.category_id, c.category_name]));
          const channels: Channel[] = streams.map((s: any) => ({
            id: `xt-${s.stream_id}`,
            name: s.name,
            url: `${base}/live/${username}/${password}/${s.stream_id}.m3u8`,
            logo: s.stream_icon || undefined,
            group: catMap.get(s.category_id) || 'Uncategorized',
            type: 'live' as const,
          }));
          result = {
            channels,
            categories: Array.from(new Set(channels.map(c => c.group!))).filter(Boolean).sort(),
          };
        }
      }

      // Fallback: fetch as M3U playlist if API failed
      if (!result) {
        console.log('Xtream API failed, falling back to M3U format');
        const m3uUrl = `${base}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`;
        const m3uRes = await fetchUpstreamText(m3uUrl);
        if (!m3uRes.response.ok) {
          throw new PlaylistProviderError('PROVIDER_BLOCKED', `Xtream provider blocked both API and M3U requests (${m3uRes.response.status}). The provider may be restricting server access. Try using M3U URL directly.`);
        }
        result = parseM3U(m3uRes.text);
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
