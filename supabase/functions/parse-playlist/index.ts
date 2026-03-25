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

const upstreamHeaders = {
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (compatible; LovablePlaylistParser/1.0; +https://lovable.dev)',
};

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
      throw new Error(`Xtream provider returned HTML instead of JSON. It may be blocking remote requests or the server URL/credentials are invalid. Response preview: ${snippet}`);
    }
    throw new Error(`Xtream provider returned invalid JSON. Response preview: ${snippet}`);
  }
}

async function fetchUpstreamText(url: string): Promise<{ response: Response; text: string }> {
  const response = await fetch(url, {
    headers: upstreamHeaders,
    redirect: 'follow',
  });

  const text = await response.text();
  return { response, text };
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = user.id;
    const body = await req.json();
    const { type, url, username, password, server } = body;

    if (!type) {
      return new Response(JSON.stringify({ error: 'Missing type (m3u or xtream)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      return new Response(JSON.stringify(cached.data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let result;

    if (type === 'm3u') {
      if (!url) {
        return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch playlist: ${res.status}`);
      const text = await res.text();
      result = parseM3U(text);
    } else if (type === 'xtream') {
      if (!server || !username || !password) {
        return new Response(JSON.stringify({ error: 'Missing xtream credentials' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const base = server.replace(/\/$/, '');
      const [catsRes, streamsRes] = await Promise.all([
        fetchUpstreamText(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_categories`),
        fetchUpstreamText(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`),
      ]);

      if (!catsRes.response.ok) {
        throw new Error(`Failed to fetch Xtream categories (${catsRes.response.status}). ${looksLikeHtml(catsRes.text) ? 'The provider returned HTML instead of JSON.' : 'Unexpected upstream response.'}`);
      }

      if (!streamsRes.response.ok) {
        throw new Error(`Failed to fetch Xtream streams (${streamsRes.response.status}). ${looksLikeHtml(streamsRes.text) ? 'The provider returned HTML instead of JSON.' : 'Unexpected upstream response.'}`);
      }

      const categories = safeJsonParse<any[]>(catsRes.text);
      const streams = safeJsonParse<any[]>(streamsRes.text);

      if (!Array.isArray(categories) || !Array.isArray(streams)) {
        throw new Error('Xtream provider returned an unexpected payload shape.');
      }

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
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('parse-playlist failed:', message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
