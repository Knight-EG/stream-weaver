import type { Channel, ParsedPlaylist } from './m3u-parser';

export interface XtreamCredentials {
  server: string;
  username: string;
  password: string;
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

function buildUrl(creds: XtreamCredentials, action: string): string {
  const base = creds.server.replace(/\/$/, '');
  return `${base}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&action=${action}`;
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

  const channels: Channel[] = streams.map((s, i) => ({
    id: `xt-${s.stream_id}`,
    name: s.name,
    url: `${base}/live/${creds.username}/${creds.password}/${s.stream_id}.m3u8`,
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
