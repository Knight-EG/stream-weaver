import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Zap, Crown, Infinity, Globe, CreditCard, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
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

const plans: Plan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$4.99',
    priceEGP: '250 EGP',
    period: '/month',
    icon: <Zap className="w-6 h-6" />,
    features: ['Full channel access', 'Up to 3 devices', 'HD streaming', 'EPG support', 'Cancel anytime'],
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: '$39.99',
    priceEGP: '2,000 EGP',
    period: '/year',
    popular: true,
    icon: <Crown className="w-6 h-6" />,
    features: ['Everything in Monthly', 'Save 33%', 'Priority support', 'Up to 5 devices', 'Early access to features'],
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: '$99.99',
    priceEGP: '5,000 EGP',
    period: 'one-time',
    icon: <Infinity className="w-6 h-6" />,
    features: ['Everything in Yearly', 'Pay once, use forever', 'Up to 10 devices', 'VIP support', 'All future updates'],
  },
];

type PaymentProvider = 'lemonsqueezy' | 'paymob';

export default function Pricing() {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>('lemonsqueezy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ provider, plan_type: planId }),
        }
      );

      const data = await res.json();
      if (data.checkout_url) {
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
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/" className="p-2 hover:bg-secondary rounded-lg tv-focusable" data-focusable="true">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Choose Your Plan</h1>
          <p className="text-muted-foreground text-sm mt-1">Select a plan to unlock full access</p>
        </div>
      </div>

      {/* Payment Provider Selector */}
      <div className="flex justify-center mb-8">
        <div className="bg-muted p-1 rounded-xl flex gap-1">
          <button
            onClick={() => setProvider('lemonsqueezy')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              provider === 'lemonsqueezy' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="w-4 h-4" /> International (USD)
          </button>
          <button
            onClick={() => setProvider('paymob')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              provider === 'paymob' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Egypt (EGP)
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-card border rounded-2xl p-6 flex flex-col transition-all ${
              plan.popular ? 'border-primary shadow-lg shadow-primary/10 scale-[1.02]' : 'border-border'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                Most Popular
              </div>
            )}

            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
              plan.popular ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {plan.icon}
            </div>

            <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
            <div className="mt-2 mb-4">
              <span className="text-3xl font-bold text-foreground">
                {provider === 'paymob' ? plan.priceEGP : plan.price}
              </span>
              <span className="text-muted-foreground text-sm ml-1">{plan.period}</span>
            </div>

            <ul className="space-y-2.5 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={loading && selectedPlan === plan.id}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors tv-focusable flex items-center justify-center gap-2 ${
                plan.popular
                  ? 'gradient-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
              data-focusable="true"
            >
              {loading && selectedPlan === plan.id ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                `Get ${plan.name}`
              )}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div className="max-w-md mx-auto bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 text-sm text-center">
          {error}
        </div>
      )}

      {/* Info */}
      <div className="text-center space-y-2 text-xs text-muted-foreground max-w-md mx-auto">
        <p>Payments are processed securely. We never store your card details.</p>
        <p>Subscriptions activate instantly after successful payment.</p>
      </div>
    </div>
  );
}
