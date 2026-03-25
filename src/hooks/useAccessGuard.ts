import { useState, useEffect } from 'react';
import { checkAccess, type AccessCheck } from '@/lib/subscription-guard';
import { useAuth } from './useAuth';

/**
 * Hook to check user access (trial/subscription + device) on mount.
 */
export function useAccessGuard() {
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessCheck | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) {
      setAccess({ allowed: false, reason: 'Not authenticated' });
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await checkAccess();
    setAccess(result);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [user?.id]);

  return { access, loading, refresh };
}
