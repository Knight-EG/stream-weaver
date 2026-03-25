import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Monitor, CreditCard, Shield, Plus, Trash2, Check, X, Search } from 'lucide-react';

interface Device {
  id: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  userId: string;
  active: boolean;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  subscriptionEnd: string;
  active: boolean;
  devices: number;
}

// Mock data for now — will be connected to Lovable Cloud
const mockUsers: User[] = [
  { id: '1', email: 'user1@example.com', name: 'John Doe', subscriptionEnd: '2025-12-31', active: true, devices: 2 },
  { id: '2', email: 'user2@example.com', name: 'Jane Smith', subscriptionEnd: '2025-06-15', active: true, devices: 1 },
  { id: '3', email: 'user3@example.com', name: 'Bob Wilson', subscriptionEnd: '2025-01-01', active: false, devices: 0 },
];

const mockDevices: Device[] = [
  { id: '1', deviceId: 'abc-123', deviceName: 'Samsung TV', platform: 'tizen', userId: '1', active: true, createdAt: '2025-01-15' },
  { id: '2', deviceId: 'def-456', deviceName: 'Web Browser', platform: 'web', userId: '1', active: true, createdAt: '2025-02-01' },
  { id: '3', deviceId: 'ghi-789', deviceName: 'LG TV', platform: 'webos', userId: '2', active: true, createdAt: '2025-03-10' },
];

type Tab = 'users' | 'devices' | 'subscriptions';

export default function Admin() {
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { id: 'devices', label: 'Devices', icon: <Monitor className="w-4 h-4" /> },
    { id: 'subscriptions', label: 'Subscriptions', icon: <CreditCard className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-secondary rounded-lg tv-focusable" data-focusable="true">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">Manage users, devices, and subscriptions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: mockUsers.length, color: 'text-primary' },
          { label: 'Active Devices', value: mockDevices.filter(d => d.active).length, color: 'text-success' },
          { label: 'Active Subs', value: mockUsers.filter(u => u.active).length, color: 'text-accent' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
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

      {/* Search */}
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

      {/* Content */}
      {tab === 'users' && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-medium tv-focusable" data-focusable="true">
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">Name</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Email</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Expires</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Devices</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {mockUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())).map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/50">
                    <td className="p-3 text-foreground font-medium">{u.name}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3 text-muted-foreground">{u.subscriptionEnd}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                      }`}>
                        {u.active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {u.active ? 'Active' : 'Expired'}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{u.devices}</td>
                    <td className="p-3">
                      <button className="p-1.5 text-muted-foreground hover:text-destructive tv-focusable rounded" data-focusable="true">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'devices' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Device</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Device ID</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Platform</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Added</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {mockDevices.filter(d => d.deviceName.toLowerCase().includes(search.toLowerCase())).map(d => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/50">
                  <td className="p-3 text-foreground font-medium">{d.deviceName}</td>
                  <td className="p-3 text-muted-foreground font-mono text-xs">{d.deviceId}</td>
                  <td className="p-3 text-muted-foreground capitalize">{d.platform}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                    }`}>
                      {d.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{d.createdAt}</td>
                  <td className="p-3">
                    <button className="p-1.5 text-muted-foreground hover:text-destructive tv-focusable rounded" data-focusable="true">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'subscriptions' && (
        <div className="space-y-4">
          {mockUsers.map(u => (
            <div key={u.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-foreground font-medium">{u.name}</p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Expires: {u.subscriptionEnd}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  u.active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                }`}>
                  {u.active ? 'Active' : 'Expired'}
                </span>
              </div>
              <button className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium tv-focusable hover:bg-primary/20" data-focusable="true">
                Extend
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
