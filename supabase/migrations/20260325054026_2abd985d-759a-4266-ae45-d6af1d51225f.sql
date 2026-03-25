
-- Payments table to track all transactions
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('lemonsqueezy', 'paymob')),
  provider_payment_id text,
  provider_order_id text,
  plan_type text NOT NULL CHECK (plan_type IN ('monthly', 'yearly', 'lifetime')),
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view own payments
CREATE POLICY "Users can view own payments"
ON public.payments FOR SELECT TO public
USING (auth.uid() = user_id);

-- Admins can manage all payments
CREATE POLICY "Admins can manage all payments"
ON public.payments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert payments (for webhooks via service role)
CREATE POLICY "Service can insert payments"
ON public.payments FOR INSERT TO public
WITH CHECK (auth.uid() = user_id);

-- Index for quick lookups
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_provider_id ON public.payments(provider, provider_payment_id);
CREATE INDEX idx_payments_status ON public.payments(status);

-- Updated at trigger
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
