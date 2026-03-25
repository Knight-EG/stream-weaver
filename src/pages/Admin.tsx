import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Monitor, CreditCard, Shield, Plus, Trash2, Check, X, Search, BarChart3, Power, RefreshCw, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { WhiteLabelSettings } from '@/components/admin/WhiteLabelSettings';

type Tab = 'users' | 'devices' | 'subscriptions' | 'analytics' | 'branding';

export default function Admin() {
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<{ topChannels: any[]; totalSessions: number; activeDevices: number }>({
    topChannels: [], totalSessions: 0, activeDevices: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

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

    // Compute analytics
    const sessions = sessionsRes.data || [];
    const channelCounts: Record<string, number> = {};
    sessions.forEach((s: any) => {
      channelCounts[s.channel_name] = (channelCounts[s.channel_name] || 0) + 1;
    });
    const topChannels = Object.entries(channelCounts)
      .map(([name, views]) => ({ name, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    setAnalytics({
      topChannels,
      totalSessions: sessions.length,
      activeDevices: (devicesRes.data || []).filter((d: any) => d.is_active).length,
    });
    setLoading(false);
  }

  async function toggleDevice(deviceId: string, isActive: boolean) {
    await supabase.from('devices').update({ is_active: !isActive }).eq('id', deviceId);
    loadData();
  }

  async function deleteDevice(deviceId: string) {
    await supabase.from('devices').update({ is_active: false }).eq('id', deviceId);
    loadData();
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { id: 'devices', label: 'Devices', icon: <Monitor className="w-4 h-4" /> },
    { id: 'subscriptions', label: 'Subs', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
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
            <Shield className="w-6 h-6 text-primary" /> Admin Dashboard
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
          { label: 'Total Users', value: profiles.length, color: 'text-primary' },
          { label: 'Active Devices', value: analytics.activeDevices, color: 'text-success' },
          { label: 'Active Subs', value: subscriptions.filter((s: any) => s.status === 'active').length, color: 'text-accent' },
          { label: 'Total Sessions', value: analytics.totalSessions, color: 'text-warning' },
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
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-sm font-medium transition-colors tv-focusable whitespace-nowrap px-3 ${
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            data-focusable="true"
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab !== 'analytics' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${tab}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Name</th>
                <th className="text-left p-3 text-muted-foreground font-medium hidden sm:table-cell">Email</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Max Devices</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {profiles.filter((p: any) =>
                (p.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.email || '').toLowerCase().includes(search.toLowerCase())
              ).map((p: any) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/50">
                  <td className="p-3 text-foreground font-medium">{p.display_name || 'N/A'}</td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">{p.email}</td>
                  <td className="p-3 text-muted-foreground">{p.max_devices}</td>
                  <td className="p-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {profiles.length === 0 && !loading && (
            <p className="p-6 text-center text-muted-foreground">No users yet</p>
          )}
        </div>
      )}

      {/* Devices Tab */}
      {tab === 'devices' && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Device</th>
                <th className="text-left p-3 text-muted-foreground font-medium hidden sm:table-cell">Device ID</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Platform</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-3 text-muted-foreground font-medium hidden sm:table-cell">Last Seen</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {devices.filter((d: any) => d.device_name.toLowerCase().includes(search.toLowerCase())).map((d: any) => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/50">
                  <td className="p-3 text-foreground font-medium">{d.device_name}</td>
                  <td className="p-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">{d.device_id.substring(0, 12)}...</td>
                  <td className="p-3 text-muted-foreground capitalize">{d.platform}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.is_active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                    }`}>
                      {d.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">{new Date(d.last_seen_at).toLocaleDateString()}</td>
                  <td className="p-3 flex gap-1">
                    <button
                      onClick={() => toggleDevice(d.id, d.is_active)}
                      className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded"
                      data-focusable="true"
                      title={d.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteDevice(d.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive tv-focusable rounded"
                      data-focusable="true"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {devices.length === 0 && !loading && (
            <p className="p-6 text-center text-muted-foreground">No devices registered</p>
          )}
        </div>
      )}

      {/* Subscriptions Tab */}
      {tab === 'subscriptions' && (
        <div className="space-y-3">
          {subscriptions
            .filter((s: any) => search ? profiles.find((p: any) => p.user_id === s.user_id && (p.display_name || p.email || '').toLowerCase().includes(search.toLowerCase())) : true)
            .map((s: any) => {
              const profile = profiles.find((p: any) => p.user_id === s.user_id);
              const isExpired = new Date(s.expires_at) < new Date();
              return (
                <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-foreground font-medium">{profile?.display_name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Expires: {new Date(s.expires_at).toLocaleDateString()}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        !isExpired && s.status === 'active' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                      }`}>
                        {!isExpired && s.status === 'active' ? 'Active' : 'Expired'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Max {s.max_devices} devices</p>
                  </div>
                </div>
              );
            })}
          {subscriptions.length === 0 && !loading && (
            <p className="p-6 text-center text-muted-foreground">No subscriptions</p>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Most Watched Channels
            </h3>
            {analytics.topChannels.length > 0 ? (
              <div className="space-y-3">
                {analytics.topChannels.map((ch, i) => (
                  <div key={ch.name} className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-6 text-right">{i + 1}.</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-foreground text-sm font-medium truncate">{ch.name}</span>
                        <span className="text-muted-foreground text-xs">{ch.views} views</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full gradient-primary rounded-full transition-all"
                          style={{ width: `${(ch.views / analytics.topChannels[0].views) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No streaming data yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
