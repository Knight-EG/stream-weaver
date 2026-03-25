import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, User, Monitor, CreditCard, Lock, Loader2, Power, Trash2, LogOut } from 'lucide-react';

export default function Settings() {
  const { user, signOut, updatePassword } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'profile' | 'devices' | 'security'>('profile');

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [profileRes, devicesRes, subRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user!.id).single(),
      supabase.from('devices').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').eq('user_id', user!.id).eq('status', 'active').order('expires_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setProfile(profileRes.data);
    setDevices(devicesRes.data || []);
    setSubscription(subRes.data);
    setLoading(false);
  }

  async function toggleDevice(id: string, isActive: boolean) {
    await supabase.from('devices').update({ is_active: !isActive }).eq('id', id);
    loadData();
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');
    if (newPassword !== confirmPassword) { setPassError('Passwords do not match'); return; }
    if (newPassword.length < 6) { setPassError('Min 6 characters'); return; }
    setPassLoading(true);
    const result = await updatePassword(newPassword);
    setPassLoading(false);
    if (result.error) setPassError(result.error);
    else { setPassSuccess('Password updated!'); setNewPassword(''); setConfirmPassword(''); }
  }

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'devices' as const, label: 'Devices', icon: <Monitor className="w-4 h-4" /> },
    { id: 'security' as const, label: 'Security', icon: <Lock className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-secondary rounded-lg tv-focusable" data-focusable="true">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <button onClick={signOut} className="ml-auto flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg tv-focusable" data-focusable="true">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors tv-focusable ${
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            data-focusable="true"
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{profile?.display_name || 'User'}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Max Devices</p>
              <p className="text-foreground font-medium">{profile?.max_devices || 3}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Subscription</p>
              {subscription ? (
                <p className="text-success font-medium">Active until {new Date(subscription.expires_at).toLocaleDateString()}</p>
              ) : (
                <p className="text-warning font-medium">No active subscription</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'devices' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {devices.filter(d => d.is_active).length} / {profile?.max_devices || 3} devices active
          </p>
          {devices.map(d => (
            <div key={d.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-foreground font-medium">{d.device_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{d.platform} · {new Date(d.last_seen_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.is_active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                  {d.is_active ? 'Active' : 'Disabled'}
                </span>
                <button
                  onClick={() => toggleDevice(d.id, d.is_active)}
                  className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded"
                  data-focusable="true"
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {devices.length === 0 && <p className="text-center text-muted-foreground py-8">No devices registered</p>}
        </div>
      )}

      {tab === 'security' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-foreground font-semibold mb-4">Change Password</h3>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable"
                data-focusable="true"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable"
                data-focusable="true"
              />
            </div>
            {passError && <p className="text-destructive text-sm">{passError}</p>}
            {passSuccess && <p className="text-success text-sm">{passSuccess}</p>}
            <button
              type="submit"
              disabled={passLoading}
              className="px-6 py-3 rounded-lg gradient-primary text-primary-foreground font-semibold tv-focusable disabled:opacity-50 flex items-center gap-2"
              data-focusable="true"
            >
              {passLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Update Password
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
