import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { Users, Wallet, Plus, Loader2, DollarSign, UserPlus, Ban, RefreshCw, Search } from 'lucide-react';

export function ResellerManagement() {
  const { t } = useLanguage();
  const [resellers, setResellers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [commission, setCommission] = useState(10);
  const [topUpAmount, setTopUpAmount] = useState<{ id: string; amount: number } | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [walletsRes, txRes, profilesRes] = await Promise.all([
      supabase.from('reseller_wallets').select('*').order('created_at', { ascending: false }),
      supabase.from('reseller_transactions').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('*'),
    ]);
    setResellers(walletsRes.data || []);
    setTransactions(txRes.data || []);
    setProfiles(profilesRes.data || []);
    setLoading(false);
  }

  async function createReseller() {
    if (!selectedUserId) return;
    // Add reseller role
    await supabase.from('user_roles').insert({ user_id: selectedUserId, role: 'reseller' } as any);
    // Create wallet
    await supabase.from('reseller_wallets').insert({
      user_id: selectedUserId,
      commission_rate: commission,
    } as any);
    setShowAdd(false);
    setSelectedUserId('');
    loadData();
  }

  async function toggleFreeze(walletId: string, frozen: boolean) {
    await supabase.from('reseller_wallets').update({ is_frozen: !frozen } as any).eq('id', walletId);
    loadData();
  }

  async function addCredits() {
    if (!topUpAmount) return;
    const wallet = resellers.find(r => r.id === topUpAmount.id);
    if (!wallet) return;
    
    await supabase.from('reseller_wallets').update({
      balance_cents: wallet.balance_cents + topUpAmount.amount * 100,
      total_earned_cents: wallet.total_earned_cents + topUpAmount.amount * 100,
    } as any).eq('id', topUpAmount.id);

    await supabase.from('reseller_transactions').insert({
      reseller_id: wallet.user_id,
      type: 'admin_topup',
      amount_cents: topUpAmount.amount * 100,
      description: `Admin top-up: $${topUpAmount.amount}`,
    } as any);
    
    setTopUpAmount(null);
    loadData();
  }

  const getProfileName = (userId: string) => {
    const p = profiles.find(p => p.user_id === userId);
    return p?.display_name || p?.email || userId.substring(0, 8);
  };

  const existingResellerIds = resellers.map(r => r.user_id);
  const availableUsers = profiles.filter(p => !existingResellerIds.includes(p.user_id));

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">{t('adminResellers')}</p>
          <p className="text-2xl font-bold text-primary">{resellers.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Balance</p>
          <p className="text-2xl font-bold text-success">${(resellers.reduce((s, r) => s + r.balance_cents, 0) / 100).toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Transactions</p>
          <p className="text-2xl font-bold text-accent">{transactions.length}</p>
        </div>
      </div>

      {/* Add Reseller */}
      <button onClick={() => setShowAdd(true)} className="px-4 py-2.5 rounded-lg gradient-primary text-primary-foreground font-semibold text-sm flex items-center gap-2 tv-focusable" data-focusable="true">
        <Plus className="w-4 h-4" /> Add Reseller
      </button>

      {showAdd && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-foreground font-semibold">Create Reseller</h3>
          <div>
            <label className="text-xs text-muted-foreground font-medium">User</label>
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
              <option value="">Select user...</option>
              {availableUsers.map(p => <option key={p.user_id} value={p.user_id}>{p.display_name || p.email}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Commission Rate (%)</label>
            <input type="number" min={0} max={100} value={commission} onChange={e => setCommission(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={createReseller} className="flex-1 py-2.5 rounded-lg gradient-primary text-primary-foreground font-semibold text-sm">Create</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm">{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* Top-up Modal */}
      {topUpAmount && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-foreground font-semibold">Add Credits to {getProfileName(resellers.find(r => r.id === topUpAmount.id)?.user_id || '')}</h3>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Amount ($)</label>
            <input type="number" min={1} value={topUpAmount.amount} onChange={e => setTopUpAmount({ ...topUpAmount, amount: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={addCredits} className="flex-1 py-2.5 rounded-lg gradient-primary text-primary-foreground font-semibold text-sm">Add Credits</button>
            <button onClick={() => setTopUpAmount(null)} className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm">{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* Resellers List */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-start p-3 text-muted-foreground font-medium">Reseller</th>
              <th className="text-start p-3 text-muted-foreground font-medium">Balance</th>
              <th className="text-start p-3 text-muted-foreground font-medium">Commission</th>
              <th className="text-start p-3 text-muted-foreground font-medium">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {resellers.map(r => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/50">
                <td className="p-3 text-foreground font-medium">{getProfileName(r.user_id)}</td>
                <td className="p-3 text-success font-medium">${(r.balance_cents / 100).toFixed(2)}</td>
                <td className="p-3 text-muted-foreground">{r.commission_rate}%</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.is_frozen ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'}`}>
                    {r.is_frozen ? 'Frozen' : 'Active'}
                  </span>
                </td>
                <td className="p-3 flex gap-1">
                  <button onClick={() => setTopUpAmount({ id: r.id, amount: 100 })} className="p-1.5 text-muted-foreground hover:text-success tv-focusable rounded" title="Add Credits"><DollarSign className="w-4 h-4" /></button>
                  <button onClick={() => toggleFreeze(r.id, r.is_frozen)} className="p-1.5 text-muted-foreground hover:text-warning tv-focusable rounded" title={r.is_frozen ? 'Unfreeze' : 'Freeze'}><Ban className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {resellers.length === 0 && <p className="p-6 text-center text-muted-foreground">No resellers yet</p>}
      </div>

      {/* Recent Transactions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-foreground font-semibold mb-4">{t('resellerTransactions')}</h3>
        <div className="space-y-2">
          {transactions.slice(0, 10).map(tx => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <p className="text-foreground text-sm font-medium">{tx.description || tx.type}</p>
                <p className="text-muted-foreground text-xs">{getProfileName(tx.reseller_id)} · {new Date(tx.created_at).toLocaleDateString()}</p>
              </div>
              <p className={`text-sm font-semibold ${tx.amount_cents >= 0 ? 'text-success' : 'text-destructive'}`}>
                {tx.amount_cents >= 0 ? '+' : ''}${(tx.amount_cents / 100).toFixed(2)}
              </p>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No transactions yet</p>}
        </div>
      </div>
    </div>
  );
}
