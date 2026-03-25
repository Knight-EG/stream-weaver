import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Palette, Save, Loader2, RotateCcw } from 'lucide-react';

interface AppSettings {
  app_name: string;
  app_logo_url: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
}

const defaults: AppSettings = {
  app_name: 'IPTV Player',
  app_logo_url: '',
  primary_color: '199 89% 48%',
  accent_color: '265 70% 58%',
  background_color: '220 20% 7%',
};

export function WhiteLabelSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaults);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data } = await supabase.from('app_settings').select('key, value');
    if (data) {
      const s = { ...defaults };
      data.forEach((row: any) => {
        if (row.key in s) (s as any)[row.key] = row.value;
      });
      setSettings(s);
    }
  }

  async function saveSettings() {
    setSaving(true);
    const entries = Object.entries(settings);
    for (const [key, value] of entries) {
      await supabase.from('app_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
    }

    // Apply theme live
    const root = document.documentElement;
    root.style.setProperty('--primary', settings.primary_color);
    root.style.setProperty('--accent', settings.accent_color);
    root.style.setProperty('--background', settings.background_color);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function resetDefaults() {
    setSettings(defaults);
  }

  const colorFields: { key: keyof AppSettings; label: string }[] = [
    { key: 'primary_color', label: 'Primary Color (HSL)' },
    { key: 'accent_color', label: 'Accent Color (HSL)' },
    { key: 'background_color', label: 'Background Color (HSL)' },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <h3 className="text-foreground font-semibold flex items-center gap-2">
        <Palette className="w-5 h-5 text-primary" /> White Label Settings
      </h3>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">App Name</label>
          <input
            type="text"
            value={settings.app_name}
            onChange={e => setSettings(s => ({ ...s, app_name: e.target.value }))}
            className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Logo URL</label>
          <input
            type="url"
            placeholder="https://example.com/logo.png"
            value={settings.app_logo_url}
            onChange={e => setSettings(s => ({ ...s, app_logo_url: e.target.value }))}
            className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {settings.app_logo_url && (
            <img src={settings.app_logo_url} alt="Logo preview" className="h-12 object-contain rounded" />
          )}
        </div>

        {colorFields.map(f => (
          <div key={f.key} className="space-y-2">
            <label className="text-sm font-medium text-foreground">{f.label}</label>
            <div className="flex gap-3 items-center">
              <input
                type="text"
                value={settings[f.key]}
                onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))}
                className="flex-1 px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
              />
              <div
                className="w-12 h-12 rounded-lg border border-border flex-shrink-0"
                style={{ backgroundColor: `hsl(${settings[f.key]})` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex-1 py-3 rounded-lg gradient-primary text-primary-foreground font-semibold tv-focusable disabled:opacity-50 flex items-center justify-center gap-2"
          data-focusable="true"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
        <button
          onClick={resetDefaults}
          className="px-4 py-3 rounded-lg bg-secondary text-secondary-foreground font-medium tv-focusable flex items-center gap-2"
          data-focusable="true"
        >
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>
    </div>
  );
}
