import { supabase } from '@/integrations/supabase/client';

interface StreamTokenResponse {
  stream_url: string;
  expires_in: number;
}

const tokenCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Get a secure, tokenized stream URL via the backend proxy.
 * Falls back to direct URL on any failure (timeout, auth, no subscription, etc.)
 */
export async function getSecureStreamUrl(channelId: string, channelUrl: string): Promise<string> {
  // Check cache first
  const cached = tokenCache.get(channelId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  try {
    // Race: proxy call vs 5-second timeout
    const result = await Promise.race([
      supabase.functions.invoke('stream-proxy', {
        body: {
          action: 'get_token',
          channel_id: channelId,
          channel_url: channelUrl,
        },
      }),
      new Promise<{ data: null; error: Error }>((_, reject) => 
        setTimeout(() => reject(new Error('Proxy timeout')), 5000)
      ),
    ]);

    if (result.error || !result.data?.stream_url) {
      console.warn('[stream-proxy] Failed, using direct URL:', result.error?.message || 'No stream_url returned');
      return channelUrl;
    }

    // Cache for 4 minutes (token lasts 5)
    tokenCache.set(channelId, {
      url: result.data.stream_url,
      expiresAt: Date.now() + 4 * 60 * 1000,
    });

    return result.data.stream_url;
  } catch (err) {
    console.warn('[stream-proxy] Error, using direct URL:', err instanceof Error ? err.message : err);
    return channelUrl;
  }
}

export function clearStreamTokens(): void {
  tokenCache.clear();
}
