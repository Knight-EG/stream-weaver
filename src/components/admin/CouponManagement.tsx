import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Loader2, Trash2, Copy, Check, Ban } from 'lucide-react';

export function CouponManagement() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Create form
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'trial_extension'>('percentage');
  const [discountValue, setDiscountValue] = useState(10);
  const [trialDays, setTrialDays] = useState(7);
  const [maxUses, setMaxUses] = useState<number | ''>('');
  const [planType, setPlanType] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => { loadCoupons(); }, []);

  async function loadCoupons() {
    setLoading(true);
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(data || []);
    setLoading(false);
  }

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
    setCode(result);
  }

  async function createCoupon() {
    if (!code) return;
    await supabase.from('coupons').insert({
      code: code.toUpperCase(),
      discount_type: discountType,
      discount_value: discountType === 'trial_extension' ? 0 : discountValue,
      trial_extension_days: discountType === 'trial_extension' ? trialDays : 0,
      max_uses: maxUses || null,
      plan_type: planType || null,
      expires_at: expiresAt || null,
      created_by: user?.id,
    } as any);
    setShowCreate(false);
    setCode('');
    loadCoupons();
  }

  async function toggleCoupon(id: string, active: boolean) {
    await supabase.from('coupons').update({ is_active: !active } as any).eq('id', id);
    loadCoupons();
  }

  async function deleteCoupon(id: string) {
    await supabase.from('coupons').delete().eq('id', id);
    loadCoupons();
  }

  function copyCode(c: string) {
    navigator.clipboard.writeText(c);
    setCopied(c);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Coupons</p>
          <p className="text-2xl font-bold text-primary">{coupons.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">{t('couponActive')}</p>
          <p className="text-2xl font-bold text-success">{coupons.filter(c => c.is_active).length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Uses</p>
          <p className="text-2xl font-bold text-accent">{coupons.reduce((s, c) => s + c.current_uses, 0)}</p>
        </div>
      </div>

      {/* Create Button */}
      <button onClick={() => { setShowCreate(true); generateCode(); }} className="px-4 py-2.5 rounded-lg gradient-primary text-primary-foreground font-semibold text-sm flex items-center gap-2 tv-focusable" data-focusable="true">
        <Plus className="w-4 h-4" /> {t('couponCreate')}
      </button>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-foreground font-semibold">{t('couponCreate')}</h3>
          <div>
            <label className="text-xs text-muted-foreground font-medium">{t('couponCode')}</label>
            <div className="flex gap-2 mt-1">
              <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm font-mono" placeholder="CODE123" />
              <button onClick={generateCode} className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs">Generate</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Type</label>
            <div className="flex gap-2 mt-1">
              {(['percentage', 'fixed', 'trial_extension'] as const).map(dt => (
                <button key={dt} onClick={() => setDiscountType(dt)} className={`flex-1 py-2 rounded-lg text-xs font-medium ${discountType === dt ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {dt === 'percentage' ? t('couponPercentage') : dt === 'fixed' ? t('couponFixed') : t('couponTrialExtension')}
                </button>
              ))}
            </div>
          </div>
          {discountType !== 'trial_extension' ? (
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t('couponDiscount')} {discountType === 'percentage' ? '(%)' : '($)'}</label>
              <input type="number" min={0} value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
          ) : (
            <div>
              <label className="text-xs text-muted-foreground font-medium">Extra Trial Days</label>
              <input type="number" min={1} value={trialDays} onChange={e => setTrialDays(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t('couponMaxUses')} (optional)</label>
              <input type="number" min={1} value={maxUses} onChange={e => setMaxUses(e.target.value ? Number(e.target.value) : '')} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" placeholder="Unlimited" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">{t('couponExpiry')} (optional)</label>
              <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Plan (optional)</label>
            <select value={planType} onChange={e => setPlanType(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
              <option value="">All plans</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={createCoupon} className="flex-1 py-2.5 rounded-lg gradient-primary text-primary-foreground font-semibold text-sm">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm">{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* Coupons List */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-start p-3 text-muted-foreground font-medium">Code</th>
              <th className="text-start p-3 text-muted-foreground font-medium">Type</th>
              <th className="text-start p-3 text-muted-foreground font-medium">Value</th>
              <th className="text-start p-3 text-muted-foreground font-medium">Uses</th>
              <th className="text-start p-3 text-muted-foreground font-medium">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {coupons.map(c => {
              const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
              const isMaxed = c.max_uses && c.current_uses >= c.max_uses;
              return (
                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/50">
                  <td className="p-3 font-mono text-foreground font-medium">
                    <button onClick={() => copyCode(c.code)} className="flex items-center gap-1.5 hover:text-primary">
                      {c.code} {copied === c.code ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </td>
                  <td className="p-3 text-muted-foreground capitalize">{c.discount_type.replace('_', ' ')}</td>
                  <td className="p-3 text-foreground">
                    {c.discount_type === 'percentage' ? `${c.discount_value}%` : c.discount_type === 'fixed' ? `$${c.discount_value}` : `+${c.trial_extension_days} days`}
                  </td>
                  <td className="p-3 text-muted-foreground">{c.current_uses}{c.max_uses ? `/${c.max_uses}` : ''}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      !c.is_active || isExpired || isMaxed ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'
                    }`}>
                      {!c.is_active ? 'Disabled' : isExpired ? 'Expired' : isMaxed ? 'Maxed' : 'Active'}
                    </span>
                  </td>
                  <td className="p-3 flex gap-1">
                    <button onClick={() => toggleCoupon(c.id, c.is_active)} className="p-1.5 text-muted-foreground hover:text-warning tv-focusable rounded" title={c.is_active ? 'Disable' : 'Enable'}>
                      <Ban className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteCoupon(c.id)} className="p-1.5 text-muted-foreground hover:text-destructive tv-focusable rounded" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {coupons.length === 0 && <p className="p-6 text-center text-muted-foreground">No coupons yet</p>}
      </div>
    </div>
  );
}
