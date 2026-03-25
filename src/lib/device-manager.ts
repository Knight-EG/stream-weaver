import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, getDeviceName, getPlatform } from './device';

function generateFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
  }
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    canvas.toDataURL(),
  ];
  // Simple hash
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export interface DeviceActivationResult {
  success: boolean;
  error?: string;
  device?: {
    id: string;
    device_id: string;
    is_active: boolean;
  };
}

export async function activateDevice(): Promise<DeviceActivationResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const platform = getPlatform();
  const fingerprint = generateFingerprint();

  // Check if device already exists for this user
  const { data: existing } = await supabase
    .from('devices')
    .select('*')
    .eq('user_id', user.id)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (existing) {
    // Update last seen and fingerprint
    const { data, error } = await supabase
      .from('devices')
      .update({ last_seen_at: new Date().toISOString(), fingerprint })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    if (!data.is_active) return { success: false, error: 'This device has been deactivated.' };
    return { success: true, device: data };
  }

  // Register new device
  const { data, error } = await supabase
    .from('devices')
    .insert({
      user_id: user.id,
      device_id: deviceId,
      device_name: deviceName,
      platform,
      fingerprint,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes('Device limit')) {
      return { success: false, error: 'Device limit reached. Please deactivate another device first.' };
    }
    if (error.message.includes('already registered')) {
      return { success: false, error: 'This device is linked to another account.' };
    }
    return { success: false, error: error.message };
  }

  return { success: true, device: data };
}

export async function deactivateDevice(deviceDbId: string): Promise<boolean> {
  const { error } = await supabase
    .from('devices')
    .update({ is_active: false })
    .eq('id', deviceDbId);
  return !error;
}

export async function getUserDevices() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from('devices').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  return data || [];
}

export async function checkSubscription(): Promise<{ active: boolean; expiresAt?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { active: false };
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { active: false };
  return { active: true, expiresAt: data.expires_at };
}
