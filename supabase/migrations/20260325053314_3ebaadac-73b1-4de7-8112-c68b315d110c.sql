
-- Add plan_type column to subscriptions for lifetime support
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'standard';
