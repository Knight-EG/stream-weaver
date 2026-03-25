import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Monitor, CreditCard, AlertTriangle, Info, Clock, X } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

const typeIcons: Record<string, React.ReactNode> = {
  device: <Monitor className="w-4 h-4 text-primary" />,
  subscription: <CreditCard className="w-4 h-4 text-success" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning" />,
  error: <AlertTriangle className="w-4 h-4 text-destructive" />,
  trial: <Clock className="w-4 h-4 text-warning" />,
  info: <Info className="w-4 h-4 text-primary" />,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const top = Math.min(rect.bottom + 8, window.innerHeight - 120);

    setPanelStyle({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePanelPosition();
    const handleResize = () => updatePanelPosition();
    const handleScroll = () => updatePanelPosition();
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [open, updatePanelPosition]);

  const panel = open && panelStyle
    ? createPortal(
        <div className="fixed inset-0 z-[80] pointer-events-none">
          <div className="fixed inset-0 bg-background/50 sm:hidden pointer-events-auto" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="pointer-events-auto fixed bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col"
            style={{
              top: panelStyle.top,
              left: panelStyle.left,
              width: panelStyle.width,
              maxHeight: 'min(24rem, calc(100vh - 5rem))',
            }}
          >
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              <div className="flex gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3 h-3" /> Read all
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 scrollbar-hide">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.is_read) markAsRead(n.id);
                    }}
                    className={`w-full text-left p-3 border-b border-border/50 hover:bg-secondary/50 transition-colors flex gap-3 ${
                      !n.is_read ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">{typeIcons[n.type] || typeIcons.info}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm truncate ${!n.is_read ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>

            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-primary font-medium py-2.5 border-t border-border hover:bg-secondary/50 transition-colors"
            >
              View all notifications →
            </Link>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative" ref={triggerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded relative"
        data-focusable="true"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}
