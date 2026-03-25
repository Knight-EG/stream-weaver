import { useState } from 'react';
import { Radio, Server, Loader2 } from 'lucide-react';
import type { PlaylistSource } from '@/hooks/usePlaylist';

interface PlaylistSetupProps {
  onSubmit: (source: PlaylistSource) => void;
  loading: boolean;
  error: string | null;
}

export function PlaylistSetup({ onSubmit, loading, error }: PlaylistSetupProps) {
  const [mode, setMode] = useState<'m3u' | 'xtream'>('m3u');
  const [m3uUrl, setM3uUrl] = useState('');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (mode === 'm3u' && m3uUrl.trim()) {
      onSubmit({ type: 'm3u', url: m3uUrl.trim() });
    } else if (mode === 'xtream' && server && username && password) {
      onSubmit({ type: 'xtream', credentials: { server: server.trim(), username: username.trim(), password: password.trim() } });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto">
            <Radio className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-gradient">IPTV Player</h1>
          <p className="text-muted-foreground">Enter your playlist source to get started</p>
        </div>

        <div className="flex rounded-lg bg-muted p-1 gap-1">
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium tv-focusable transition-colors ${
              mode === 'm3u' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setMode('m3u')}
            data-focusable="true"
          >
            <Radio className="w-4 h-4" /> M3U Playlist
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium tv-focusable transition-colors ${
              mode === 'xtream' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setMode('xtream')}
            data-focusable="true"
          >
            <Server className="w-4 h-4" /> Xtream Codes
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'm3u' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Playlist URL</label>
              <input
                type="url"
                placeholder="https://example.com/playlist.m3u"
                value={m3uUrl}
                onChange={(e) => setM3uUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable"
                data-focusable="true"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Server URL</label>
                <input
                  type="url"
                  placeholder="http://provider.example.com"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable"
                  data-focusable="true"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Username</label>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable"
                  data-focusable="true"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable"
                  data-focusable="true"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                />
              </div>
            </>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 rounded-lg gradient-primary text-primary-foreground font-semibold tv-focusable disabled:opacity-50 flex items-center justify-center gap-2"
            data-focusable="true"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</> : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
