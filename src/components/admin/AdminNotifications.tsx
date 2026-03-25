import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Send, Loader2, Users, User, CheckCircle } from 'lucide-react';

interface Props {
  profiles: any[];
}

const notificationTypes = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'device', label: 'Device' },
  { value: 'error', label: 'Error' },
];

export function AdminNotifications({ profiles }: Props) {
  const [target, setTarget] = useState<'all' | 'user'>('all');
  const [selectedUser, setSelectedUser] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendNotification() {
    if (!title || !message) return;
    setSending(true);

    const targets = target === 'all'
      ? profiles.map((p: any) => p.user_id)
      : [selectedUser];

    for (const userId of targets) {
      if (!userId) continue;
      await supabase.from('notifications').insert({
        user_id: userId,
        title,
        message,
        type,
        metadata: { sent_by: 'admin', broadcast: target === 'all' },
      } as any);
    }

    setSending(false);
    setSent(true);
    setTitle('');
    setMessage('');
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <h3 className="text-foreground font-semibold flex items-center gap-2">
        <Send className="w-5 h-5 text-primary" /> Send Notification
      </h3>

      {/* Target */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Target</label>
        <div className="flex gap-2">
          <button
            onClick={() => setTarget('all')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${
              target === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> All Users
          </button>
          <button
            onClick={() => setTarget('user')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${
              target === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Specific User
          </button>
        </div>
      </div>

      {target === 'user' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Select User</label>
          <select
            value={selectedUser}
            onChange={e => setSelectedUser(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Choose user...</option>
            {profiles.map((p: any) => (
              <option key={p.user_id} value={p.user_id}>{p.display_name || p.email}</option>
            ))}
          </select>
        </div>
      )}

      {/* Type */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <div className="flex gap-1.5 flex-wrap">
          {notificationTypes.map(t => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                type === t.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title & Message */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Notification title..."
          className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Message</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Notification message..."
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      <button
        onClick={sendNotification}
        disabled={sending || !title || !message || (target === 'user' && !selectedUser)}
        className="w-full py-3 rounded-lg gradient-primary text-primary-foreground font-semibold tv-focusable disabled:opacity-50 flex items-center justify-center gap-2"
        data-focusable="true"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <CheckCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
        {sent ? `Sent to ${target === 'all' ? profiles.length : 1} user(s)!` : 'Send Notification'}
      </button>
    </div>
  );
}
