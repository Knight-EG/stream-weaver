import { supabase } from '@/integrations/supabase/client';
import { activateDevice, type DeviceActivationResult } from './device-manager';
import { detectAccountSharing } from './account-sharing-detector';

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
  tempBan?: {
    active: boolean;
    expiresAt?: string;
  };
}

/**
 * Full access check: auth + trial/subscription + device activation + anti-sharing.
 */
export async function checkAccess(): Promise<AccessCheck> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { allowed: false, reason: 'Not authenticated' };
  }

  // Account sharing / temp ban check FIRST (before everything else)
  const sharingCheck = await detectAccountSharing();
  if (sharingCheck.suspicious && (sharingCheck.action === 'block' || sharingCheck.action === 'temp_ban')) {
    return {
      allowed: false,
      reason: sharingCheck.reason || 'Account sharing detected.',
      tempBan: sharingCheck.action === 'temp_ban' ? { active: true, expiresAt: sharingCheck.banExpiresAt } : undefined,
    };
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
    .select('status, expires_at, plan_type')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gte('expires_at', now.toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const hasActiveSubscription = !!sub;

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
      subscription: sub ? { status: sub.status, expiresAt: sub.expires_at, planType: sub.plan_type } : undefined,
    };
  }

  // Warn-level sharing (allow but user was notified)
  if (sharingCheck.suspicious && sharingCheck.action === 'warn') {
    // Access allowed but warning was sent via notification
  }

  return {
    allowed: true,
    trialActive: trialActive && !hasActiveSubscription,
    trialDaysLeft,
    subscription: sub ? { status: sub.status, expiresAt: sub.expires_at, planType: sub.plan_type } : undefined,
    device: {
      id: deviceResult.device!.id,
      isActive: deviceResult.device!.is_active,
    },
  };
}
