
-- TV Activations table: links MAC address to user + playlist
CREATE TABLE public.tv_activations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mac_address TEXT NOT NULL,
  activation_code TEXT NOT NULL,
  user_id UUID DEFAULT NULL,
  playlist_source JSONB DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  device_name TEXT DEFAULT 'Smart TV',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(mac_address),
  UNIQUE(activation_code)
);

-- Enable RLS
ALTER TABLE public.tv_activations ENABLE ROW LEVEL SECURITY;

-- Pending activations can be read by anyone (TV needs to poll by mac/code)
CREATE POLICY "Anyone can read by activation_code" ON public.tv_activations
  FOR SELECT TO public
  USING (true);

-- Anyone can insert (TV creates activation record)
CREATE POLICY "Anyone can insert activation" ON public.tv_activations
  FOR INSERT TO public
  WITH CHECK (true);

-- Authenticated users can update (link their account)
CREATE POLICY "Authenticated users can update activations" ON public.tv_activations
  FOR UPDATE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

-- Admins can manage all
CREATE POLICY "Admins can manage all activations" ON public.tv_activations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_tv_activations_updated_at
  BEFORE UPDATE ON public.tv_activations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
