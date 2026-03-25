import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Key, Save, Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface ApiKeyConfig {
  key: string;
  label: string;
  description: string;
  group: string;
}

const API_KEYS: ApiKeyConfig[] = [
  { key: 'LEMONSQUEEZY_API_KEY', label: 'API Key', description: 'From LemonSqueezy Dashboard → Settings → API', group: 'Lemon Squeezy' },
  { key: 'LEMONSQUEEZY_WEBHOOK_SECRET', label: 'Webhook Secret', description: 'From LemonSqueezy Webhooks settings', group: 'Lemon Squeezy' },
  { key: 'LS_STORE_ID', label: 'Store ID', description: 'Your LemonSqueezy store identifier', group: 'Lemon Squeezy' },
  { key: 'LS_VARIANT_MONTHLY', label: 'Monthly Variant ID', description: 'Product variant for monthly plan', group: 'Lemon Squeezy' },
  { key: 'LS_VARIANT_YEARLY', label: 'Yearly Variant ID', description: 'Product variant for yearly plan', group: 'Lemon Squeezy' },
  { key: 'LS_VARIANT_LIFETIME', label: 'Lifetime Variant ID', description: 'Product variant for lifetime plan', group: 'Lemon Squeezy' },
  { key: 'PAYMOB_API_KEY', label: 'API Key', description: 'From Paymob Dashboard → Settings', group: 'Paymob (Egypt)' },
  { key: 'PAYMOB_HMAC_SECRET', label: 'HMAC Secret', description: 'For webhook signature verification', group: 'Paymob (Egypt)' },
  { key: 'PAYMOB_INTEGRATION_ID', label: 'Integration ID', description: 'Card payment integration ID', group: 'Paymob (Egypt)' },
  { key: 'PAYMOB_IFRAME_ID', label: 'iFrame ID', description: 'Payment iFrame identifier', group: 'Paymob (Egypt)' },
  { key: 'PAYMOB_PRICE_MONTHLY', label: 'Monthly Price (piasters)', description: 'e.g. 5000 = 50 EGP', group: 'Paymob (Egypt)' },
  { key: 'PAYMOB_PRICE_YEARLY', label: 'Yearly Price (piasters)', description: 'e.g. 50000 = 500 EGP', group: 'Paymob (Egypt)' },
  { key: 'PAYMOB_PRICE_LIFETIME', label: 'Lifetime Price (piasters)', description: 'e.g. 150000 = 1500 EGP', group: 'Paymob (Egypt)' },
];

export function ApiKeysSettings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    const { data } = await supabase.from('app_settings').select('key, value');
    if (data) {
      const v: Record<string, string> = {};
      data.forEach((row: any) => {
        if (API_KEYS.some(k => k.key === row.key)) {
          v[row.key] = row.value;
        }
      });
      setValues(v);
    }
    setLoading(false);
  }

  async function saveKeys() {
    setSaving(true);
    for (const config of API_KEYS) {
      const val = values[config.key];
      if (val === undefined) continue;

      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', config.key)
        .maybeSingle();

      if (existing) {
        await supabase.from('app_settings')
          .update({ value: val, updated_at: new Date().toISOString() })
          .eq('key', config.key);
      } else {
        await supabase.from('app_settings')
          .insert({ key: config.key, value: val });
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const groups = [...new Set(API_KEYS.map(k => k.group))];

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-warning font-semibold">Security Notice</p>
          <p className="text-warning/80 mt-1">
            API keys are stored in app settings. For production, consider using backend secrets management instead.
          </p>
        </div>
      </div>

      {groups.map(group => (
        <div key={group} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="text-foreground font-semibold flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> {group}
          </h3>
          <div className="space-y-3">
            {API_KEYS.filter(k => k.group === group).map(config => (
              <div key={config.key} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{config.label}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={visible[config.key] ? 'text' : 'password'}
                      value={values[config.key] || ''}
                      onChange={e => setValues(v => ({ ...v, [config.key]: e.target.value }))}
                      placeholder={config.description}
                      className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setVisible(v => ({ ...v, [config.key]: !v[config.key] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      {visible[config.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={saveKeys}
        disabled={saving}
        className="w-full py-3 rounded-lg gradient-primary text-primary-foreground font-semibold tv-focusable disabled:opacity-50 flex items-center justify-center gap-2"
        data-focusable="true"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saved ? 'Saved!' : 'Save All Keys'}
      </button>
    </div>
  );
}
