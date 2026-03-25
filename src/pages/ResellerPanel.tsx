import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Wallet, Users, ShoppingCart, Loader2, Plus, CreditCard, History } from 'lucide-react';

export default function ResellerPanel() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActivate, setShowActivate] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [planType, setPlanType] = useState('monthly');
  const [planDays, setPlanDays] = useState(30);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadData(); }, [user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    const [walletRes, txRes] = await Promise.all([
      supabase.from('reseller_wallets').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('reseller_transactions').select('*').eq('reseller_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);
    setWallet(walletRes.data);
    setTransactions(txRes.data || []);
    setLoading(false);
  }

  async function activateUser() {
    if (!user || !targetEmail || !wallet) return;
    setActivating(true);
    setError('');
    setSuccess('');

    // Calculate cost (simplified: monthly=500c, yearly=4000c, lifetime=10000c)
    const costs: Record<string, number> = { monthly: 500, yearly: 4000, lifetime: 10000 };
    const cost = costs[planType] || 500;

    if (wallet.balance_cents < cost) {
      setError('Insufficient balance');
      setActivating(false);
      return;
    }

    if (wallet.is_frozen) {
      setError('Your account is frozen. Contact admin.');
      setActivating(false);
      return;
    }

    // Find target user by email
    const { data: targetProfile } = await supabase.from('profiles').select('user_id').eq('email', targetEmail).maybeSingle();
    if (!targetProfile) {
      setError('User not found with this email');
      setActivating(false);
      return;
    }

    // Create subscription
    const expiresAt = planType === 'lifetime'
      ? new Date('2099-12-31').toISOString()
      : new Date(Date.now() + planDays * 86400000).toISOString();

    const { error: subError } = await supabase.from('subscriptions').insert({
      user_id: targetProfile.user_id,
      status: 'active',
      plan_type: planType,
      expires_at: expiresAt,
      max_devices: 3,
    } as any);

    if (subError) {
      setError('Failed to create subscription');
      setActivating(false);
      return;
    }

    // Deduct from wallet
    await supabase.from('reseller_wallets').update({
      balance_cents: wallet.balance_cents - cost,
    } as any).eq('id', wallet.id);

    // Log transaction
    await supabase.from('reseller_transactions').insert({
      reseller_id: user.id,
      type: 'activation',
      amount_cents: -cost,
      description: `Activated ${planType} for ${targetEmail}`,
      target_user_id: targetProfile.user_id,
    } as any);

    setSuccess(`Successfully activated ${planType} plan for ${targetEmail}`);
    setTargetEmail('');
    setShowActivate(false);
    setActivating(false);
    loadData();
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  if (!wallet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Wallet className="w-16 h-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">{t('resellerPanel')}</h1>
          <p className="text-muted-foreground">You don't have a reseller account. Contact admin to get started.</p>
          <Link to="/" className="inline-block px-6 py-3 rounded-lg bg-secondary text-secondary-foreground font-semibold">{t('back')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-secondary rounded-lg tv-focusable" data-focusable="true">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> {t('resellerPanel')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('resellerCommission')}: {wallet.commission_rate}%</p>
        </div>
      </div>

      {/* Wallet */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center">
            <Wallet className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">${(wallet.balance_cents / 100).toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">{t('resellerBalance')}</p>
          </div>
        </div>
        {wallet.is_frozen && (
          <div className="mt-4 bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-destructive text-sm">
            Account frozen. Contact admin.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowActivate(true)}
          disabled={wallet.is_frozen}
          className="py-4 rounded-xl gradient-primary text-primary-foreground font-semibold flex flex-col items-center gap-2 tv-focusable disabled:opacity-50"
          data-focusable="true"
        >
          <Users className="w-6 h-6" />
          <span className="text-sm">{t('resellerActivateUser')}</span>
        </button>
        <Link
          to="/pricing"
          className="py-4 rounded-xl bg-secondary text-secondary-foreground font-semibold flex flex-col items-center gap-2 tv-focusable text-center"
          data-focusable="true"
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="text-sm">{t('resellerBuyCredits')}</span>
        </Link>
      </div>

      {error && <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-destructive text-sm">{error}</div>}
      {success && <div className="bg-success/10 border border-success/30 rounded-xl p-3 text-success text-sm">{success}</div>}

      {/* Activate Form */}
      {showActivate && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-foreground font-semibold">{t('resellerActivateUser')}</h3>
          <div>
            <label className="text-xs text-muted-foreground font-medium">User Email</label>
            <input type="email" value={targetEmail} onChange={e => setTargetEmail(e.target.value)} placeholder="user@example.com" className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Plan</label>
            <div className="flex gap-2 mt-1">
              {['monthly', 'yearly', 'lifetime'].map(p => (
                <button key={p} onClick={() => setPlanType(p)} className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize ${planType === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{p}</button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Cost: ${planType === 'monthly' ? '5.00' : planType === 'yearly' ? '40.00' : '100.00'}
          </p>
          <div className="flex gap-2">
            <button onClick={activateUser} disabled={activating} className="flex-1 py-2.5 rounded-lg gradient-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2">
              {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Activate
            </button>
            <button onClick={() => setShowActivate(false)} className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm">{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-foreground font-semibold mb-4 flex items-center gap-2"><History className="w-5 h-5 text-primary" /> {t('resellerTransactions')}</h2>
        <div className="space-y-3">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
              <div>
                <p className="text-foreground text-sm font-medium">{tx.description || tx.type}</p>
                <p className="text-muted-foreground text-xs">{new Date(tx.created_at).toLocaleString()}</p>
              </div>
              <p className={`text-sm font-semibold ${tx.amount_cents >= 0 ? 'text-success' : 'text-destructive'}`}>
                {tx.amount_cents >= 0 ? '+' : ''}${(tx.amount_cents / 100).toFixed(2)}
              </p>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No transactions yet</p>}
        </div>
      </div>
    </div>
  );
}
