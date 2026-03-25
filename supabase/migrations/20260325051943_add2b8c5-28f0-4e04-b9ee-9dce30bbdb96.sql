
-- Performance indexes for production
CREATE INDEX IF NOT EXISTS idx_devices_user_active ON public.devices (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices (device_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions (user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_user ON public.streaming_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_channel ON public.streaming_sessions (channel_name);
CREATE INDEX IF NOT EXISTS idx_epg_channel_time ON public.epg_data (channel_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_playlist_cache_user_key ON public.playlist_cache (user_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_playlist_cache_expires ON public.playlist_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_unique_per_user ON public.devices (user_id, device_id);

-- Add trigger for handle_new_user (was missing from triggers)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_devices_updated_at ON public.devices;
CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Re-create device limit trigger
DROP TRIGGER IF EXISTS check_device_limit_trigger ON public.devices;
CREATE TRIGGER check_device_limit_trigger
  BEFORE INSERT ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.check_device_limit();

-- Re-create device uniqueness trigger  
DROP TRIGGER IF EXISTS check_device_uniqueness_trigger ON public.devices;
CREATE TRIGGER check_device_uniqueness_trigger
  BEFORE INSERT ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.check_device_id_uniqueness();

-- Enable realtime for streaming_sessions for live analytics
ALTER PUBLICATION supabase_realtime ADD TABLE public.streaming_sessions;
