import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Link, useSearchParams } from 'react-router-dom';
import { Tv, Loader2, CheckCircle2, AlertCircle, Radio, Server, Upload, FileText } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import type { PlaylistSource } from '@/hooks/usePlaylist';

type Step = 'code' | 'login' | 'playlist' | 'done';

export default function Activate() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [mac, setMac] = useState('');
  const [activationId, setActivationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Playlist form
  const [playlistMode, setPlaylistMode] = useState<'m3u' | 'xtream' | 'file'>('m3u');
  const [m3uUrl, setM3uUrl] = useState('');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');

  // If user is logged in and code is in URL, auto-verify
  useEffect(() => {
    if (code && user && step === 'code') {
      handleVerifyCode();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerifyCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError('Please enter a valid activation code');
      return;
    }
    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('tv_activations')
      .select('*')
      .eq('activation_code', trimmed)
      .eq('status', 'pending')
      .maybeSingle();

    setLoading(false);

    if (err || !data) {
      setError('Invalid or expired activation code. Please check your TV screen.');
      return;
    }

    setMac(data.mac_address);
    setActivationId(data.id);

    if (!user) {
      setStep('login');
    } else {
      setStep('playlist');
    }
  };

  // After login, go to playlist step
  useEffect(() => {
    if (step === 'login' && user && activationId) {
      setStep('playlist');
    }
  }, [user, step, activationId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setFileContent(reader.result as string);
    };
    reader.readAsText(file);
  };

  const handleSubmitPlaylist = async () => {
    let source: PlaylistSource | null = null;

    if (playlistMode === 'm3u' && m3uUrl.trim()) {
      source = { type: 'm3u', url: m3uUrl.trim() };
    } else if (playlistMode === 'xtream' && server && username && password) {
      source = { type: 'xtream', credentials: { server: server.trim(), username: username.trim(), password: password.trim() } };
    } else if (playlistMode === 'file' && fileContent) {
      source = { type: 'file', content: fileContent };
    }

    if (!source) {
      setError('Please fill in the playlist details');
      return;
    }

    setLoading(true);
    setError('');

    const { error: err } = await supabase
      .from('tv_activations')
      .update({
        user_id: user!.id,
        playlist_source: source as unknown as Record<string, string>,
        status: 'active',
        activated_at: new Date().toISOString(),
      })
      .eq('id', activationId);

    setLoading(false);

    if (err) {
      setError('Failed to activate. Please try again.');
      return;
    }

    toast.success('TV activated successfully!');
    setStep('done');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto">
            <Tv className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Activate Your TV</h1>
          <p className="text-muted-foreground">
            {step === 'code' && 'Enter the code shown on your TV screen'}
            {step === 'login' && 'Sign in to link your account'}
            {step === 'playlist' && 'Add your playlist to start watching on TV'}
            {step === 'done' && 'Your TV is ready!'}
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2">
          {['code', 'login', 'playlist', 'done'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step === s ? 'bg-primary text-primary-foreground' :
                ['code', 'login', 'playlist', 'done'].indexOf(step) > i ? 'bg-primary/20 text-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                {['code', 'login', 'playlist', 'done'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < 3 && <div className={`w-8 h-0.5 ${['code', 'login', 'playlist', 'done'].indexOf(step) > i ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        {/* MAC display */}
        {mac && step !== 'code' && (
          <div className="bg-muted/50 border border-border rounded-lg px-4 py-2 text-center">
            <span className="text-sm text-muted-foreground">TV MAC: </span>
            <span className="font-mono text-foreground">{mac}</span>
          </div>
        )}

        {/* Step: Enter Code */}
        {step === 'code' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Activation Code</label>
              <input
                type="text"
                placeholder="Enter 6-character code"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full px-4 py-4 rounded-lg bg-muted border border-border text-foreground text-center text-2xl font-mono tracking-[0.5em] placeholder:text-muted-foreground placeholder:tracking-normal placeholder:text-base focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={e => { if (e.key === 'Enter') handleVerifyCode(); }}
              />
            </div>
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <button
              onClick={handleVerifyCode}
              disabled={loading || code.length < 4}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Verify Code
            </button>
          </div>
        )}

        {/* Step: Login */}
        {step === 'login' && !user && (
          <div className="space-y-4 text-center">
            <p className="text-muted-foreground">You need to sign in to activate your TV.</p>
            <div className="flex flex-col gap-3">
              <Link to={`/login?redirect=/activate?code=${code}`} className="py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-center">
                Sign In
              </Link>
              <Link to={`/signup?redirect=/activate?code=${code}`} className="py-3 rounded-lg bg-secondary text-secondary-foreground font-semibold text-center">
                Create Account
              </Link>
            </div>
          </div>
        )}

        {/* Step: Add Playlist */}
        {step === 'playlist' && (
          <div className="space-y-4">
            {/* Mode selector */}
            <div className="flex rounded-lg bg-muted p-1 gap-1">
              <button
                onClick={() => setPlaylistMode('m3u')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  playlistMode === 'm3u' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Radio className="w-4 h-4" /> M3U
              </button>
              <button
                onClick={() => setPlaylistMode('xtream')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  playlistMode === 'xtream' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Server className="w-4 h-4" /> Xtream
              </button>
              <button
                onClick={() => setPlaylistMode('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  playlistMode === 'file' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Upload className="w-4 h-4" /> File
              </button>
            </div>

            {/* M3U URL */}
            {playlistMode === 'm3u' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Playlist URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/playlist.m3u"
                  value={m3uUrl}
                  onChange={e => setM3uUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {/* Xtream */}
            {playlistMode === 'xtream' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Server URL</label>
                  <input type="url" placeholder="http://provider.example.com" value={server} onChange={e => setServer(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Username</label>
                  <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
            )}

            {/* File Upload */}
            {playlistMode === 'file' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Upload M3U File</label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer relative">
                  <input type="file" accept=".m3u,.m3u8,.txt" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  {fileName ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-primary" />
                      <p className="text-sm font-medium text-foreground">{fileName}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm text-foreground">Click to upload M3U file</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && <p className="text-destructive text-sm text-center">{error}</p>}

            <button
              onClick={handleSubmitPlaylist}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Activate TV
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="text-center space-y-6">
            <CheckCircle2 className="w-20 h-20 text-primary mx-auto" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">TV Activated!</h2>
              <p className="text-muted-foreground">
                Your TV will load the playlist automatically within a few seconds.
              </p>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm text-muted-foreground">
              <p>MAC: <span className="font-mono text-foreground">{mac}</span></p>
            </div>
            <Link to="/" className="inline-block py-3 px-8 rounded-lg bg-primary text-primary-foreground font-semibold">
              Go to Dashboard
            </Link>
          </div>
        )}

        {/* Back to home */}
        <div className="text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
