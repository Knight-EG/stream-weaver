
-- Add delete policy for notifications so users can delete their own
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
TO public
USING (auth.uid() = user_id);

-- Update handle_new_user to read trial_days from app_settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  trial_interval INTERVAL;
  trial_val TEXT;
BEGIN
  -- Read trial days from app_settings, default 3
  SELECT value INTO trial_val FROM public.app_settings WHERE key = 'trial_days';
  trial_interval := (COALESCE(trial_val, '3')::INT || ' days')::INTERVAL;
  
  INSERT INTO public.profiles (user_id, email, display_name, trial_ends_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), now() + trial_interval);
  RETURN NEW;
END;
$function$;
