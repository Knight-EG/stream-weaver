import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from './device';

interface StreamToken {
  stream_url: string;
  expires_in: number;
}

const tokenCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Get a secure, tokenized stream URL via the backend proxy.
 * Validates subscription + device before granting access.
 * Caches tokens for 4 minutes (tokens last 5 min).
 */
export async function getSecureStreamUrl(channelId: string, channelUrl: string): Promise<string> {
  // Check cache first
  const cached = tokenCache.get(channelId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  const deviceId = getDeviceId();

  const { data, error } = await supabase.functions.invoke('stream-proxy', {
    body: {
      channel_id: channelId,
      channel_url: channelUrl,
      device_id: deviceId,
      action: 'get_token',
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // If proxy fails (no subscription, etc.), fall back to direct URL
  if (error || !data?.stream_url) {
    console.warn('Stream proxy unavailable, using direct URL:', error?.message || 'No stream_url');
    return channelUrl;
  }

  // Cache for 4 minutes
  tokenCache.set(channelId, {
    url: data.stream_url,
    expiresAt: Date.now() + 4 * 60 * 1000,
  });

  return data.stream_url;
}

/**
 * Clear cached stream tokens (e.g., on logout)
 */
export function clearStreamTokens(): void {
  tokenCache.clear();
}
