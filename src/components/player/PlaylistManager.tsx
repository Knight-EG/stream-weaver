import { useState, useEffect } from 'react';
import { Radio, Server, Upload, Trash2, Play, Plus, Edit2, Check, X, FileText, List } from 'lucide-react';
import type { PlaylistSource } from '@/hooks/usePlaylist';

export interface SavedPlaylist {
  id: string;
  name: string;
  source: PlaylistSource;
  channelCount?: number;
  addedAt: number;
}

const PLAYLISTS_KEY = 'iptv_saved_playlists';
const ACTIVE_PLAYLIST_KEY = 'iptv_active_playlist';

export function getSavedPlaylists(): SavedPlaylist[] {
  try {
    const stored = localStorage.getItem(PLAYLISTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export function savePlaylistList(playlists: SavedPlaylist[]) {
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
}

export function getActivePlaylistId(): string | null {
  return localStorage.getItem(ACTIVE_PLAYLIST_KEY);
}

export function setActivePlaylistId(id: string) {
  localStorage.setItem(ACTIVE_PLAYLIST_KEY, id);
}

interface PlaylistManagerProps {
  onLoadPlaylist: (source: PlaylistSource) => void;
  onPlaylistActivated?: (playlist: SavedPlaylist) => void;
  loading: boolean;
  error: string | null;
  currentChannelCount?: number;
}

export function PlaylistManager({ onLoadPlaylist, onPlaylistActivated, loading, error, currentChannelCount }: PlaylistManagerProps) {
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>(getSavedPlaylists);
  const [showAddForm, setShowAddForm] = useState(playlists.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Add form state
  const [mode, setMode] = useState<'m3u' | 'xtream' | 'file'>('m3u');
  const [playlistName, setPlaylistName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fileName, setFileName] = useState('');

  const activeId = getActivePlaylistId();

  // Migrate old single-source to multi-playlist & auto-load active
  useEffect(() => {
    let list = playlists;

    // Migration from old format
    if (list.length === 0) {
      try {
        const oldSource = localStorage.getItem('iptv_saved_source');
        if (oldSource) {
          const source: PlaylistSource = JSON.parse(oldSource);
          const migrated: SavedPlaylist = {
            id: crypto.randomUUID(),
            name: source.type === 'xtream' ? `Xtream - ${source.credentials.server}` : 'My Playlist',
            source,
            addedAt: Date.now(),
          };
          list = [migrated];
          setPlaylists(list);
          savePlaylistList(list);
          setActivePlaylistId(migrated.id);
          localStorage.removeItem('iptv_saved_source');
          setShowAddForm(false);
        }
      } catch {}
    }

    // Auto-load active playlist if we have playlists but no channels loaded
    if (list.length > 0 && (currentChannelCount === 0 || currentChannelCount === undefined) && !loading) {
      const aid = getActivePlaylistId();
      const active = list.find(p => p.id === aid) || list[0];
      if (active && active.source.type !== 'file') {
        setActivePlaylistId(active.id);
        onLoadPlaylist(active.source);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = (source?: PlaylistSource) => {
    const finalSource = source || (
      mode === 'm3u' && m3uUrl.trim()
        ? { type: 'm3u' as const, url: m3uUrl.trim() }
        : mode === 'xtream' && server && username && password
          ? { type: 'xtream' as const, credentials: { server: server.trim(), username: username.trim(), password: password.trim() } }
          : null
    );

    if (!finalSource) return;

    const name = playlistName.trim() || (
      finalSource.type === 'xtream' ? `Xtream - ${finalSource.credentials.server.replace(/https?:\/\//, '')}` :
      finalSource.type === 'm3u' ? `M3U - ${new URL(finalSource.url).hostname}` :
      `File - ${fileName || 'Upload'}`
    );

    const newPlaylist: SavedPlaylist = {
      id: crypto.randomUUID(),
      name,
      source: finalSource,
      addedAt: Date.now(),
    };

    const updated = [...playlists, newPlaylist];
    setPlaylists(updated);
    savePlaylistList(updated);
    setActivePlaylistId(newPlaylist.id);
    onLoadPlaylist(finalSource);
    onPlaylistActivated?.(newPlaylist);

    // Reset form
    setShowAddForm(false);
    setPlaylistName('');
    setM3uUrl('');
    setServer('');
    setUsername('');
    setPassword('');
    setFileName('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const source: PlaylistSource = { type: 'file', content };
      handleAdd(source);
    };
    reader.readAsText(file);
  };

  const handleSwitch = (playlist: SavedPlaylist) => {
    setActivePlaylistId(playlist.id);
    onLoadPlaylist(playlist.source);
    onPlaylistActivated?.(playlist);
  };

  const handleDelete = (id: string) => {
    const updated = playlists.filter(p => p.id !== id);
    setPlaylists(updated);
    savePlaylistList(updated);
    if (activeId === id && updated.length > 0) {
      handleSwitch(updated[0]);
    }
    if (updated.length === 0) setShowAddForm(true);
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    const updated = playlists.map(p => p.id === id ? { ...p, name: editName.trim() } : p);
    setPlaylists(updated);
    savePlaylistList(updated);
    setEditingId(null);
  };

  const getSourceIcon = (source: PlaylistSource) => {
    if (source.type === 'xtream') return <Server className="w-5 h-5" />;
    if (source.type === 'file') return <FileText className="w-5 h-5" />;
    return <Radio className="w-5 h-5" />;
  };

  const getSourceLabel = (source: PlaylistSource) => {
    if (source.type === 'xtream') return 'Xtream Codes';
    if (source.type === 'file') return 'Uploaded File';
    return 'M3U URL';
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto">
            <List className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-gradient">IPTV Player</h1>
          <p className="text-muted-foreground">Manage your playlists</p>
        </div>

        {/* Saved Playlists */}
        {playlists.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Playlists</h2>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 tv-focusable"
                data-focusable="true"
              >
                <Plus className="w-4 h-4" />
                Add New
              </button>
            </div>

            <div className="space-y-2">
              {playlists.map(playlist => (
                <button
                  key={playlist.id}
                  onClick={() => editingId !== playlist.id && handleSwitch(playlist)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer tv-focusable ${
                    activeId === playlist.id
                      ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                      : 'border-border bg-card hover:border-muted-foreground/30'
                  }`}
                  data-focusable="true"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    activeId === playlist.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {getSourceIcon(playlist.source)}
                  </div>

                  <div className="flex-1 min-w-0">
                    {editingId === playlist.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(playlist.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="flex-1 px-2 py-1 rounded bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        <button onClick={() => handleRename(playlist.id)} className="text-primary hover:text-primary/80"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-foreground truncate">{playlist.name}</p>
                        <p className="text-xs text-muted-foreground">{getSourceLabel(playlist.source)}</p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {activeId !== playlist.id && (
                      <button
                        onClick={() => handleSwitch(playlist)}
                        className="p-2 rounded-lg text-primary hover:bg-primary/10 tv-focusable"
                        data-focusable="true"
                        title="Switch to this playlist"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {activeId === playlist.id && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary uppercase">Active</span>
                    )}
                    <button
                      onClick={() => { setEditingId(playlist.id); setEditName(playlist.name); }}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted tv-focusable"
                      data-focusable="true"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(playlist.id)}
                      className="p-2 rounded-lg text-destructive hover:bg-destructive/10 tv-focusable"
                      data-focusable="true"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Playlist Form */}
        {showAddForm && (
          <div className="space-y-4 bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground">Add Playlist</h3>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Playlist Name (optional)</label>
              <input
                type="text"
                placeholder="My Playlist"
                value={playlistName}
                onChange={e => setPlaylistName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable"
                data-focusable="true"
              />
            </div>

            <div className="flex rounded-lg bg-muted p-1 gap-1">
              {([
                { id: 'm3u' as const, icon: Radio, label: 'M3U' },
                { id: 'xtream' as const, icon: Server, label: 'Xtream' },
                { id: 'file' as const, icon: Upload, label: 'File' },
              ]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setMode(opt.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium tv-focusable transition-colors ${
                    mode === opt.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-focusable="true"
                >
                  <opt.icon className="w-3.5 h-3.5" /> {opt.label}
                </button>
              ))}
            </div>

            {mode === 'file' ? (
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".m3u,.m3u8,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-foreground">Click to upload M3U file</p>
                <p className="text-[10px] text-muted-foreground mt-1">.m3u, .m3u8, .txt</p>
              </div>
            ) : mode === 'm3u' ? (
              <input
                type="url"
                placeholder="https://example.com/playlist.m3u"
                value={m3uUrl}
                onChange={e => setM3uUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable"
                data-focusable="true"
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              />
            ) : (
              <div className="space-y-3">
                <input type="url" placeholder="http://provider.example.com" value={server} onChange={e => setServer(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable" data-focusable="true" />
                <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable" data-focusable="true" />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable" data-focusable="true"
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <p className="text-destructive text-xs whitespace-pre-line">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              {mode !== 'file' && (
                <button
                  onClick={() => handleAdd()}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg gradient-primary text-primary-foreground font-semibold text-sm tv-focusable disabled:opacity-50 flex items-center justify-center gap-2"
                  data-focusable="true"
                >
                  {loading ? 'Loading...' : 'Add & Connect'}
                </button>
              )}
              {playlists.length > 0 && (
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm tv-focusable"
                  data-focusable="true"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
