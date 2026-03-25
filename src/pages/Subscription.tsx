import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Check, Clock, Infinity, AlertTriangle, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAccessGuard } from '@/hooks/useAccessGuard';
import { supabase } from '@/integrations/supabase/client';

export default function Subscription() {
  const { user } = useAuth();
  const { access, loading: accessLoading, refresh } = useAccessGuard();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const paymentStatus = searchParams.get('status');

  useEffect(() => {
    loadPayments();
  }, [user]);

  async function loadPayments() {
    if (!user) return;
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setPayments(data || []);
    setLoadingPayments(false);
  }

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const isLifetime = access?.subscription?.planType === 'lifetime';
  const hasActiveSub = !!access?.subscription;
  const isTrial = access?.trialActive && !hasActiveSub;

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-secondary rounded-lg tv-focusable" data-focusable="true">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" /> Subscription
          </h1>
          <p className="text-sm text-muted-foreground">Manage your subscription and payments</p>
        </div>
        <button onClick={() => { refresh(); loadPayments(); }} className="ml-auto p-2 hover:bg-secondary rounded-lg tv-focusable" data-focusable="true">
          <RefreshCw className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Success banner */}
      {paymentStatus === 'success' && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-success flex-shrink-0" />
          <div>
            <p className="text-success font-semibold">Payment Successful!</p>
            <p className="text-success/80 text-sm">Your subscription is being activated. It may take a moment to reflect.</p>
          </div>
        </div>
      )}

      {/* Current Status */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-foreground font-semibold mb-4">Current Status</h2>

        <div className="flex items-center gap-4 mb-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            isLifetime ? 'bg-accent/20 text-accent' : hasActiveSub ? 'bg-success/20 text-success' : isTrial ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'
          }`}>
            {isLifetime ? <Infinity className="w-7 h-7" /> : hasActiveSub ? <Check className="w-7 h-7" /> : isTrial ? <Clock className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
          </div>
          <div>
            <p className="text-foreground font-bold text-lg">
              {isLifetime ? 'Lifetime Plan' : hasActiveSub ? 'Active Subscription' : isTrial ? 'Free Trial' : 'No Active Subscription'}
            </p>
            <p className="text-muted-foreground text-sm">
              {isLifetime
                ? 'You have unlimited access forever'
                : hasActiveSub
                  ? `Expires: ${new Date(access!.subscription!.expiresAt).toLocaleDateString()}`
                  : isTrial
                    ? `${access?.trialDaysLeft} day${access?.trialDaysLeft !== 1 ? 's' : ''} remaining`
                    : 'Subscribe to access all features'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        {!hasActiveSub && (
          <Link
            to="/pricing"
            className="block w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-center tv-focusable text-sm"
            data-focusable="true"
          >
            View Plans & Subscribe
          </Link>
        )}

        {hasActiveSub && !isLifetime && (
          <div className="flex gap-3">
            <Link
              to="/pricing"
              className="flex-1 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold text-center tv-focusable text-sm flex items-center justify-center gap-2"
              data-focusable="true"
            >
              <ExternalLink className="w-4 h-4" /> Upgrade Plan
            </Link>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-foreground font-semibold mb-4">Payment History</h2>
        {loadingPayments ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">No payments yet</p>
        ) : (
          <div className="space-y-3">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-foreground text-sm font-medium capitalize">{p.plan_type} Plan</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      p.status === 'completed' ? 'bg-success/20 text-success'
                        : p.status === 'failed' ? 'bg-destructive/20 text-destructive'
                          : 'bg-warning/20 text-warning'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {p.provider === 'paymob' ? 'Paymob' : 'Lemon Squeezy'} • {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-foreground font-semibold text-sm">
                  {(p.amount_cents / 100).toFixed(2)} {p.currency}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
