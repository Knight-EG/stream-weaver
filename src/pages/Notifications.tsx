import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCheck, Filter, Monitor, CreditCard, AlertTriangle, Info, Clock, Trash2 } from 'lucide-react';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';

const typeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  device: { icon: <Monitor className="w-4 h-4" />, label: 'Device', color: 'text-primary bg-primary/10' },
  subscription: { icon: <CreditCard className="w-4 h-4" />, label: 'Subscription', color: 'text-success bg-success/10' },
  warning: { icon: <AlertTriangle className="w-4 h-4" />, label: 'Warning', color: 'text-warning bg-warning/10' },
  error: { icon: <AlertTriangle className="w-4 h-4" />, label: 'Error', color: 'text-destructive bg-destructive/10' },
  trial: { icon: <Clock className="w-4 h-4" />, label: 'Trial', color: 'text-warning bg-warning/10' },
  info: { icon: <Info className="w-4 h-4" />, label: 'Info', color: 'text-primary bg-primary/10' },
};

type FilterType = 'all' | 'unread' | 'device' | 'subscription' | 'warning' | 'trial' | 'info';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export default function Notifications() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, refresh } = useNotifications();
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.is_read);
    return notifications.filter(n => n.type === filter);
  }, [notifications, filter]);

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    refresh();
  };

  const deleteAllRead = async () => {
    const readIds = notifications.filter(n => n.is_read).map(n => n.id);
    if (readIds.length === 0) return;
    for (const id of readIds) {
      await supabase.from('notifications').delete().eq('id', id);
    }
    refresh();
  };

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: `All (${notifications.length})` },
    { id: 'unread', label: `Unread (${unreadCount})` },
    { id: 'device', label: 'Devices' },
    { id: 'subscription', label: 'Subs' },
    { id: 'warning', label: 'Warnings' },
    { id: 'trial', label: 'Trial' },
  ];

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-secondary rounded-lg tv-focusable" data-focusable="true">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-2 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 tv-focusable flex items-center gap-1.5"
              data-focusable="true"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
          {notifications.some(n => n.is_read) && (
            <button
              onClick={deleteAllRead}
              className="px-3 py-2 text-xs font-medium bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 tv-focusable flex items-center gap-1.5"
              data-focusable="true"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear read
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors tv-focusable ${
              filter === f.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
            data-focusable="true"
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications in this category'}
            </p>
          </div>
        ) : (
          filtered.map(n => {
            const config = typeConfig[n.type] || typeConfig.info;
            return (
              <div
                key={n.id}
                className={`bg-card border border-border rounded-xl p-4 flex gap-3 transition-colors group ${
                  !n.is_read ? 'border-l-2 border-l-primary' : ''
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm ${!n.is_read ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                          {n.title}
                        </h3>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-muted-foreground/70">{formatDate(n.created_at)}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${config.color}`}>{config.label}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {!n.is_read && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="p-1.5 text-muted-foreground hover:text-primary rounded tv-focusable"
                          data-focusable="true"
                          title="Mark as read"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(n.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive rounded tv-focusable"
                        data-focusable="true"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
