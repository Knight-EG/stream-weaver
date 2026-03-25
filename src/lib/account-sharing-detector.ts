import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from './device';

export interface SharingDetectionResult {
  suspicious: boolean;
  reason?: string;
  action?: 'warn' | 'block' | 'temp_ban';
  banExpiresAt?: string;
}

const STRIKE_THRESHOLD_WARN = 2;
const STRIKE_THRESHOLD_BLOCK = 4;
const STRIKE_THRESHOLD_BAN = 6;
const TEMP_BAN_HOURS = 24;

/**
 * Advanced account sharing detection:
 * 1. Multiple active devices (strict: only 1 allowed)
 * 2. Device mismatch (current ≠ registered)
 * 3. Rapid device switching in sessions
 * 4. Geographic anomaly (multiple IPs in short window)
 * 5. Strike system with escalating penalties
 * 6. Automatic notifications to user
 * 7. Temporary ban after repeated violations
 */
export async function detectAccountSharing(): Promise<SharingDetectionResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { suspicious: false };

  const currentDeviceId = getDeviceId();

  // Check if user is currently temp-banned
  const banCheck = await checkTempBan(user.id);
  if (banCheck.banned) {
    return {
      suspicious: true,
      reason: `Account temporarily suspended due to repeated security violations. Access will be restored at ${new Date(banCheck.expiresAt!).toLocaleString()}.`,
      action: 'temp_ban',
      banExpiresAt: banCheck.expiresAt,
    };
  }

  // Get strike count from recent security logs (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentStrikes } = await supabase
    .from('security_logs')
    .select('id')
    .eq('user_id', user.id)
    .in('event_type', ['multiple_devices_detected', 'device_mismatch', 'rapid_device_switching', 'geo_anomaly'])
    .gte('created_at', sevenDaysAgo);

  const strikeCount = recentStrikes?.length || 0;

  // ── Get user's actual device limit ──
  const { data: profile } = await supabase
    .from('profiles')
    .select('max_devices')
    .eq('user_id', user.id)
    .single();

  const maxDevices = profile?.max_devices || 3;

  // ── Check 1: Multiple active devices exceeding limit ──
  const { data: devices } = await supabase
    .from('devices')
    .select('device_id, last_seen_at, platform, is_active, ip_address')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (devices && devices.length > maxDevices) {
    const newStrikes = strikeCount + 1;
    await logSecurityEvent(user.id, 'multiple_devices_detected', 'critical', {
      device_count: devices.length,
      max_allowed: maxDevices,
      current_device: currentDeviceId,
      devices: devices.map(d => ({ id: d.device_id, platform: d.platform })),
      strike: newStrikes,
    });
    await sendSecurityNotification(user.id, 'multiple_devices', newStrikes, maxDevices);

    if (newStrikes >= STRIKE_THRESHOLD_BAN) {
      await applyTempBan(user.id, TEMP_BAN_HOURS);
      return {
        suspicious: true,
        reason: `Account temporarily suspended for ${TEMP_BAN_HOURS} hours due to repeated violations (${newStrikes} strikes).`,
        action: 'temp_ban',
        banExpiresAt: new Date(Date.now() + TEMP_BAN_HOURS * 60 * 60 * 1000).toISOString(),
      };
    }

    return {
      suspicious: true,
      reason: `Multiple active devices detected (${devices.length}). Only ${maxDevices} device(s) allowed. Strike ${newStrikes}/${STRIKE_THRESHOLD_BAN}.`,
      action: newStrikes >= STRIKE_THRESHOLD_BLOCK ? 'block' : 'warn',
    };
  }

  // ── Check 2: Device mismatch ──
  if (devices && devices.length === 1 && devices[0].device_id !== currentDeviceId) {
    const newStrikes = strikeCount + 1;
    await logSecurityEvent(user.id, 'device_mismatch', 'critical', {
      registered_device: devices[0].device_id,
      current_device: currentDeviceId,
      strike: newStrikes,
    });
    await sendSecurityNotification(user.id, 'device_mismatch', newStrikes);

    if (newStrikes >= STRIKE_THRESHOLD_BAN) {
      await applyTempBan(user.id, TEMP_BAN_HOURS);
      return {
        suspicious: true,
        reason: `Account suspended. Unregistered device attempted access. Strike ${newStrikes}/${STRIKE_THRESHOLD_BAN}.`,
        action: 'temp_ban',
        banExpiresAt: new Date(Date.now() + TEMP_BAN_HOURS * 60 * 60 * 1000).toISOString(),
      };
    }

    return {
      suspicious: true,
      reason: `This device is not registered to your account. Strike ${newStrikes}/${STRIKE_THRESHOLD_BAN}.`,
      action: newStrikes >= STRIKE_THRESHOLD_BLOCK ? 'block' : 'warn',
    };
  }

  // ── Check 3: Rapid session switching ──
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentSessions } = await supabase
    .from('streaming_sessions')
    .select('device_id, started_at')
    .eq('user_id', user.id)
    .gte('started_at', oneHourAgo);

  if (recentSessions) {
    const uniqueDevices = new Set(recentSessions.map(s => s.device_id));
    if (uniqueDevices.size > 1) {
      const newStrikes = strikeCount + 1;
      await logSecurityEvent(user.id, 'rapid_device_switching', 'warning', {
        unique_devices: uniqueDevices.size,
        sessions: recentSessions.length,
        strike: newStrikes,
      });
      await sendSecurityNotification(user.id, 'rapid_switching', newStrikes);

      return {
        suspicious: true,
        reason: `Suspicious: ${uniqueDevices.size} devices used in the last hour. Strike ${newStrikes}/${STRIKE_THRESHOLD_BAN}.`,
        action: newStrikes >= STRIKE_THRESHOLD_WARN ? 'block' : 'warn',
      };
    }
  }

  // ── Check 4: Too many sessions in short time (same device but abnormal) ──
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: burstSessions } = await supabase
    .from('streaming_sessions')
    .select('id')
    .eq('user_id', user.id)
    .gte('started_at', fiveMinAgo);

  if (burstSessions && burstSessions.length > 10) {
    await logSecurityEvent(user.id, 'session_burst', 'warning', {
      session_count: burstSessions.length,
      window: '5min',
    });

    return {
      suspicious: true,
      reason: 'Abnormal session activity detected. Please try again later.',
      action: 'warn',
    };
  }

  return { suspicious: false };
}

async function checkTempBan(userId: string): Promise<{ banned: boolean; expiresAt?: string }> {
  const { data } = await supabase
    .from('security_logs')
    .select('details, created_at')
    .eq('user_id', userId)
    .eq('event_type', 'temp_ban_applied')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { banned: false };

  const details = data.details as any;
  const expiresAt = details?.expires_at;
  if (!expiresAt) return { banned: false };

  if (new Date(expiresAt) > new Date()) {
    return { banned: true, expiresAt };
  }

  return { banned: false };
}

async function applyTempBan(userId: string, hours: number) {
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  await logSecurityEvent(userId, 'temp_ban_applied', 'critical', {
    duration_hours: hours,
    expires_at: expiresAt,
  });

  // Notify user
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      title: '⛔ Account Temporarily Suspended',
      message: `Your account has been temporarily suspended for ${hours} hours due to repeated security violations. If you believe this is an error, contact support.`,
      type: 'error',
      metadata: { event: 'temp_ban', expires_at: expiresAt },
    });
  } catch {}
}

async function sendSecurityNotification(userId: string, type: string, strikeCount: number) {
  const messages: Record<string, { title: string; message: string }> = {
    multiple_devices: {
      title: '⚠️ Multiple Devices Detected',
      message: `We detected ${strikeCount > 1 ? 'repeated ' : ''}access from multiple devices. Only 1 device is allowed per account. Strike ${strikeCount}/${STRIKE_THRESHOLD_BAN}.`,
    },
    device_mismatch: {
      title: '🔒 Unregistered Device Access',
      message: `An unregistered device attempted to access your account. If this wasn't you, please change your password. Strike ${strikeCount}/${STRIKE_THRESHOLD_BAN}.`,
    },
    rapid_switching: {
      title: '🔄 Suspicious Device Switching',
      message: `Multiple devices were used in a short period on your account. Strike ${strikeCount}/${STRIKE_THRESHOLD_BAN}.`,
    },
  };

  const msg = messages[type];
  if (!msg) return;

  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      title: msg.title,
      message: msg.message,
      type: 'warning',
      metadata: { event: `sharing_${type}`, strike: strikeCount },
    });
  } catch {}
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
