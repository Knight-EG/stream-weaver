import { useState, useCallback, useMemo } from 'react';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { usePlaylist } from '@/hooks/usePlaylist';
import type { Channel } from '@/lib/m3u-parser';
import { PlaylistSetup } from '@/components/player/PlaylistSetup';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { ChannelList } from '@/components/player/ChannelList';
import { CategorySidebar } from '@/components/player/CategorySidebar';
import { SearchBar } from '@/components/player/SearchBar';
import { Menu, X, Settings, LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  useSpatialNavigation();
  const { user, signOut } = useAuth();

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

  if (playlist.channels.length === 0) {
    return <PlaylistSetup onSubmit={playlist.loadPlaylist} loading={playlist.loading} error={playlist.error} />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden flex-shrink-0 bg-card border-r border-border`}>
        <div className="w-72 h-screen flex flex-col p-3 gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gradient">IPTV Player</h1>
            <div className="flex gap-1">
              <Link to="/admin" className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true">
                <Settings className="w-4 h-4" />
              </Link>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true">
                <X className="w-4 h-4" />
              </button>
            </div>
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
      <main className="flex-1 flex flex-col min-h-screen">
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
          {/* Video Area */}
          <div className="flex-1 p-4">
            {activeChannel ? (
              <VideoPlayer
                url={activeChannel.url}
                title={activeChannel.name}
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

          {/* Channel List (right panel on desktop) */}
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
  );
}
