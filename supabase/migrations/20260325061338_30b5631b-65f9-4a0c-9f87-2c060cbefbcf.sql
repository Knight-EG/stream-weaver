
-- Change default max_devices from 3 to 1
ALTER TABLE public.profiles ALTER COLUMN max_devices SET DEFAULT 1;

-- Update existing profiles to max 1 device
UPDATE public.profiles SET max_devices = 1 WHERE max_devices > 1;

-- Update default max_devices in subscriptions table  
ALTER TABLE public.subscriptions ALTER COLUMN max_devices SET DEFAULT 1;

-- Update existing subscriptions
UPDATE public.subscriptions SET max_devices = 1 WHERE max_devices > 1;

-- Update the check_device_limit function to enforce strict 1 device
CREATE OR REPLACE FUNCTION public.check_device_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  device_count INT;
  max_allowed INT;
BEGIN
  -- Count currently active devices for this user
  SELECT COUNT(*) INTO device_count FROM public.devices WHERE user_id = NEW.user_id AND is_active = true;
  
  -- Get max allowed (should be 1)
  SELECT COALESCE(s.max_devices, p.max_devices, 1) INTO max_allowed
  FROM public.profiles p
  LEFT JOIN public.subscriptions s ON s.user_id = p.user_id AND s.status = 'active'
  WHERE p.user_id = NEW.user_id;
  
  IF device_count >= max_allowed THEN
    RAISE EXCEPTION 'Device limit reached. Only % device(s) allowed per account. Please deactivate your current device first.', max_allowed;
  END IF;
  RETURN NEW;
END;
$function$;
