import { useState } from 'react';
import { Radio, Server, Loader2, Upload, FileText, Download } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import type { PlaylistSource } from '@/hooks/usePlaylist';
import { downloadXtreamM3UFile } from '@/lib/xtream-m3u';
interface PlaylistSetupProps {
  onSubmit: (source: PlaylistSource) => void;
  loading: boolean;
  error: string | null;
}

export function PlaylistSetup({ onSubmit, loading, error }: PlaylistSetupProps) {
  const [mode, setMode] = useState<'m3u' | 'xtream' | 'file'>('m3u');
  const [m3uUrl, setM3uUrl] = useState('');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fileName, setFileName] = useState('');
  const [downloadingM3u, setDownloadingM3u] = useState(false);

  const handleSubmit = () => {
    if (mode === 'm3u' && m3uUrl.trim()) {
      onSubmit({ type: 'm3u', url: m3uUrl.trim() });
    } else if (mode === 'xtream' && server && username && password) {
      onSubmit({ type: 'xtream', credentials: { server: server.trim(), username: username.trim(), password: password.trim() } });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      onSubmit({ type: 'file', content });
    };
    reader.readAsText(file);
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

        <div className="flex rounded-lg bg-muted p-1 gap-1 flex-wrap">
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
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium tv-focusable transition-colors ${
              mode === 'file' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setMode('file')}
            data-focusable="true"
          >
            <Upload className="w-4 h-4" /> Upload File
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'file' ? (
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Upload M3U File</label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".m3u,.m3u8,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  data-focusable="true"
                />
                {fileName ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-primary" />
                    <p className="text-sm font-medium text-foreground">{fileName}</p>
                    <p className="text-xs text-muted-foreground">Processing...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-foreground">Click to upload M3U file</p>
                    <p className="text-xs text-muted-foreground">.m3u, .m3u8, .txt</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                💡 If your provider URL downloads a file instead of playing, use this option to upload it directly.
              </p>
            </div>
          ) : mode === 'm3u' ? (
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
              {server && username && password && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-foreground font-medium">
                    💡 لو الاتصال المباشر فشل، حمّل ملف M3U وارفعه في تبويب "Upload File"
                  </p>
                  <a
                    href={`${(() => { let s = server.trim().replace(/\/$/, ''); if (!/^https?:\/\//i.test(s)) s = 'http://' + s; return s; })()}/get.php?username=${username.trim()}&password=${password.trim()}&type=m3u_plus&output=ts`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-lg bg-accent text-accent-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <Download className="w-5 h-5" /> تحميل ملف M3U
                  </a>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
              <p className="text-destructive text-sm whitespace-pre-line">{error}</p>
              {mode !== 'file' && error.toLowerCase().includes('blocked') && (
                <button onClick={() => setMode('file')} className="text-xs text-primary underline hover:no-underline">
                  Try uploading the M3U file instead →
                </button>
              )}
            </div>
          )}

          {mode !== 'file' && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 rounded-lg gradient-primary text-primary-foreground font-semibold tv-focusable disabled:opacity-50 flex items-center justify-center gap-2"
              data-focusable="true"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</> : 'Connect'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
