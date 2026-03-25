import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, TrendingDown, Users, Loader2, BarChart3 } from 'lucide-react';

interface PaymentStats {
  totalRevenue: number;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  conversionRate: number;
  revenueByProvider: { provider: string; total: number; count: number }[];
  revenueByPlan: { plan: string; total: number; count: number }[];
  recentPayments: any[];
}

export function PaymentAnalytics() {
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    const { data: profiles } = await supabase.from('profiles').select('user_id');

    const all = payments || [];
    const successful = all.filter(p => p.status === 'completed');
    const failed = all.filter(p => p.status === 'failed');

    const totalRevenue = successful.reduce((sum, p) => sum + (p.amount_cents / 100), 0);
    const totalUsers = (profiles || []).length;
    const payingUsers = new Set(successful.map(p => p.user_id)).size;
    const conversionRate = totalUsers > 0 ? (payingUsers / totalUsers) * 100 : 0;

    // Group by provider
    const byProvider: Record<string, { total: number; count: number }> = {};
    successful.forEach(p => {
      if (!byProvider[p.provider]) byProvider[p.provider] = { total: 0, count: 0 };
      byProvider[p.provider].total += p.amount_cents / 100;
      byProvider[p.provider].count++;
    });

    // Group by plan
    const byPlan: Record<string, { total: number; count: number }> = {};
    successful.forEach(p => {
      if (!byPlan[p.plan_type]) byPlan[p.plan_type] = { total: 0, count: 0 };
      byPlan[p.plan_type].total += p.amount_cents / 100;
      byPlan[p.plan_type].count++;
    });

    setStats({
      totalRevenue,
      totalPayments: all.length,
      successfulPayments: successful.length,
      failedPayments: failed.length,
      conversionRate,
      revenueByProvider: Object.entries(byProvider).map(([provider, d]) => ({ provider, ...d })),
      revenueByPlan: Object.entries(byPlan).map(([plan, d]) => ({ plan, ...d })),
      recentPayments: all.slice(0, 10),
    });
    setLoading(false);
  }

  if (loading || !stats) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Revenue', value: `$${stats.totalRevenue.toFixed(0)}`, icon: <DollarSign className="w-4 h-4" />, color: 'text-success' },
          { label: 'Successful', value: stats.successfulPayments, icon: <TrendingUp className="w-4 h-4" />, color: 'text-success' },
          { label: 'Failed', value: stats.failedPayments, icon: <TrendingDown className="w-4 h-4" />, color: 'text-destructive' },
          { label: 'Conversion', value: `${stats.conversionRate.toFixed(1)}%`, icon: <Users className="w-4 h-4" />, color: 'text-accent' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={s.color}>{s.icon}</span>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue by Provider */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> Revenue by Provider
        </h3>
        {stats.revenueByProvider.length > 0 ? (
          <div className="space-y-3">
            {stats.revenueByProvider.map(p => (
              <div key={p.provider} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-foreground font-medium capitalize">{p.provider}</p>
                  <p className="text-xs text-muted-foreground">{p.count} payments</p>
                </div>
                <p className="text-success font-bold">${p.total.toFixed(2)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No payment data yet</p>
        )}
      </div>

      {/* Revenue by Plan */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-foreground font-semibold mb-4">Revenue by Plan</h3>
        {stats.revenueByPlan.length > 0 ? (
          <div className="space-y-3">
            {stats.revenueByPlan.map(p => (
              <div key={p.plan} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-foreground text-sm font-medium capitalize">{p.plan}</span>
                    <span className="text-muted-foreground text-xs">${p.total.toFixed(2)} ({p.count})</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full gradient-primary rounded-full"
                      style={{ width: `${stats.totalRevenue > 0 ? (p.total / stats.totalRevenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No data yet</p>
        )}
      </div>

      {/* Recent Payments */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <h3 className="text-foreground font-semibold p-4 border-b border-border">Recent Payments</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-muted-foreground font-medium">Date</th>
              <th className="text-left p-3 text-muted-foreground font-medium">Provider</th>
              <th className="text-left p-3 text-muted-foreground font-medium">Plan</th>
              <th className="text-left p-3 text-muted-foreground font-medium">Amount</th>
              <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentPayments.map(p => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="p-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="p-3 text-foreground capitalize">{p.provider}</td>
                <td className="p-3 text-foreground capitalize">{p.plan_type}</td>
                <td className="p-3 text-foreground">{(p.amount_cents / 100).toFixed(2)} {p.currency}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.status === 'completed' ? 'bg-success/20 text-success' : p.status === 'failed' ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'
                  }`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stats.recentPayments.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">No payments yet</p>
        )}
      </div>
    </div>
  );
}
