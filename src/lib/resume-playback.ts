import { supabase } from '@/integrations/supabase/client';

/**
 * Save resume position for a channel.
 */
export async function saveResumePosition(
  channelId: string,
  channelName: string,
  channelUrl: string,
  positionSeconds: number,
  durationSeconds?: number
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('playback_resume').upsert({
    user_id: user.id,
    channel_id: channelId,
    channel_name: channelName,
    channel_url: channelUrl,
    position_seconds: positionSeconds,
    duration_seconds: durationSeconds || null,
    updated_at: new Date().toISOString(),
  } as any, { onConflict: 'user_id,channel_id' });
}

/**
 * Get resume position for a channel.
 */
export async function getResumePosition(channelId: string): Promise<number | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('playback_resume')
    .select('position_seconds')
    .eq('user_id', user.id)
    .eq('channel_id', channelId)
    .maybeSingle();

  return data ? Number((data as any).position_seconds) : null;
}

/**
 * Clear resume position.
 */
export async function clearResumePosition(channelId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('playback_resume').delete()
    .eq('user_id', user.id)
    .eq('channel_id', channelId);
}
