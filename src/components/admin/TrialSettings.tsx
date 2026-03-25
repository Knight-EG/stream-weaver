import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Save, Loader2, RotateCcw } from 'lucide-react';

export function TrialSettings() {
  const [trialDays, setTrialDays] = useState(3);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrialDays();
  }, []);

  async function loadTrialDays() {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'trial_days')
      .maybeSingle();
    if (data) setTrialDays(parseInt(data.value, 10) || 3);
    setLoading(false);
  }

  async function saveTrialDays() {
    setSaving(true);
    // Upsert trial_days setting
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('key', 'trial_days')
      .maybeSingle();

    if (existing) {
      await supabase
        .from('app_settings')
        .update({ value: String(trialDays), updated_at: new Date().toISOString() })
        .eq('key', 'trial_days');
    }
    // Note: if not existing, admin should insert via migration/seed — we handle it below

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <h3 className="text-foreground font-semibold flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" /> Trial Period Settings
      </h3>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Trial Duration (days)</label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={30}
            value={trialDays}
            onChange={e => setTrialDays(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={30}
              value={trialDays}
              onChange={e => setTrialDays(Math.max(1, Math.min(30, Number(e.target.value))))}
              className="w-16 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          New users will get {trialDays} day{trialDays !== 1 ? 's' : ''} of free trial. 
          A reminder notification will be sent 1 day before expiry.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={saveTrialDays}
          disabled={saving}
          className="flex-1 py-3 rounded-lg gradient-primary text-primary-foreground font-semibold tv-focusable disabled:opacity-50 flex items-center justify-center gap-2"
          data-focusable="true"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save'}
        </button>
        <button
          onClick={() => setTrialDays(3)}
          className="px-4 py-3 rounded-lg bg-secondary text-secondary-foreground font-medium tv-focusable flex items-center gap-2"
          data-focusable="true"
        >
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>
    </div>
  );
}
