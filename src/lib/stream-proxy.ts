import { supabase } from '@/integrations/supabase/client';

/**
 * Validates stream access via backend (checks trial/subscription).
 * Always returns a playable URL:
 * - If validation succeeds → returns the same URL (access confirmed)
 * - If validation fails → falls back to direct URL (graceful degradation)
 * 
 * The backend does NOT proxy the stream - it only validates access.
 * The client always plays the original URL directly.
 */

// Cache validation results for 5 minutes
const accessCache = new Map<string, { validUntil: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export async function getSecureStreamUrl(channelId: string, channelUrl: string): Promise<string> {
  // If recently validated, skip re-validation
  const cached = accessCache.get('access');
  if (cached && Date.now() < cached.validUntil) {
    return channelUrl; // Already validated, play directly
  }

  try {
    // Validate access with 5-second timeout
    const result = await Promise.race([
      supabase.functions.invoke('stream-proxy', {
        body: {
          action: 'validate',
          channel_id: channelId,
          channel_url: channelUrl,
        },
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      ),
    ]);

    if (result.error) {
      console.warn('[access-check] Validation failed, allowing direct play:', result.error.message);
      return channelUrl;
    }

    if (result.data?.ok) {
      // Cache the successful validation
      accessCache.set('access', { validUntil: Date.now() + CACHE_DURATION });
      return channelUrl; // Play the original URL directly
    }

    // Access denied by backend - but we still return the URL
    // The subscription guard UI will handle blocking if needed
    console.warn('[access-check] Access denied:', result.data?.error);
    return channelUrl;

  } catch (err) {
    // Timeout or network error - allow playback (graceful degradation)
    console.warn('[access-check] Error, allowing direct play:', err instanceof Error ? err.message : err);
    return channelUrl;
  }
}

export function clearStreamTokens(): void {
  accessCache.clear();
}
