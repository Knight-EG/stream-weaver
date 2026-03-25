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
  tvgId?: string;
  type: 'live' | 'movie' | 'series';
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildBase(server: string): string {
  let base = server.replace(/\/$/, '');
  // Force HTTP always — IPTV providers work on HTTP only
  base = base.replace(/^https:\/\//i, 'http://');
  if (!/^http:\/\//i.test(base)) base = 'http://' + base;
  return base;
}

// Extract hostname without port
function extractHostname(server: string): string {
  const base = buildBase(server);
  try {
    return new URL(base).hostname;
  } catch {
    return server.replace(/^https?:\/\//i, '').split(':')[0].split('/')[0];
  }
}

// Build alternative base URLs with different ports
function getAlternativeBases(server: string): string[] {
  const hostname = extractHostname(server);
  const mainBase = buildBase(server);
  const bases = [mainBase];
  
  // Add port 80 (most common for Xtream streaming)
  const port80 = `http://${hostname}`;
  if (!bases.includes(port80)) bases.push(port80);
  
  // Add port 25461 (common alternative)
  const port25461 = `http://${hostname}:25461`;
  if (!bases.includes(port25461)) bases.push(port25461);
  
  return bases;
}

const USER_AGENTS = [
  'IPTVSmartersPro',
  'IPTVSmarters/1.0',
  'VLC/3.0.20 LibVLC/3.0.20',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Lavf/60.3.100',
];

async function xtreamFetch(url: string, retryWithUAs = true): Promise<any> {
  let lastError: Error | null = null;
  
  const agents = retryWithUAs ? USER_AGENTS : [USER_AGENTS[0]];
  
  for (const ua of agents) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept': '*/*',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        console.warn(`xtreamFetch failed with UA="${ua}": HTTP ${res.status}`);
        continue; // Try next UA
      }
      return await res.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`xtreamFetch error with UA="${ua}":`, lastError.message);
    }
  }
  
  throw lastError || new Error('All fetch attempts failed');
}

// Try fetching from multiple base URLs (different ports)
async function xtreamFetchWithPortFallback(path: string, server: string): Promise<any> {
  const bases = getAlternativeBases(server);
  let lastError: Error | null = null;
  
  for (const base of bases) {
    try {
      console.log(`Trying: ${base}${path}`);
      const result = await xtreamFetch(`${base}${path}`);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Failed on ${base}: ${lastError.message}`);
    }
  }
  
  throw lastError || new Error('All port attempts failed');
}
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
    if (lowerGroup.includes('movie') || lowerGroup.includes('vod') || lowerGroup.includes('film') || lowerGroup.includes('أفلام')) type = 'movie';
    else if (lowerGroup.includes('series') || lowerGroup.includes('مسلسل')) type = 'series';

    channels.push({ id: `ch-${channels.length}`, name, url, logo: logoMatch?.[1] || undefined, group, type });
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
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const userId = user.id;
    const body = await req.json();
    const { type, url, username, password, server } = body;

    console.log(`Request type=${type}`);

    if (!type) {
      return jsonResponse({ error: 'Missing type' }, 400);
    }

    // === Xtream Account Info ===
    if (type === 'xtream_account_info') {
      if (!server || !username || !password) {
        return jsonResponse({ error: 'Missing xtream credentials' }, 400);
      }
      const base = buildBase(server);
      const apiUrl = `${base}/player_api.php?username=${username}&password=${password}`;

      try {
        const data = await xtreamFetch(apiUrl);
        const info = data?.user_info || {};
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
            message: info.message || undefined,
          },
          serverInfo: data.server_info || null,
        });
      } catch (err) {
        console.warn('Account info failed:', err instanceof Error ? err.message : err);
        return jsonResponse({
          ok: false,
          error: err instanceof Error ? err.message : 'Connection failed',
          account: { username, status: 'Unknown', expDate: null, isTrial: false, activeCons: 0, maxConnections: 1, createdAt: null }
        });
      }
    }

    // === Check cache ===
    const cacheKey = type === 'm3u' ? url : `${server}:${username}`;
    const { data: cached } = await supabase
      .from('playlist_cache')
      .select('data, channel_count')
      .eq('user_id', userId)
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached) {
      console.log(`Cache hit for ${cacheKey}, ${cached.channel_count} channels`);
      return jsonResponse(cached.data);
    }

    let result: { channels: Channel[]; categories: string[] };

    if (type === 'm3u') {
      if (!url) return jsonResponse({ error: 'Missing url' }, 400);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'IPTVSmartersPro' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Failed to fetch M3U: ${res.status}`);
      result = parseM3U(await res.text());

    } else if (type === 'xtream') {
      if (!server || !username || !password) {
        return jsonResponse({ error: 'Missing xtream credentials' }, 400);
      }
      const base = buildBase(server);
      const api = `${base}/player_api.php?username=${username}&password=${password}`;

      // Fetch all data in parallel
      console.log('Fetching Xtream data via player_api.php...');

      const [liveCats, liveStreams, vodCats, vodStreams, serCats, serList] = await Promise.all([
        xtreamFetch(`${api}&action=get_live_categories`).catch(() => []),
        xtreamFetch(`${api}&action=get_live_streams`).catch(() => []),
        xtreamFetch(`${api}&action=get_vod_categories`).catch(() => []),
        xtreamFetch(`${api}&action=get_vod_streams`).catch(() => []),
        xtreamFetch(`${api}&action=get_series_categories`).catch(() => []),
        xtreamFetch(`${api}&action=get_series`).catch(() => []),
      ]);

      console.log(`Live: ${Array.isArray(liveStreams) ? liveStreams.length : 0}, VOD: ${Array.isArray(vodStreams) ? vodStreams.length : 0}, Series: ${Array.isArray(serList) ? serList.length : 0}`);

      const channels: Channel[] = [];

      // Live channels
      if (Array.isArray(liveStreams) && Array.isArray(liveCats)) {
        const catMap = new Map(liveCats.map((c: any) => [String(c.category_id), c.category_name || 'Live']));
        for (const s of liveStreams) {
          if (!s.stream_id) continue;
          channels.push({
            id: `xt-${s.stream_id}`,
            name: s.name || `Channel ${s.stream_id}`,
            url: `${base}/live/${username}/${password}/${s.stream_id}.ts`,
            logo: s.stream_icon || undefined,
            group: catMap.get(String(s.category_id)) || 'Live',
            tvgId: s.epg_channel_id || undefined,
            type: 'live',
          });
        }
      }

      // VOD / Movies
      if (Array.isArray(vodStreams) && Array.isArray(vodCats)) {
        const catMap = new Map(vodCats.map((c: any) => [String(c.category_id), c.category_name || 'Movies']));
        for (const s of vodStreams) {
          if (!s.stream_id) continue;
          channels.push({
            id: `vod-${s.stream_id}`,
            name: s.name || `Movie ${s.stream_id}`,
            url: `${base}/movie/${username}/${password}/${s.stream_id}.${s.container_extension || 'mp4'}`,
            logo: s.stream_icon || undefined,
            group: catMap.get(String(s.category_id)) || 'Movies',
            type: 'movie',
          });
        }
      }

      // Series
      if (Array.isArray(serList) && Array.isArray(serCats)) {
        const catMap = new Map(serCats.map((c: any) => [String(c.category_id), c.category_name || 'Series']));
        for (const s of serList) {
          if (!s.series_id) continue;
          channels.push({
            id: `ser-${s.series_id}`,
            name: s.name || `Series ${s.series_id}`,
            url: '',
            logo: s.cover || undefined,
            group: catMap.get(String(s.category_id)) || 'Series',
            type: 'series',
          });
        }
      }

      if (channels.length === 0) {
        throw new Error('لم يتم العثور على أي قنوات. تأكد من صحة بيانات الدخول.');
      }

      const categories = Array.from(new Set(channels.map(c => c.group!).filter(Boolean))).sort();
      result = { channels, categories };

      console.log(`Total channels: ${channels.length}, categories: ${categories.length}`);

    } else {
      return jsonResponse({ error: 'Invalid type. Use: m3u, xtream, or xtream_account_info' }, 400);
    }

    // Save cache (1 hour)
    await supabase.from('playlist_cache').upsert({
      user_id: userId,
      source_url: url || server,
      source_type: type,
      cache_key: cacheKey,
      data: result as any,
      channel_count: result.channels.length,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    }, { onConflict: 'user_id,cache_key' });

    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('parse-playlist error:', message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
