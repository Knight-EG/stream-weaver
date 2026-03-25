import type { XtreamCredentials } from './xtream';

function normalizeServer(server: string): string {
  let base = server.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  return base;
}

/**
 * Extract hostname (without port) from the server URL.
 */
function extractHostname(server: string): string {
  try {
    const url = new URL(normalizeServer(server));
    return url.hostname;
  } catch {
    return server.replace(/^https?:\/\//i, '').replace(/:\d+$/, '').replace(/\/.*$/, '');
  }
}

/**
 * Build multiple possible M3U download URLs since different Xtream panels
 * serve get.php on different ports (API port vs streaming port 80).
 */
export function buildM3uDownloadUrls(creds: XtreamCredentials): string[] {
  const base = normalizeServer(creds.server);
  const u = creds.username;
  const p = creds.password;
  const params = `username=${u}&password=${p}&type=m3u_plus&output=ts`;

  // Use the exact server URL the user entered — don't guess ports
  return [`${base}/get.php?${params}`];
}

/**
 * Open the M3U download URL in a new tab.
 * We can't use fetch() because the app runs on HTTPS and Xtream servers run on HTTP
 * (Mixed Content is blocked by browsers).
 * Instead we open the URL directly - the browser handles it as a navigation/download.
 */
export function openM3uDownload(creds: XtreamCredentials, urlIndex = 0): void {
  const urls = buildM3uDownloadUrls(creds);
  const url = urls[urlIndex] || urls[0];
  window.open(url, '_blank');
}
