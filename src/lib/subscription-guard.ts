import { supabase } from '@/integrations/supabase/client';
import { activateDevice, type DeviceActivationResult } from './device-manager';

export interface AccessCheck {
  allowed: boolean;
  reason?: string;
  subscription?: {
    status: string;
    expiresAt: string;
  };
  device?: {
    id: string;
    isActive: boolean;
  };
}

/**
 * Full access check: auth + subscription + device activation.
 * Call this on app load after login.
 */
export async function checkAccess(): Promise<AccessCheck> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { allowed: false, reason: 'Not authenticated' };
  }

  // Check subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, expires_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) {
    return { allowed: false, reason: 'No active subscription' };
  }

  // Activate / validate device
  const deviceResult: DeviceActivationResult = await activateDevice();
  if (!deviceResult.success) {
    return {
      allowed: false,
      reason: deviceResult.error || 'Device activation failed',
      subscription: { status: sub.status, expiresAt: sub.expires_at },
    };
  }

  return {
    allowed: true,
    subscription: { status: sub.status, expiresAt: sub.expires_at },
    device: {
      id: deviceResult.device!.id,
      isActive: deviceResult.device!.is_active,
    },
  };
}
