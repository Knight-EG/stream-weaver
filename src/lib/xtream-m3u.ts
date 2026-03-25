import type { XtreamCredentials } from './xtream';

function normalizeServer(server: string): string {
  let base = server.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  return base;
}

function buildApiUrl(base: string, username: string, password: string, action: string): string {
  return `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=${action}`;
}

export async function downloadXtreamM3UFile(creds: XtreamCredentials): Promise<void> {
  const base = normalizeServer(creds.server);

  const [categoriesRes, streamsRes] = await Promise.all([
    fetch(buildApiUrl(base, creds.username, creds.password, 'get_live_categories'), { signal: AbortSignal.timeout(15000) }),
    fetch(buildApiUrl(base, creds.username, creds.password, 'get_live_streams'), { signal: AbortSignal.timeout(20000) }),
  ]);

  if (!categoriesRes.ok || !streamsRes.ok) {
    throw new Error(`فشل الاتصال بالمزود (${categoriesRes.status}/${streamsRes.status})`);
  }

  const categories = await categoriesRes.json();
  const streams = await streamsRes.json();

  if (!Array.isArray(streams)) {
    throw new Error('استجابة المزود غير صالحة');
  }

  const categoryMap = new Map<string, string>(
    Array.isArray(categories)
      ? categories.map((category: any) => [String(category.category_id), String(category.category_name || 'Live')])
      : [],
  );

  const lines = ['#EXTM3U'];

  for (const stream of streams) {
    const streamId = stream?.stream_id;
    const name = String(stream?.name || `Channel ${streamId || ''}`).trim();
    if (!streamId || !name) continue;

    const logo = stream?.stream_icon ? ` tvg-logo="${String(stream.stream_icon).replace(/"/g, '&quot;')}"` : '';
    const tvgId = stream?.epg_channel_id ? ` tvg-id="${String(stream.epg_channel_id).replace(/"/g, '&quot;')}"` : '';
    const groupTitle = categoryMap.get(String(stream?.category_id)) || 'Live';
    const safeGroup = groupTitle.replace(/"/g, '&quot;');
    const streamUrl = `${base}/live/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${streamId}.ts`;

    lines.push(`#EXTINF:-1${tvgId}${logo} group-title="${safeGroup}",${name}`);
    lines.push(streamUrl);
  }

  if (lines.length === 1) {
    throw new Error('المزود لم يرجع أي قنوات');
  }

  const blob = new Blob([lines.join('\n')], { type: 'audio/x-mpegurl' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = 'playlist.m3u';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
