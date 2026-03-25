import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import type { Channel } from '@/lib/m3u-parser';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { Radio, Film, Tv, Search, Settings, LogOut, ChevronRight, Play, Star, X } from 'lucide-react';

interface TVLayoutProps {
  channels: Channel[];
  favorites: Set<string>;
  onToggleFavorite: (id: string, name: string) => void;
}

type TVSection = 'home' | 'live' | 'movies' | 'series' | 'search';

export function TVLayout({ channels, favorites, onToggleFavorite }: TVLayoutProps) {
  useSpatialNavigation();
  const { t } = useLanguage();
  const { signOut } = useAuth();

  const [section, setSection] = useState<TVSection>('home');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Split channels by type
  const liveChannels = useMemo(() => channels.filter(ch => ch.type === 'live'), [channels]);
  const movieChannels = useMemo(() => channels.filter(ch => ch.type === 'movie'), [channels]);
  const seriesChannels = useMemo(() => channels.filter(ch => ch.type === 'series'), [channels]);

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

  // Hero item - random featured content
  const heroItem = useMemo(() => {
    const pool = [...movieChannels, ...seriesChannels].filter(ch => ch.logo);
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : liveChannels[0] || null;
  }, [movieChannels, seriesChannels, liveChannels]);

  // Favorite channels
  const favoriteChannels = useMemo(() => channels.filter(ch => favorites.has(ch.id)), [channels, favorites]);

  // Categories for browse mode
  const currentCategories = useMemo(() => {
    if (section === 'live') return liveGroups.map(([cat]) => cat);
    if (section === 'movies') return movieGroups.map(([cat]) => cat);
    if (section === 'series') return seriesGroups.map(([cat]) => cat);
    return [];
  }, [section, liveGroups, movieGroups, seriesGroups]);

  const filteredByCategory = useMemo(() => {
    if (!selectedCategory) return [];
    const source = section === 'live' ? liveGroups : section === 'movies' ? movieGroups : seriesGroups;
    const found = source.find(([cat]) => cat === selectedCategory);
    return found ? found[1] : [];
  }, [selectedCategory, section, liveGroups, movieGroups, seriesGroups]);

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
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 inset-x-0 z-40 bg-gradient-to-b from-background via-background/95 to-transparent">
        <div className="flex items-center px-12 py-6 gap-8">
          <h1 className="text-3xl font-bold text-gradient flex-shrink-0">{t('appName')}</h1>

          <div className="flex items-center gap-2" data-focus-group="nav">
            {([
              { id: 'home' as TVSection, label: t('dashboardHome') },
              { id: 'live' as TVSection, label: t('dashboardLive') },
              { id: 'movies' as TVSection, label: t('moviesTitle') },
              { id: 'series' as TVSection, label: t('seriesTitle') },
            ]).map(item => (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); setSelectedCategory(null); }}
                className={`px-6 py-3 rounded-xl text-lg font-semibold transition-all tv-focusable ${
                  section === item.id
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                data-focusable="true"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-4">
            <button
              onClick={() => { setSection('search'); setTimeout(() => searchInputRef.current?.focus(), 100); }}
              className="p-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 tv-focusable"
              data-focusable="true"
            >
              <Search className="w-7 h-7" />
            </button>
            <button
              onClick={signOut}
              className="p-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 tv-focusable"
              data-focusable="true"
            >
              <LogOut className="w-7 h-7" />
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-24">
        {/* SEARCH SECTION */}
        {section === 'search' && (
          <div className="px-12 py-8">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
                {searchResults.map(ch => (
                  <TVCard key={ch.id} channel={ch} onSelect={setActiveChannel} size="medium" />
                ))}
              </div>
            ) : searchQuery ? (
              <p className="text-center text-2xl text-muted-foreground py-20">No results found</p>
            ) : null}
          </div>
        )}

        {/* HOME SECTION */}
        {section === 'home' && (
          <div className="space-y-8 pb-12">
            {/* Hero Banner */}
            {heroItem && (
              <div className="relative mx-12 h-[50vh] min-h-[400px] rounded-3xl overflow-hidden bg-card">
                {heroItem.logo && (
                  <img src={heroItem.logo} alt={heroItem.name} className="absolute inset-0 w-full h-full object-cover opacity-40" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-12 space-y-4">
                  <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold bg-primary/20 text-primary border border-primary/30">
                    {heroItem.type === 'movie' ? '🎬 Movie' : heroItem.type === 'series' ? '📺 Series' : '📡 Live'}
                  </span>
                  <h2 className="text-5xl font-bold text-foreground max-w-2xl leading-tight">{heroItem.name}</h2>
                  {heroItem.group && <p className="text-xl text-muted-foreground">{heroItem.group}</p>}
                  <button
                    onClick={() => setActiveChannel(heroItem)}
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground text-xl font-bold hover:bg-primary/90 transition-all tv-focusable shadow-lg shadow-primary/30"
                    data-focusable="true"
                  >
                    <Play className="w-7 h-7" />
                    {t('playNow')}
                  </button>
                </div>
              </div>
            )}

            {/* Favorites Row */}
            {favoriteChannels.length > 0 && (
              <TVRow
                title={`⭐ ${t('favorites')}`}
                channels={favoriteChannels}
                onSelect={setActiveChannel}
              />
            )}

            {/* Live TV Row */}
            {liveChannels.length > 0 && (
              <TVRow
                title={`📡 ${t('dashboardLive')}`}
                channels={liveChannels.slice(0, 20)}
                onSelect={setActiveChannel}
                onViewAll={() => setSection('live')}
                cardType="landscape"
              />
            )}

            {/* Movies Row */}
            {movieChannels.length > 0 && (
              <TVRow
                title={`🎬 ${t('moviesTitle')}`}
                channels={movieChannels.slice(0, 20)}
                onSelect={setActiveChannel}
                onViewAll={() => setSection('movies')}
              />
            )}

            {/* Series Row */}
            {seriesChannels.length > 0 && (
              <TVRow
                title={`📺 ${t('seriesTitle')}`}
                channels={seriesChannels.slice(0, 20)}
                onSelect={setActiveChannel}
                onViewAll={() => setSection('series')}
              />
            )}
          </div>
        )}

        {/* LIVE / MOVIES / SERIES SECTION */}
        {(section === 'live' || section === 'movies' || section === 'series') && (
          <div className="pb-12">
            {/* Category tabs */}
            {currentCategories.length > 0 && (
              <div className="px-12 mb-6">
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" data-focus-group="categories">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-6 py-3 rounded-xl text-lg font-semibold whitespace-nowrap tv-focusable transition-all ${
                      !selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                    }`}
                    data-focusable="true"
                  >
                    {t('allCategories')}
                  </button>
                  {currentCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                      className={`px-6 py-3 rounded-xl text-lg font-semibold whitespace-nowrap tv-focusable transition-all ${
                        selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                      }`}
                      data-focusable="true"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            {selectedCategory ? (
              <div className="px-12">
                <h2 className="text-3xl font-bold text-foreground mb-6">{selectedCategory}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
                  {filteredByCategory.map(ch => (
                    <TVCard key={ch.id} channel={ch} onSelect={setActiveChannel} size="medium" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {(section === 'live' ? liveGroups : section === 'movies' ? movieGroups : seriesGroups).map(([cat, items]) => (
                  <TVRow
                    key={cat}
                    title={cat}
                    channels={items.slice(0, 20)}
                    onSelect={setActiveChannel}
                    onViewAll={() => setSelectedCategory(cat)}
                    cardType={section === 'live' ? 'landscape' : 'portrait'}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Horizontal Scrolling Row ── */
function TVRow({
  title,
  channels,
  onSelect,
  onViewAll,
  cardType = 'portrait',
}: {
  title: string;
  channels: Channel[];
  onSelect: (ch: Channel) => void;
  onViewAll?: () => void;
  cardType?: 'portrait' | 'landscape';
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-12">
        <h3 className="text-2xl font-bold text-foreground">{title}</h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-lg text-primary hover:text-primary/80 tv-focusable"
            data-focusable="true"
          >
            View All <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-12 pb-4 scrollbar-hide"
        data-focus-group="row"
      >
        {channels.map(ch => (
          <TVCard key={ch.id} channel={ch} onSelect={onSelect} type={cardType} />
        ))}
      </div>
    </div>
  );
}

/* ── TV Card Component ── */
function TVCard({
  channel,
  onSelect,
  type = 'portrait',
  size = 'normal',
}: {
  channel: Channel;
  onSelect: (ch: Channel) => void;
  type?: 'portrait' | 'landscape';
  size?: 'normal' | 'medium';
}) {
  const isLandscape = type === 'landscape';
  const cardWidth = size === 'medium'
    ? (isLandscape ? 'w-64' : 'w-44')
    : (isLandscape ? 'w-72' : 'w-48');

  const icon = channel.type === 'movie' ? <Film className="w-10 h-10 text-muted-foreground" />
    : channel.type === 'series' ? <Tv className="w-10 h-10 text-muted-foreground" />
    : <Radio className="w-10 h-10 text-muted-foreground" />;

  return (
    <button
      onClick={() => onSelect(channel)}
      className={`${cardWidth} flex-shrink-0 rounded-2xl overflow-hidden bg-card border-2 border-transparent hover:border-primary transition-all tv-focusable group focus:border-primary focus:shadow-[0_0_30px_hsl(var(--primary)/0.4)] focus:scale-105`}
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
          <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
            <Play className="w-8 h-8 text-primary-foreground ml-1" />
          </div>
        </div>
      </div>
      <div className="p-3">
        <p className="text-base font-semibold text-foreground truncate">{channel.name}</p>
        {channel.group && <p className="text-sm text-muted-foreground truncate mt-0.5">{channel.group}</p>}
      </div>
    </button>
  );
}
