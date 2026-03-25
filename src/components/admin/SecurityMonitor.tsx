import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { Shield, AlertTriangle, Loader2, Eye, Ban } from 'lucide-react';

export function SecurityMonitor() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [logsRes, profilesRes] = await Promise.all([
      supabase.from('security_logs').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('user_id, display_name, email'),
    ]);
    setLogs(logsRes.data || []);
    setProfiles(profilesRes.data || []);
    setLoading(false);
  }

  const getUser = (userId: string) => {
    const p = profiles.find(p => p.user_id === userId);
    return p?.display_name || p?.email || userId.substring(0, 8);
  };

  const severityColor: Record<string, string> = {
    info: 'bg-primary/20 text-primary',
    warning: 'bg-warning/20 text-warning',
    critical: 'bg-destructive/20 text-destructive',
  };

  const eventTypes = [...new Set(logs.map(l => l.event_type))];
  const filtered = filter === 'all' ? logs : logs.filter(l => l.event_type === filter);

  // Stats
  const criticalCount = logs.filter(l => l.severity === 'critical').length;
  const warningCount = logs.filter(l => l.severity === 'warning').length;
  const last24h = logs.filter(l => new Date(l.created_at) > new Date(Date.now() - 86400000)).length;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Critical Events</p>
          <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Warnings</p>
          <p className="text-2xl font-bold text-warning">{warningCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Last 24h</p>
          <p className="text-2xl font-bold text-primary">{last24h}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          All ({logs.length})
        </button>
        {eventTypes.map(et => (
          <button key={et} onClick={() => setFilter(et)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === et ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {et.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Logs */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-3 text-success/30" />
            <p className="text-muted-foreground">No security events</p>
          </div>
        ) : (
          filtered.map(log => (
            <div key={log.id} className="bg-card border border-border rounded-xl p-4 flex gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${severityColor[log.severity] || severityColor.info}`}>
                {log.severity === 'critical' ? <AlertTriangle className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground capitalize">{log.event_type.replace(/_/g, ' ')}</h3>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${severityColor[log.severity] || severityColor.info}`}>{log.severity}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{getUser(log.user_id)}</p>
                {log.details && Object.keys(log.details).length > 0 && (
                  <p className="text-xs text-muted-foreground/70 mt-1 font-mono">{JSON.stringify(log.details).substring(0, 100)}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-muted-foreground/70">{new Date(log.created_at).toLocaleString()}</span>
                  {log.ip_address && <span className="text-[10px] text-muted-foreground/70 font-mono">{log.ip_address}</span>}
                  {log.device_id && <span className="text-[10px] text-muted-foreground/70 font-mono">{log.device_id.substring(0, 8)}...</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
