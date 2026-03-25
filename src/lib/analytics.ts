import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, getPlatform } from './device';

let currentSessionId: string | null = null;
let sessionStartTime: number = 0;

export async function startSession(channelName: string, channelUrl?: string): Promise<void> {
  await endSession(); // End previous session

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  sessionStartTime = Date.now();
  const { data } = await supabase
    .from('streaming_sessions')
    .insert({
      user_id: user.id,
      device_id: getDeviceId(),
      channel_name: channelName,
      channel_url: channelUrl,
      platform: getPlatform(),
    })
    .select('id')
    .single();

  currentSessionId = data?.id || null;
}

export async function endSession(): Promise<void> {
  if (!currentSessionId) return;

  const duration = Math.round((Date.now() - sessionStartTime) / 1000);
  await supabase
    .from('streaming_sessions')
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: duration,
    })
    .eq('id', currentSessionId);

  currentSessionId = null;
  sessionStartTime = 0;
}

// End session on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (currentSessionId) {
      const duration = Math.round((Date.now() - sessionStartTime) / 1000);
      // Use sendBeacon for reliable unload
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/streaming_sessions?id=eq.${currentSessionId}`;
      const body = JSON.stringify({
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
      });
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    }
  });
}
