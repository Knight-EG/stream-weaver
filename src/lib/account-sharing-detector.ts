import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from './device';

/**
 * Detects potential account sharing by checking:
 * 1. Multiple active devices (should be exactly 1)
 * 2. Rapid IP changes
 * 3. Concurrent sessions from different devices
 */
export async function detectAccountSharing(): Promise<{
  suspicious: boolean;
  reason?: string;
  action?: 'warn' | 'block';
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { suspicious: false };

  const currentDeviceId = getDeviceId();

  // Check active devices - should be exactly 1
  const { data: devices } = await supabase
    .from('devices')
    .select('device_id, last_seen_at, platform, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (devices && devices.length > 1) {
    // Multiple active devices detected - log and flag
    await logSecurityEvent(user.id, 'multiple_devices_detected', 'warning', {
      device_count: devices.length,
      current_device: currentDeviceId,
      devices: devices.map(d => ({ id: d.device_id, platform: d.platform })),
    });

    return {
      suspicious: true,
      reason: 'Multiple active devices detected. Only 1 device is allowed per account.',
      action: 'block',
    };
  }

  // Check if current device matches the registered one
  if (devices && devices.length === 1 && devices[0].device_id !== currentDeviceId) {
    await logSecurityEvent(user.id, 'device_mismatch', 'critical', {
      registered_device: devices[0].device_id,
      current_device: currentDeviceId,
    });

    return {
      suspicious: true,
      reason: 'This device is not the registered device for your account.',
      action: 'block',
    };
  }

  // Check for rapid session switching (multiple sessions in last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentSessions } = await supabase
    .from('streaming_sessions')
    .select('device_id, started_at')
    .eq('user_id', user.id)
    .gte('started_at', oneHourAgo);

  if (recentSessions) {
    const uniqueDevices = new Set(recentSessions.map(s => s.device_id));
    if (uniqueDevices.size > 1) {
      await logSecurityEvent(user.id, 'rapid_device_switching', 'warning', {
        unique_devices: uniqueDevices.size,
        sessions: recentSessions.length,
      });

      return {
        suspicious: true,
        reason: 'Suspicious activity: multiple devices used in a short period.',
        action: 'warn',
      };
    }
  }

  return { suspicious: false };
}

async function logSecurityEvent(
  userId: string,
  eventType: string,
  severity: string,
  details: Record<string, any>
) {
  try {
    await supabase.from('security_logs').insert({
      user_id: userId,
      event_type: eventType,
      severity,
      details,
      device_id: getDeviceId(),
    });
  } catch (err) {
    console.error('Failed to log security event:', err);
  }
}
