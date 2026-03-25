import { supabase } from '@/integrations/supabase/client';
import { activateDevice, type DeviceActivationResult } from './device-manager';

export interface AccessCheck {
  allowed: boolean;
  reason?: string;
  trialActive?: boolean;
  trialDaysLeft?: number;
  subscription?: {
    status: string;
    expiresAt: string;
    planType?: string;
  };
  device?: {
    id: string;
    isActive: boolean;
  };
}

/**
 * Full access check: auth + trial/subscription + device activation.
 * Trial users get access without a subscription for the trial period.
 * After trial expires, a subscription is required.
 */
export async function checkAccess(): Promise<AccessCheck> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { allowed: false, reason: 'Not authenticated' };
  }

  // Get profile for trial info
  const { data: profile } = await supabase
    .from('profiles')
    .select('trial_ends_at, max_devices')
    .eq('user_id', user.id)
    .single();

  const now = new Date();
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const trialActive = trialEndsAt ? now < trialEndsAt : false;
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

  // Check subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, expires_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gte('expires_at', now.toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const hasActiveSubscription = !!sub;

  // If no trial AND no subscription → block
  if (!trialActive && !hasActiveSubscription) {
    return {
      allowed: false,
      reason: 'Trial expired. Please activate your subscription to continue.',
      trialActive: false,
      trialDaysLeft: 0,
    };
  }

  // Activate / validate device
  const deviceResult: DeviceActivationResult = await activateDevice();
  if (!deviceResult.success) {
    return {
      allowed: false,
      reason: deviceResult.error || 'Device activation failed',
      trialActive,
      trialDaysLeft,
      subscription: sub ? { status: sub.status, expiresAt: sub.expires_at } : undefined,
    };
  }

  return {
    allowed: true,
    trialActive: trialActive && !hasActiveSubscription,
    trialDaysLeft,
    subscription: sub ? { status: sub.status, expiresAt: sub.expires_at } : undefined,
    device: {
      id: deviceResult.device!.id,
      isActive: deviceResult.device!.is_active,
    },
  };
}
