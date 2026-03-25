
-- White-label settings table
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('app_name', 'IPTV Player'),
  ('app_logo_url', ''),
  ('primary_color', '199 89% 48%'),
  ('accent_color', '265 70% 58%'),
  ('background_color', '220 20% 7%');
