export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
  tvgName?: string;
  type: 'live' | 'movie' | 'series';
}

export interface ParsedPlaylist {
  channels: Channel[];
  categories: string[];
}

export function parseM3U(content: string): ParsedPlaylist {
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
    const tvgIdMatch = info.match(/tvg-id="([^"]*)"/);
    const tvgNameMatch = info.match(/tvg-name="([^"]*)"/);

    const name = nameMatch?.[1]?.trim() || 'Unknown';
    const group = groupMatch?.[1] || 'Uncategorized';
    categorySet.add(group);

    let type: Channel['type'] = 'live';
    const lowerGroup = group.toLowerCase();
    if (lowerGroup.includes('movie') || lowerGroup.includes('vod')) type = 'movie';
    else if (lowerGroup.includes('series')) type = 'series';

    channels.push({
      id: `ch-${channels.length}`,
      name,
      url,
      logo: logoMatch?.[1] || undefined,
      group,
      tvgId: tvgIdMatch?.[1] || undefined,
      tvgName: tvgNameMatch?.[1] || undefined,
      type,
    });
  }

  return { channels, categories: Array.from(categorySet).sort() };
}

export async function fetchAndParseM3U(url: string): Promise<ParsedPlaylist> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch playlist: ${res.status}`);
  const text = await res.text();
  return parseM3U(text);
}
