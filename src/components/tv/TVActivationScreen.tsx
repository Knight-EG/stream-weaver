import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getTvMac, generateActivationCode } from '@/lib/tv-mac';
import { Tv, Loader2, Keyboard, QrCode } from 'lucide-react';
import type { PlaylistSource } from '@/hooks/usePlaylist';

interface TVActivationScreenProps {
  onActivated: (source: PlaylistSource) => void;
  onManualEntry: () => void;
}

export function TVActivationScreen({ onActivated, onManualEntry }: TVActivationScreenProps) {
  const [mac] = useState(() => getTvMac());
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'loading' | 'waiting' | 'activated'>('loading');
  const activationUrl = `${window.location.origin}/activate`;

  // Register or resume activation
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Check if MAC already activated
      const { data: existing } = await supabase
        .from('tv_activations')
        .select('*')
        .eq('mac_address', mac)
        .maybeSingle();

      if (cancelled) return;

      if (existing && existing.status === 'active' && existing.playlist_source) {
        setCode(existing.activation_code);
        setStatus('activated');
        onActivated(existing.playlist_source as unknown as PlaylistSource);
        return;
      }

      if (existing) {
        setCode(existing.activation_code);
        setStatus('waiting');
        return;
      }

      // Create new activation
      const newCode = generateActivationCode();
      const { error } = await supabase
        .from('tv_activations')
        .insert({ mac_address: mac, activation_code: newCode, status: 'pending' });

      if (!error && !cancelled) {
        setCode(newCode);
        setStatus('waiting');
      }
    })();
    return () => { cancelled = true; };
  }, [mac]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for activation every 5 seconds
  useEffect(() => {
    if (status !== 'waiting') return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('tv_activations')
        .select('*')
        .eq('mac_address', mac)
        .eq('status', 'active')
        .maybeSingle();

      if (data?.playlist_source) {
        setStatus('activated');
        onActivated(data.playlist_source as unknown as PlaylistSource);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [status, mac, onActivated]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-3xl w-full text-center space-y-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
            <Tv className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-5xl font-bold text-primary">IPTV Player</h1>
        </div>

        <p className="text-2xl text-muted-foreground">Activate your TV to start watching</p>

        {/* Activation Code */}
        <div className="bg-card border-2 border-border rounded-3xl p-10 space-y-8">
          <div>
            <p className="text-lg text-muted-foreground mb-3">Your Activation Code</p>
            <div className="flex items-center justify-center gap-3">
              {code.split('').map((ch, i) => (
                <span key={i} className="w-16 h-20 rounded-xl bg-muted border-2 border-primary/30 flex items-center justify-center text-4xl font-bold text-primary">
                  {ch}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-8 space-y-4">
            <p className="text-lg text-muted-foreground">
              Go to this link on your phone or computer:
            </p>
            <p className="text-3xl font-bold text-primary break-all">{activationUrl}</p>
            <p className="text-lg text-muted-foreground">
              Enter the code above to link your playlist
            </p>
          </div>

          <div className="border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">MAC Address</p>
            <p className="text-xl font-mono text-foreground mt-1">{mac}</p>
          </div>
        </div>

        {/* Manual Entry Option */}
        <button
          onClick={onManualEntry}
          className="flex items-center justify-center gap-3 mx-auto px-8 py-4 rounded-2xl bg-muted border border-border text-lg font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 tv-focusable transition-all"
          data-focusable="true"
        >
          <Keyboard className="w-6 h-6" />
          Enter playlist manually with remote
        </button>

        <p className="text-sm text-muted-foreground animate-pulse">
          Waiting for activation... This screen will update automatically.
        </p>
      </div>
    </div>
  );
}
