import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Zap, Crown, Infinity, Globe, CreditCard, Loader2, Tag } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface Plan {
  id: string;
  name: string;
  price: string;
  priceEGP: string;
  period: string;
  features: string[];
  popular?: boolean;
  icon: React.ReactNode;
}

type PaymentProvider = 'lemonsqueezy' | 'paymob';

export default function Pricing() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>('lemonsqueezy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const plans: Plan[] = [
    { id: 'monthly', name: t('pricingMonthly'), price: '$4.99', priceEGP: '250 EGP', period: t('pricingMonth'), icon: <Zap className="w-6 h-6" />, features: ['Full channel access', 'Up to 3 devices', 'HD streaming', 'EPG support', 'Cancel anytime'] },
    { id: 'yearly', name: t('pricingYearly'), price: '$39.99', priceEGP: '2,000 EGP', period: t('pricingYear'), popular: true, icon: <Crown className="w-6 h-6" />, features: ['Everything in Monthly', 'Save 33%', 'Priority support', 'Up to 5 devices', 'Early access to features'] },
    { id: 'lifetime', name: t('pricingLifetime'), price: '$99.99', priceEGP: '5,000 EGP', period: t('pricingOneTime'), icon: <Infinity className="w-6 h-6" />, features: ['Everything in Yearly', 'Pay once, use forever', 'Up to 10 devices', 'VIP support', 'All future updates'] },
  ];

  async function applyCoupon() {
    if (!couponCode) return;
    setCouponLoading(true);
    setCouponError('');
    setCouponApplied(null);

    const { data, error } = await supabase.from('coupons').select('*').eq('code', couponCode.toUpperCase()).eq('is_active', true).maybeSingle();
    
    if (error || !data) {
      setCouponError('Invalid coupon code');
      setCouponLoading(false);
      return;
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setCouponError('Coupon has expired');
      setCouponLoading(false);
      return;
    }

    if (data.max_uses && data.current_uses >= data.max_uses) {
      setCouponError('Coupon usage limit reached');
      setCouponLoading(false);
      return;
    }

    // Check if user already used this coupon
    if (user) {
      const { data: usage } = await supabase.from('coupon_usage').select('id').eq('coupon_id', data.id).eq('user_id', user.id).maybeSingle();
      if (usage) {
        setCouponError('You already used this coupon');
        setCouponLoading(false);
        return;
      }
    }

    setCouponApplied(data);
    setCouponLoading(false);
  }

  async function handleCheckout(planId: string) {
    if (!user) return;
    setSelectedPlan(planId);
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/create-checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            provider,
            plan_type: planId,
            coupon_code: couponApplied?.code || null,
          }),
        }
      );

      const data = await res.json();
      if (data.checkout_url) {
        // Record coupon usage if applied
        if (couponApplied) {
          await supabase.from('coupon_usage').insert({ coupon_id: couponApplied.id, user_id: user.id } as any);
          await supabase.from('coupons').update({ current_uses: couponApplied.current_uses + 1 } as any).eq('id', couponApplied.id);
        }
        window.location.href = data.checkout_url;
      } else {
        setError(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/" className="p-2 hover:bg-secondary rounded-lg tv-focusable" data-focusable="true"><ArrowLeft className="w-5 h-5 text-foreground" /></Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('pricingTitle')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('pricingSubtitle')}</p>
        </div>
      </div>

      {/* Payment Provider Selector */}
      <div className="flex justify-center mb-8">
        <div className="bg-muted p-1 rounded-xl flex gap-1">
          <button onClick={() => setProvider('lemonsqueezy')} className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${provider === 'lemonsqueezy' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <Globe className="w-4 h-4" /> {t('pricingInternational')}
          </button>
          <button onClick={() => setProvider('paymob')} className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${provider === 'paymob' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <CreditCard className="w-4 h-4" /> {t('pricingEgypt')}
          </button>
        </div>
      </div>

      {/* Coupon Code */}
      <div className="max-w-md mx-auto mb-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('pricingCouponPlaceholder')}
              value={couponCode}
              onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponApplied(null); setCouponError(''); }}
              className="w-full ps-10 pe-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            />
          </div>
          <button onClick={applyCoupon} disabled={couponLoading || !couponCode} className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-1.5">
            {couponLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null} {t('pricingApplyCoupon')}
          </button>
        </div>
        {couponError && <p className="text-destructive text-xs mt-1.5">{couponError}</p>}
        {couponApplied && (
          <div className="bg-success/10 border border-success/30 rounded-lg p-2.5 mt-2 flex items-center gap-2">
            <Check className="w-4 h-4 text-success" />
            <span className="text-success text-sm font-medium">{t('pricingCouponApplied')} {couponApplied.discount_type === 'percentage' ? `${couponApplied.discount_value}% off` : couponApplied.discount_type === 'fixed' ? `$${couponApplied.discount_value} off` : `+${couponApplied.trial_extension_days} trial days`}</span>
          </div>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        {plans.map((plan) => (
          <div key={plan.id} className={`relative bg-card border rounded-2xl p-6 flex flex-col transition-all ${plan.popular ? 'border-primary shadow-lg shadow-primary/10 scale-[1.02]' : 'border-border'}`}>
            {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">{t('pricingMostPopular')}</div>}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${plan.popular ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>{plan.icon}</div>
            <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
            <div className="mt-2 mb-4">
              <span className="text-3xl font-bold text-foreground">{provider === 'paymob' ? plan.priceEGP : plan.price}</span>
              <span className="text-muted-foreground text-sm ms-1">{plan.period}</span>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" /><span className="text-foreground/80">{f}</span></li>
              ))}
            </ul>
            <button onClick={() => handleCheckout(plan.id)} disabled={loading && selectedPlan === plan.id} className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors tv-focusable flex items-center justify-center gap-2 ${plan.popular ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`} data-focusable="true">
              {loading && selectedPlan === plan.id ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('pricingProcessing')}</> : `${t('pricingGet')} ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      {error && <div className="max-w-md mx-auto bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 text-sm text-center">{error}</div>}
      <div className="text-center space-y-2 text-xs text-muted-foreground max-w-md mx-auto">
        <p>Payments are processed securely. We never store your card details.</p>
        <p>Subscriptions activate instantly after successful payment.</p>
      </div>
    </div>
  );
}
