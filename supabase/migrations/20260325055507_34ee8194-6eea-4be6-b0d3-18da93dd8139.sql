
-- Reseller wallets table
CREATE TABLE public.reseller_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  total_earned_cents INTEGER NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reseller_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all wallets" ON public.reseller_wallets
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Resellers can view own wallet" ON public.reseller_wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Reseller transactions
CREATE TABLE public.reseller_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'credit_purchase',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  target_user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reseller_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all transactions" ON public.reseller_transactions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Resellers can view own transactions" ON public.reseller_transactions
  FOR SELECT TO authenticated USING (auth.uid() = reseller_id);
CREATE POLICY "Resellers can insert own transactions" ON public.reseller_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reseller_id);

-- Coupons table
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  trial_extension_days INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT NULL,
  current_uses INTEGER NOT NULL DEFAULT 0,
  plan_type TEXT DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coupons" ON public.coupons
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can read active coupons" ON public.coupons
  FOR SELECT TO authenticated USING (is_active = true);

-- Coupon usage tracking
CREATE TABLE public.coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all usage" ON public.coupon_usage
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own usage" ON public.coupon_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage" ON public.coupon_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Security logs for anti-abuse
CREATE TABLE public.security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage security logs" ON public.security_logs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Add 'reseller' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reseller';

-- Indexes for performance
CREATE INDEX idx_reseller_transactions_reseller ON public.reseller_transactions(reseller_id);
CREATE INDEX idx_reseller_transactions_created ON public.reseller_transactions(created_at DESC);
CREATE INDEX idx_coupons_code ON public.coupons(code);
CREATE INDEX idx_coupon_usage_coupon ON public.coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_user ON public.coupon_usage(user_id);
CREATE INDEX idx_security_logs_user ON public.security_logs(user_id);
CREATE INDEX idx_security_logs_created ON public.security_logs(created_at DESC);
CREATE INDEX idx_security_logs_type ON public.security_logs(event_type);

-- Trigger for updated_at on reseller_wallets
CREATE TRIGGER update_reseller_wallets_updated_at
  BEFORE UPDATE ON public.reseller_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
