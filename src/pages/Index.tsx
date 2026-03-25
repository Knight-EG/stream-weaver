import { useState, useCallback, useMemo } from 'react';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useAccessGuard } from '@/hooks/useAccessGuard';
import type { Channel } from '@/lib/m3u-parser';
import { PlaylistSetup } from '@/components/player/PlaylistSetup';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { ChannelList } from '@/components/player/ChannelList';
import { CategorySidebar } from '@/components/player/CategorySidebar';
import { SearchBar } from '@/components/player/SearchBar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Menu, X, Settings, LogOut, User, AlertTriangle, Loader2, Clock, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  useSpatialNavigation();
  const { user, signOut } = useAuth();
  const { access, loading: accessLoading, refresh: refreshAccess } = useAccessGuard();

  const playlist = usePlaylist();
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSelectChannel = useCallback((ch: Channel) => {
    setActiveChannel(ch);
  }, []);

  const channelIndex = useMemo(() => {
    if (!activeChannel) return -1;
    return playlist.filteredChannels.findIndex(c => c.id === activeChannel.id);
  }, [activeChannel, playlist.filteredChannels]);

  const handleNext = useCallback(() => {
    if (channelIndex < playlist.filteredChannels.length - 1) {
      setActiveChannel(playlist.filteredChannels[channelIndex + 1]);
    }
  }, [channelIndex, playlist.filteredChannels]);

  const handlePrev = useCallback(() => {
    if (channelIndex > 0) {
      setActiveChannel(playlist.filteredChannels[channelIndex - 1]);
    }
  }, [channelIndex, playlist.filteredChannels]);

  // Loading
  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Trial expired & no subscription → Activation required screen
  if (access && !access.allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-warning/20 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-10 h-10 text-warning" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Activation Required</h1>
          <p className="text-muted-foreground">{access.reason}</p>

          <div className="bg-card border border-border rounded-xl p-6 text-left space-y-3">
            <h3 className="text-foreground font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Trial Status
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Trial Period</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/20 text-destructive">
                Expired
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Subscription</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/20 text-destructive">
                Not Active
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Contact your provider to activate your subscription. Once activated, the app will work immediately.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={refreshAccess}
              className="px-6 py-3 rounded-lg gradient-primary text-primary-foreground font-semibold tv-focusable flex items-center justify-center gap-2"
              data-focusable="true"
            >
              <ShieldCheck className="w-4 h-4" /> Check Activation
            </button>
            <Link
              to="/settings"
              className="px-6 py-3 rounded-lg bg-secondary text-secondary-foreground font-semibold tv-focusable text-center"
              data-focusable="true"
            >
              Manage Devices
            </Link>
            <button
              onClick={signOut}
              className="px-6 py-3 rounded-lg text-destructive hover:bg-destructive/10 font-semibold tv-focusable"
              data-focusable="true"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (playlist.channels.length === 0) {
    return <PlaylistSetup onSubmit={playlist.loadPlaylist} loading={playlist.loading} error={playlist.error} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Trial banner */}
      {access?.trialActive && (
        <div className="bg-warning/10 border-b border-warning/30 px-4 py-2 flex items-center justify-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-warning" />
          <span className="text-warning font-medium">
            Trial: {access.trialDaysLeft} day{access.trialDaysLeft !== 1 ? 's' : ''} remaining
          </span>
          <span className="text-muted-foreground">— Activate your subscription to continue after trial ends.</span>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden flex-shrink-0 bg-card border-r border-border`}>
          <div className="w-72 h-full flex flex-col p-3 gap-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-gradient">IPTV Player</h1>
              <div className="flex gap-1">
                <NotificationBell />
                <Link to="/settings" className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true" title="Settings">
                  <User className="w-4 h-4" />
                </Link>
                <Link to="/admin" className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true" title="Admin">
                  <Settings className="w-4 h-4" />
                </Link>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 px-1 py-1.5 text-xs text-muted-foreground border-b border-border pb-3">
              <span className="truncate">{user?.email}</span>
              {access?.subscription && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-success/20 text-success">Active</span>
              )}
              {access?.trialActive && !access?.subscription && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-warning/20 text-warning">Trial</span>
              )}
              <button onClick={signOut} className="text-muted-foreground hover:text-destructive tv-focusable" data-focusable="true" title="Sign Out">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
            <SearchBar value={playlist.searchQuery} onChange={playlist.setSearch} />
            <CategorySidebar
              categories={playlist.categories}
              selected={playlist.selectedCategory}
              onSelect={playlist.setCategory}
              favoriteCount={playlist.favorites.size}
            />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-0">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="fixed top-4 left-4 z-50 p-2 bg-card border border-border rounded-lg tv-focusable"
              data-focusable="true"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
          )}

          <div className="flex-1 flex flex-col lg:flex-row">
            <div className="flex-1 p-4">
              {activeChannel ? (
                <VideoPlayer
                  url={activeChannel.url}
                  title={activeChannel.name}
                  channelId={activeChannel.tvgId || activeChannel.id}
                  onBack={() => setActiveChannel(null)}
                  onNext={channelIndex < playlist.filteredChannels.length - 1 ? handleNext : undefined}
                  onPrev={channelIndex > 0 ? handlePrev : undefined}
                />
              ) : (
                <div className="w-full aspect-video bg-player-bg rounded-lg flex flex-col items-center justify-center gap-3">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                    <Menu className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">Select a channel to start watching</p>
                </div>
              )}
            </div>

            <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border p-3 overflow-y-auto">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 px-1">
                {playlist.filteredChannels.length} channels
              </p>
              <ChannelList
                channels={playlist.filteredChannels}
                activeId={activeChannel?.id}
                favorites={playlist.favorites}
                onSelect={handleSelectChannel}
                onToggleFavorite={playlist.toggleFavorite}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
