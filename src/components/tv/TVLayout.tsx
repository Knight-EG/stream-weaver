import { useState, useMemo, useCallback, useRef } from 'react';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import type { Channel } from '@/lib/m3u-parser';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { Radio, Film, Tv, Search, Settings, LogOut, Play, Star, X, ArrowLeft, User, Clock, Heart } from 'lucide-react';
import tileLive from '@/assets/tv-tile-live.jpg';
import tileMovies from '@/assets/tv-tile-movies.jpg';
import tileSeries from '@/assets/tv-tile-series.jpg';
import tileFavorites from '@/assets/tv-tile-favorites.jpg';
import tileSearch from '@/assets/tv-tile-search.jpg';
import tileSettings from '@/assets/tv-tile-settings.jpg';

interface TVLayoutProps {
  channels: Channel[];
  favorites: Set<string>;
  onToggleFavorite: (id: string, name: string) => void;
}

type TVScreen = 'home' | 'live' | 'movies' | 'series' | 'favorites' | 'search' | 'settings' | 'category';

export function TVLayout({ channels, favorites, onToggleFavorite }: TVLayoutProps) {
  useSpatialNavigation();
  const { t } = useLanguage();
  const { signOut, user } = useAuth();

  const [screen, setScreen] = useState<TVScreen>('home');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [browseType, setBrowseType] = useState<'live' | 'movie' | 'series'>('live');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Split channels by type
  const liveChannels = useMemo(() => channels.filter(ch => ch.type === 'live'), [channels]);
  const movieChannels = useMemo(() => channels.filter(ch => ch.type === 'movie'), [channels]);
  const seriesChannels = useMemo(() => channels.filter(ch => ch.type === 'series'), [channels]);
  const favoriteChannels = useMemo(() => channels.filter(ch => favorites.has(ch.id)), [channels, favorites]);

  // Group channels by category
  const groupByCategory = useCallback((list: Channel[]) => {
    const groups: Record<string, Channel[]> = {};
    list.forEach(ch => {
      const cat = ch.group || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ch);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  const liveGroups = useMemo(() => groupByCategory(liveChannels), [liveChannels, groupByCategory]);
  const movieGroups = useMemo(() => groupByCategory(movieChannels), [movieChannels, groupByCategory]);
  const seriesGroups = useMemo(() => groupByCategory(seriesChannels), [seriesChannels, groupByCategory]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return channels.filter(ch => ch.name.toLowerCase().includes(q) || ch.group?.toLowerCase().includes(q)).slice(0, 50);
  }, [channels, searchQuery]);

  // Category content
  const categoryChannels = useMemo(() => {
    if (!selectedCategory) return [];
    const source = browseType === 'live' ? liveGroups : browseType === 'movie' ? movieGroups : seriesGroups;
    const found = source.find(([cat]) => cat === selectedCategory);
    return found ? found[1] : [];
  }, [selectedCategory, browseType, liveGroups, movieGroups, seriesGroups]);

  // Channel navigation for live
  const channelIndex = useMemo(() => {
    if (!activeChannel) return -1;
    return liveChannels.findIndex(c => c.id === activeChannel.id);
  }, [activeChannel, liveChannels]);

  const handleNext = useCallback(() => {
    if (channelIndex < liveChannels.length - 1) setActiveChannel(liveChannels[channelIndex + 1]);
  }, [channelIndex, liveChannels]);

  const handlePrev = useCallback(() => {
    if (channelIndex > 0) setActiveChannel(liveChannels[channelIndex - 1]);
  }, [channelIndex, liveChannels]);

  const navigateTo = useCallback((s: TVScreen, type?: 'live' | 'movie' | 'series') => {
    setScreen(s);
    setSelectedCategory(null);
    if (type) setBrowseType(type);
  }, []);

  const openCategory = useCallback((cat: string, type: 'live' | 'movie' | 'series') => {
    setBrowseType(type);
    setSelectedCategory(cat);
    setScreen('category');
  }, []);

  // Playing
  if (activeChannel) {
    return (
      <div className="fixed inset-0 bg-background z-50">
        <VideoPlayer
          url={activeChannel.url}
          title={activeChannel.name}
          channelId={activeChannel.tvgId || activeChannel.id}
          onBack={() => setActiveChannel(null)}
          onNext={activeChannel.type === 'live' && channelIndex < liveChannels.length - 1 ? handleNext : undefined}
          onPrev={activeChannel.type === 'live' && channelIndex > 0 ? handlePrev : undefined}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ═══ HOME SCREEN ═══ */}
      {screen === 'home' && (
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <div className="px-12 pt-8 pb-4 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-primary">IPTV Player</h1>
              <p className="text-lg text-muted-foreground mt-1">{user?.email}</p>
            </div>
            <div className="flex items-center gap-6 text-muted-foreground">
              <div className="text-end">
                <p className="text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-xs mt-0.5">{channels.length} channels available</p>
              </div>
            </div>
          </div>

          {/* Main Grid - IPTV Smarters Style */}
          <div className="flex-1 flex items-center justify-center px-12 pb-12">
            <div className="grid grid-cols-3 gap-6 w-full max-w-5xl" data-focus-group="home-grid">

              <HomeCard image={tileLive} label={t('dashboardLive')} count={liveChannels.length} onClick={() => navigateTo('live', 'live')} />
              <HomeCard image={tileMovies} label={t('moviesTitle')} count={movieChannels.length} onClick={() => navigateTo('movies', 'movie')} />
              <HomeCard image={tileSeries} label={t('seriesTitle')} count={seriesChannels.length} onClick={() => navigateTo('series', 'series')} />
              <HomeCard image={tileFavorites} label={t('playerFavorites')} count={favoriteChannels.length} onClick={() => navigateTo('favorites')} />
              <HomeCard image={tileSearch} label={t('search')} onClick={() => { navigateTo('search'); setTimeout(() => searchInputRef.current?.focus(), 200); }} />
              <HomeCard image={tileSettings} label={t('settings')} onClick={() => navigateTo('settings')} />
            </div>
          </div>

          {/* Footer */}
          <div className="px-12 pb-6 flex items-center justify-between text-sm text-muted-foreground">
            <p>Use ← → ↑ ↓ to navigate • OK to select • Back to return</p>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-muted/50 tv-focusable text-muted-foreground hover:text-foreground"
              data-focusable="true"
            >
              <LogOut className="w-4 h-4" />
              {t('signOut')}
            </button>
          </div>
        </div>
      )}

      {/* ═══ LIVE / MOVIES / SERIES - Category List ═══ */}
      {(screen === 'live' || screen === 'movies' || screen === 'series') && (
        <div className="min-h-screen flex flex-col">
          <TVHeader
            title={screen === 'live' ? t('dashboardLive') : screen === 'movies' ? t('moviesTitle') : t('seriesTitle')}
            icon={screen === 'live' ? <Radio className="w-8 h-8" /> : screen === 'movies' ? <Film className="w-8 h-8" /> : <Tv className="w-8 h-8" />}
            onBack={() => setScreen('home')}
          />
          <div className="flex-1 px-12 py-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" data-focus-group="categories">
              {/* All channels button */}
              <button
                onClick={() => openCategory('__all__', browseType)}
                className="rounded-2xl bg-gradient-to-br from-primary/80 to-primary p-6 text-start tv-focusable transition-all hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-primary/40"
                data-focusable="true"
              >
                <p className="text-xl font-bold text-primary-foreground">{t('allCategories')}</p>
                <p className="text-sm text-primary-foreground/70 mt-1">
                  {screen === 'live' ? liveChannels.length : screen === 'movies' ? movieChannels.length : seriesChannels.length} items
                </p>
              </button>
              {(screen === 'live' ? liveGroups : screen === 'movies' ? movieGroups : seriesGroups).map(([cat, items]) => (
                <button
                  key={cat}
                  onClick={() => openCategory(cat, browseType)}
                  className="rounded-2xl bg-card border-2 border-border p-6 text-start tv-focusable transition-all hover:scale-105 hover:border-primary focus:scale-105 focus:border-primary focus:ring-4 focus:ring-primary/30"
                  data-focusable="true"
                >
                  <p className="text-lg font-semibold text-foreground truncate">{cat}</p>
                  <p className="text-sm text-muted-foreground mt-1">{items.length} items</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CATEGORY VIEW - Channel Grid ═══ */}
      {screen === 'category' && (
        <div className="min-h-screen flex flex-col">
          <TVHeader
            title={selectedCategory === '__all__' ? t('allCategories') : selectedCategory || ''}
            onBack={() => {
              setScreen(browseType === 'live' ? 'live' : browseType === 'movie' ? 'movies' : 'series');
              setSelectedCategory(null);
            }}
          />
          <div className="flex-1 px-12 py-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4" data-focus-group="channels">
              {(selectedCategory === '__all__'
                ? (browseType === 'live' ? liveChannels : browseType === 'movie' ? movieChannels : seriesChannels)
                : categoryChannels
              ).map(ch => (
                <TVChannelCard
                  key={ch.id}
                  channel={ch}
                  isFavorite={favorites.has(ch.id)}
                  onSelect={setActiveChannel}
                  onToggleFavorite={() => onToggleFavorite(ch.id, ch.name)}
                  isLandscape={ch.type === 'live'}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ FAVORITES ═══ */}
      {screen === 'favorites' && (
        <div className="min-h-screen flex flex-col">
          <TVHeader title={t('playerFavorites')} icon={<Heart className="w-8 h-8" />} onBack={() => setScreen('home')} />
          <div className="flex-1 px-12 py-6">
            {favoriteChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                <Heart className="w-20 h-20 mb-4 opacity-30" />
                <p className="text-2xl">No favorites yet</p>
                <p className="text-lg mt-2">Press and hold OK on any channel to add to favorites</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4" data-focus-group="favorites">
                {favoriteChannels.map(ch => (
                  <TVChannelCard
                    key={ch.id}
                    channel={ch}
                    isFavorite
                    onSelect={setActiveChannel}
                    onToggleFavorite={() => onToggleFavorite(ch.id, ch.name)}
                    isLandscape={ch.type === 'live'}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ SEARCH ═══ */}
      {screen === 'search' && (
        <div className="min-h-screen flex flex-col">
          <TVHeader title={t('search')} icon={<Search className="w-8 h-8" />} onBack={() => setScreen('home')} />
          <div className="px-12 py-6">
            <div className="relative max-w-2xl mb-8">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-7 h-7 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('playerSearchPlaceholder')}
                className="w-full pl-16 pr-16 py-5 rounded-2xl bg-card border-2 border-border text-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary tv-focusable"
                data-focusable="true"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-7 h-7" />
                </button>
              )}
            </div>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4" data-focus-group="search-results">
                {searchResults.map(ch => (
                  <TVChannelCard key={ch.id} channel={ch} isFavorite={favorites.has(ch.id)} onSelect={setActiveChannel} onToggleFavorite={() => onToggleFavorite(ch.id, ch.name)} isLandscape={ch.type === 'live'} />
                ))}
              </div>
            ) : searchQuery ? (
              <p className="text-center text-2xl text-muted-foreground py-20">No results found</p>
            ) : (
              <p className="text-center text-xl text-muted-foreground py-20">Type to search channels, movies, and series</p>
            )}
          </div>
        </div>
      )}

      {/* ═══ SETTINGS ═══ */}
      {screen === 'settings' && (
        <div className="min-h-screen flex flex-col">
          <TVHeader title={t('settings')} icon={<Settings className="w-8 h-8" />} onBack={() => setScreen('home')} />
          <div className="flex-1 px-12 py-6">
            <div className="max-w-2xl space-y-4" data-focus-group="settings">
              {/* Account Info */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <h3 className="text-2xl font-bold text-foreground flex items-center gap-3">
                  <User className="w-7 h-7 text-primary" />
                  Account
                </h3>
                <div className="space-y-2 text-lg">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="text-foreground">{user?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Channels</span>
                    <span className="text-foreground">{channels.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Live</span>
                    <span className="text-foreground">{liveChannels.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Movies</span>
                    <span className="text-foreground">{movieChannels.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Series</span>
                    <span className="text-foreground">{seriesChannels.length}</span>
                  </div>
                </div>
              </div>

              {/* Sign Out */}
              <button
                onClick={signOut}
                className="w-full rounded-2xl bg-destructive/10 border border-destructive/30 p-5 text-xl font-semibold text-destructive hover:bg-destructive/20 tv-focusable transition-all"
                data-focusable="true"
              >
                <span className="flex items-center justify-center gap-3">
                  <LogOut className="w-6 h-6" />
                  {t('signOut')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Home Card Tile ═══ */
function HomeCard({
  icon,
  label,
  count,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-3xl bg-gradient-to-br ${color} p-8 flex flex-col items-center justify-center gap-4 min-h-[200px] tv-focusable transition-all duration-300 hover:scale-105 focus:scale-110 focus:ring-4 focus:ring-white/30 focus:shadow-[0_0_40px_rgba(255,255,255,0.2)] group`}
      data-focusable="true"
    >
      <div className="text-white/90 group-focus:text-white transition-colors">
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{label}</p>
      {count !== undefined && (
        <span className="absolute top-4 end-4 px-3 py-1 rounded-full bg-black/30 text-sm font-medium text-white/80">
          {count}
        </span>
      )}
    </button>
  );
}

/* ═══ TV Header Bar ═══ */
function TVHeader({
  title,
  icon,
  onBack,
}: {
  title: string;
  icon?: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="px-12 py-6 flex items-center gap-4 border-b border-border/50">
      <button
        onClick={onBack}
        className="p-3 rounded-xl hover:bg-muted/50 tv-focusable text-muted-foreground hover:text-foreground transition-all"
        data-focusable="true"
      >
        <ArrowLeft className="w-8 h-8" />
      </button>
      {icon && <span className="text-primary">{icon}</span>}
      <h2 className="text-3xl font-bold text-foreground">{title}</h2>
    </div>
  );
}

/* ═══ TV Channel Card ═══ */
function TVChannelCard({
  channel,
  isFavorite,
  onSelect,
  onToggleFavorite,
  isLandscape = false,
}: {
  channel: Channel;
  isFavorite: boolean;
  onSelect: (ch: Channel) => void;
  onToggleFavorite: () => void;
  isLandscape?: boolean;
}) {
  const icon = channel.type === 'movie' ? <Film className="w-10 h-10 text-muted-foreground" />
    : channel.type === 'series' ? <Tv className="w-10 h-10 text-muted-foreground" />
    : <Radio className="w-10 h-10 text-muted-foreground" />;

  return (
    <button
      onClick={() => onSelect(channel)}
      className="rounded-2xl overflow-hidden bg-card border-2 border-transparent hover:border-primary transition-all tv-focusable group focus:border-primary focus:shadow-[0_0_30px_hsl(var(--primary)/0.4)] focus:scale-105"
      data-focusable="true"
    >
      <div className={`${isLandscape ? 'aspect-video' : 'aspect-[2/3]'} bg-muted flex items-center justify-center overflow-hidden relative`}>
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className={`w-full h-full ${isLandscape ? 'object-contain p-3' : 'object-cover'} group-hover:scale-110 group-focus:scale-110 transition-transform duration-300`}
            loading="lazy"
          />
        ) : icon}
        {/* Play overlay on focus */}
        <div className="absolute inset-0 bg-background/60 opacity-0 group-focus:opacity-100 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
            <Play className="w-7 h-7 text-primary-foreground ml-1" />
          </div>
        </div>
        {/* Favorite star */}
        {isFavorite && (
          <div className="absolute top-2 end-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-base font-semibold text-foreground truncate">{channel.name}</p>
        {channel.group && <p className="text-sm text-muted-foreground truncate mt-0.5">{channel.group}</p>}
      </div>
    </button>
  );
}
