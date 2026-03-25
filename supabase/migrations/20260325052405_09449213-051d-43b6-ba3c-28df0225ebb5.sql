
-- Add trial period to profiles (default 3 days trial)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone DEFAULT (now() + interval '3 days');

-- Update handle_new_user to set trial_ends_at
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, trial_ends_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), now() + interval '3 days');
  RETURN NEW;
END;
$$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);

-- Function to create notification on new device registration
CREATE OR REPLACE FUNCTION public.notify_new_device()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    NEW.user_id,
    'New Device Registered',
    'A new ' || NEW.device_name || ' (' || NEW.platform || ') has been registered to your account.',
    'device',
    jsonb_build_object('device_id', NEW.device_id, 'device_name', NEW.device_name, 'platform', NEW.platform)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_device_registered
  AFTER INSERT ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_device();

-- Function to notify on subscription status change
CREATE OR REPLACE FUNCTION public.notify_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (NEW.user_id, 'Subscription Activated', 'Your subscription is now active until ' || to_char(NEW.expires_at, 'YYYY-MM-DD') || '.', 'subscription', jsonb_build_object('expires_at', NEW.expires_at, 'status', 'active'));
  ELSIF NEW.status = 'expired' AND OLD.status = 'active' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (NEW.user_id, 'Subscription Expired', 'Your subscription has expired. Please renew to continue using the service.', 'warning', jsonb_build_object('status', 'expired'));
  ELSIF NEW.status = 'suspended' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (NEW.user_id, 'Subscription Suspended', 'Your subscription has been suspended. Please contact support.', 'error', jsonb_build_object('status', 'suspended'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_change();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
