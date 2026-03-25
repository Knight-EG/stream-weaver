-- Fix default max_devices from 1 to 3
ALTER TABLE public.profiles ALTER COLUMN max_devices SET DEFAULT 3;

-- Update existing profiles that have max_devices = 1 (wrong default) to 3
UPDATE public.profiles SET max_devices = 3 WHERE max_devices = 1;

-- Drop duplicate triggers
DROP TRIGGER IF EXISTS check_device_limit_trigger ON public.devices;
DROP TRIGGER IF EXISTS check_device_uniqueness_trigger ON public.devices;

-- Update the check_device_limit function to use 3 as fallback
CREATE OR REPLACE FUNCTION check_device_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  device_count INT;
  max_allowed INT;
BEGIN
  SELECT COUNT(*) INTO device_count FROM public.devices WHERE user_id = NEW.user_id AND is_active = true;
  
  SELECT COALESCE(s.max_devices, p.max_devices, 3) INTO max_allowed
  FROM public.profiles p
  LEFT JOIN public.subscriptions s ON s.user_id = p.user_id AND s.status = 'active'
  WHERE p.user_id = NEW.user_id;

  -- Default to 3 if no profile found
  IF max_allowed IS NULL THEN
    max_allowed := 3;
  END IF;
  
  IF device_count >= max_allowed THEN
    RAISE EXCEPTION 'Device limit reached. Only % device(s) allowed per account.', max_allowed;
  END IF;
  RETURN NEW;
END;
$$;