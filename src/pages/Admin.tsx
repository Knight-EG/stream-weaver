import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Monitor, CreditCard, Shield, Plus, Trash2, Check, X, Search, BarChart3, Power, RefreshCw, Palette, Infinity, Clock, Key, Bell, DollarSign, Ban, Store, Tag, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { WhiteLabelSettings } from '@/components/admin/WhiteLabelSettings';
import { TrialSettings } from '@/components/admin/TrialSettings';
import { ApiKeysSettings } from '@/components/admin/ApiKeysSettings';
import { PaymentAnalytics } from '@/components/admin/PaymentAnalytics';
import { AdminNotifications } from '@/components/admin/AdminNotifications';
import { ResellerManagement } from '@/components/admin/ResellerManagement';
import { CouponManagement } from '@/components/admin/CouponManagement';
import { SecurityMonitor } from '@/components/admin/SecurityMonitor';

type Tab = 'users' | 'devices' | 'subscriptions' | 'analytics' | 'payments' | 'branding' | 'trial' | 'keys' | 'notify' | 'resellers' | 'coupons' | 'security';

export default function Admin() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<{ topChannels: any[]; totalSessions: number; activeDevices: number }>({
    topChannels: [], totalSessions: 0, activeDevices: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [profilesRes, devicesRes, subsRes, sessionsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('devices').select('*').order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').order('expires_at', { ascending: false }),
      supabase.from('streaming_sessions').select('channel_name, started_at, duration_seconds').order('started_at', { ascending: false }).limit(1000),
    ]);
    setProfiles(profilesRes.data || []);
    setDevices(devicesRes.data || []);
    setSubscriptions(subsRes.data || []);

    const sessions = sessionsRes.data || [];
    const channelCounts: Record<string, number> = {};
    sessions.forEach((s: any) => { channelCounts[s.channel_name] = (channelCounts[s.channel_name] || 0) + 1; });
    const topChannels = Object.entries(channelCounts).map(([name, views]) => ({ name, views })).sort((a, b) => b.views - a.views).slice(0, 10);
    setAnalytics({ topChannels, totalSessions: sessions.length, activeDevices: (devicesRes.data || []).filter((d: any) => d.is_active).length });
    setLoading(false);
  }

  async function toggleDevice(deviceId: string, isActive: boolean) { await supabase.from('devices').update({ is_active: !isActive }).eq('id', deviceId); loadData(); }
  async function deleteDevice(deviceId: string) { await supabase.from('devices').update({ is_active: false }).eq('id', deviceId); loadData(); }
  async function suspendSubscription(subId: string) { await supabase.from('subscriptions').update({ status: 'suspended' } as any).eq('id', subId); loadData(); }
  async function expireSubscription(subId: string) { await supabase.from('subscriptions').update({ status: 'expired' } as any).eq('id', subId); loadData(); }
  async function reactivateSubscription(subId: string) { await supabase.from('subscriptions').update({ status: 'active' } as any).eq('id', subId); loadData(); }

  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantPlanType, setGrantPlanType] = useState<'standard' | 'lifetime'>('standard');
  const [grantDays, setGrantDays] = useState(30);
  const [grantMaxDevices, setGrantMaxDevices] = useState(3);

  async function grantSubscription() {
    if (!grantUserId) return;
    const expiresAt = grantPlanType === 'lifetime' ? new Date('2099-12-31T23:59:59Z').toISOString() : new Date(Date.now() + grantDays * 86400000).toISOString();
    await supabase.from('subscriptions').insert({ user_id: grantUserId, status: 'active', plan_type: grantPlanType, expires_at: expiresAt, max_devices: grantMaxDevices } as any);
    setShowGrantModal(false);
    setGrantUserId('');
    loadData();
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'users', label: t('adminUsers'), icon: <Users className="w-4 h-4" /> },
    { id: 'devices', label: t('adminDevices'), icon: <Monitor className="w-4 h-4" /> },
    { id: 'subscriptions', label: t('adminSubs'), icon: <CreditCard className="w-4 h-4" /> },
    { id: 'analytics', label: t('adminAnalytics'), icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'payments', label: t('adminPayments'), icon: <DollarSign className="w-4 h-4" /> },
    { id: 'resellers', label: t('adminResellers'), icon: <Store className="w-4 h-4" /> },
    { id: 'coupons', label: t('adminCoupons'), icon: <Tag className="w-4 h-4" /> },
    { id: 'security', label: t('adminSecurity'), icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'notify', label: t('adminNotify'), icon: <Bell className="w-4 h-4" /> },
    { id: 'branding', label: t('adminBrand'), icon: <Palette className="w-4 h-4" /> },
    { id: 'trial', label: t('adminTrial'), icon: <Clock className="w-4 h-4" /> },
    { id: 'keys', label: t('adminApiKeys'), icon: <Key className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-secondary rounded-lg tv-focusable" data-focusable="true">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> {t('adminTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">Manage users, devices, and subscriptions</p>
        </div>
        <button onClick={loadData} className="p-2 hover:bg-secondary rounded-lg tv-focusable" data-focusable="true">
          <RefreshCw className={`w-5 h-5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('adminTotalUsers'), value: profiles.length, color: 'text-primary' },
          { label: t('adminActiveDevices'), value: analytics.activeDevices, color: 'text-success' },
          { label: t('adminActiveSubs'), value: subscriptions.filter((s: any) => s.status === 'active').length, color: 'text-accent' },
          { label: t('adminTotalSessions'), value: analytics.totalSessions, color: 'text-warning' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md text-sm font-medium transition-colors tv-focusable whitespace-nowrap px-3 ${tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-focusable="true">
            {t.icon} <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      {['users', 'devices', 'subscriptions'].includes(tab) && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder={`Search ${tab}...`} value={search} onChange={e => setSearch(e.target.value)} className="w-full ps-10 pe-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="text-start p-3 text-muted-foreground font-medium">{t('name')}</th>
              <th className="text-start p-3 text-muted-foreground font-medium hidden sm:table-cell">{t('email')}</th>
              <th className="text-start p-3 text-muted-foreground font-medium">{t('settingsMaxDevices')}</th>
              <th className="text-start p-3 text-muted-foreground font-medium">Joined</th>
            </tr></thead>
            <tbody>
              {profiles.filter((p: any) => (p.display_name || '').toLowerCase().includes(search.toLowerCase()) || (p.email || '').toLowerCase().includes(search.toLowerCase())).map((p: any) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/50">
                  <td className="p-3 text-foreground font-medium">{p.display_name || 'N/A'}</td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">{p.email}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateMaxDevices(p.user_id, Math.max(1, (p.max_devices || 3) - 1))} className="w-6 h-6 rounded bg-muted hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground text-xs font-bold tv-focusable" data-focusable="true">-</button>
                      <span className="w-8 text-center text-foreground font-medium">{p.max_devices || 3}</span>
                      <button onClick={() => updateMaxDevices(p.user_id, Math.min(10, (p.max_devices || 3) + 1))} className="w-6 h-6 rounded bg-muted hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground text-xs font-bold tv-focusable" data-focusable="true">+</button>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {profiles.length === 0 && !loading && <p className="p-6 text-center text-muted-foreground">No users yet</p>}
        </div>
      )}

      {/* Devices Tab */}
      {tab === 'devices' && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="text-start p-3 text-muted-foreground font-medium">Device</th>
              <th className="text-start p-3 text-muted-foreground font-medium hidden sm:table-cell">Device ID</th>
              <th className="text-start p-3 text-muted-foreground font-medium">Platform</th>
              <th className="text-start p-3 text-muted-foreground font-medium">Status</th>
              <th className="text-start p-3 text-muted-foreground font-medium hidden sm:table-cell">Last Seen</th>
              <th className="p-3"></th>
            </tr></thead>
            <tbody>
              {devices.filter((d: any) => d.device_name.toLowerCase().includes(search.toLowerCase())).map((d: any) => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/50">
                  <td className="p-3 text-foreground font-medium">{d.device_name}</td>
                  <td className="p-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">{d.device_id.substring(0, 12)}...</td>
                  <td className="p-3 text-muted-foreground capitalize">{d.platform}</td>
                  <td className="p-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${d.is_active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>{d.is_active ? 'Active' : 'Disabled'}</span></td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">{new Date(d.last_seen_at).toLocaleDateString()}</td>
                  <td className="p-3 flex gap-1">
                    <button onClick={() => toggleDevice(d.id, d.is_active)} className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true"><Power className="w-4 h-4" /></button>
                    <button onClick={() => deleteDevice(d.id)} className="p-1.5 text-muted-foreground hover:text-destructive tv-focusable rounded" data-focusable="true"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {devices.length === 0 && !loading && <p className="p-6 text-center text-muted-foreground">No devices registered</p>}
        </div>
      )}

      {/* Subscriptions Tab */}
      {tab === 'subscriptions' && (
        <div className="space-y-4">
          <button onClick={() => setShowGrantModal(true)} className="px-4 py-2.5 rounded-lg gradient-primary text-primary-foreground font-semibold tv-focusable flex items-center gap-2 text-sm" data-focusable="true">
            <Plus className="w-4 h-4" /> {t('adminGrantSubscription')}
          </button>

          {showGrantModal && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-foreground font-semibold">{t('adminGrantSubscription')}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">User</label>
                  <select value={grantUserId} onChange={e => setGrantUserId(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"><option value="">Select user...</option>{profiles.map((p: any) => (<option key={p.user_id} value={p.user_id}>{p.display_name || p.email}</option>))}</select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Plan Type</label>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setGrantPlanType('standard')} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${grantPlanType === 'standard' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}><Clock className="w-3.5 h-3.5" /> Standard</button>
                    <button onClick={() => setGrantPlanType('lifetime')} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${grantPlanType === 'lifetime' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}><Infinity className="w-3.5 h-3.5" /> Lifetime</button>
                  </div>
                </div>
                {grantPlanType === 'standard' && (
                  <div><label className="text-xs text-muted-foreground font-medium">Duration (days)</label><input type="number" min={1} value={grantDays} onChange={e => setGrantDays(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" /></div>
                )}
                <div><label className="text-xs text-muted-foreground font-medium">Max Devices</label><input type="number" min={1} max={10} value={grantMaxDevices} onChange={e => setGrantMaxDevices(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={grantSubscription} className="flex-1 py-2.5 rounded-lg gradient-primary text-primary-foreground font-semibold text-sm tv-focusable" data-focusable="true">Grant</button>
                <button onClick={() => setShowGrantModal(false)} className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm tv-focusable" data-focusable="true">{t('cancel')}</button>
              </div>
            </div>
          )}

          {subscriptions.filter((s: any) => search ? profiles.find((p: any) => p.user_id === s.user_id && (p.display_name || p.email || '').toLowerCase().includes(search.toLowerCase())) : true).map((s: any) => {
            const profile = profiles.find((p: any) => p.user_id === s.user_id);
            const isLifetime = (s as any).plan_type === 'lifetime';
            const isExpired = !isLifetime && new Date(s.expires_at) < new Date();
            const isActive = s.status === 'active' && !isExpired;
            return (
              <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div><p className="text-foreground font-medium">{profile?.display_name || 'Unknown'}</p><p className="text-sm text-muted-foreground">{profile?.email}</p></div>
                <div className="flex items-center gap-3">
                  <div className="text-end">
                    <p className="text-sm text-muted-foreground">{isLifetime ? 'Lifetime' : `Expires: ${new Date(s.expires_at).toLocaleDateString()}`}</p>
                    <div className="flex items-center gap-2 justify-end">
                      {isLifetime && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/20 text-accent"><Infinity className="w-3 h-3" /> Lifetime</span>}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-success/20 text-success' : s.status === 'suspended' ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'}`}>{isActive ? 'Active' : s.status === 'suspended' ? 'Suspended' : 'Expired'}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {isActive && (<><button onClick={() => suspendSubscription(s.id)} className="p-1.5 text-muted-foreground hover:text-warning tv-focusable rounded" data-focusable="true" title="Suspend"><Ban className="w-4 h-4" /></button><button onClick={() => expireSubscription(s.id)} className="p-1.5 text-muted-foreground hover:text-destructive tv-focusable rounded" data-focusable="true" title="Expire"><X className="w-4 h-4" /></button></>)}
                    {!isActive && <button onClick={() => reactivateSubscription(s.id)} className="p-1.5 text-muted-foreground hover:text-success tv-focusable rounded" data-focusable="true" title="Reactivate"><Check className="w-4 h-4" /></button>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Max {s.max_devices} devices</p>
              </div>
            );
          })}
          {subscriptions.length === 0 && !loading && <p className="p-6 text-center text-muted-foreground">No subscriptions</p>}
        </div>
      )}

      {/* Analytics Tab */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Most Watched Channels</h3>
            {analytics.topChannels.length > 0 ? (
              <div className="space-y-3">
                {analytics.topChannels.map((ch, i) => (
                  <div key={ch.name} className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-6 text-end">{i + 1}.</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1"><span className="text-foreground text-sm font-medium truncate">{ch.name}</span><span className="text-muted-foreground text-xs">{ch.views} views</span></div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden"><div className="h-full gradient-primary rounded-full transition-all" style={{ width: `${(ch.views / analytics.topChannels[0].views) * 100}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-sm">No streaming data yet</p>}
          </div>
        </div>
      )}

      {tab === 'payments' && <PaymentAnalytics />}
      {tab === 'resellers' && <ResellerManagement />}
      {tab === 'coupons' && <CouponManagement />}
      {tab === 'security' && <SecurityMonitor />}
      {tab === 'notify' && <AdminNotifications profiles={profiles} />}
      {tab === 'branding' && <WhiteLabelSettings />}
      {tab === 'trial' && <TrialSettings />}
      {tab === 'keys' && <ApiKeysSettings />}
    </div>
  );
}
