import { useState, useMemo, useCallback } from 'react';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useAccessGuard } from '@/hooks/useAccessGuard';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Channel } from '@/lib/m3u-parser';
import { isTVDevice } from '@/lib/tv-detect';
import { TVLayout } from '@/components/tv/TVLayout';
import { PlaylistManager, getSavedPlaylists, getActivePlaylistId, setActivePlaylistId } from '@/components/player/PlaylistManager';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { ChannelList } from '@/components/player/ChannelList';
import { CategorySidebar } from '@/components/player/CategorySidebar';
import { SearchBar } from '@/components/player/SearchBar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Menu, X, Settings, LogOut, User, Loader2, Clock, ShieldCheck, Infinity, CreditCard, Store, Film, Tv, Radio, Home, Grid3X3, List, Search, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type Section = 'home' | 'live' | 'movies' | 'series';

export default function Index() {
  useSpatialNavigation();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const { access, loading: accessLoading, refresh: refreshAccess } = useAccessGuard();

  const playlist = usePlaylist();
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [section, setSection] = useState<Section>('home');
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);
  const [movieSearch, setMovieSearch] = useState('');
  const [seriesSearch, setSeriesSearch] = useState('');
  const [movieCategory, setMovieCategory] = useState<string | null>(null);
  const [seriesCategory, setSeriesCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const handleSelectChannel = useCallback((ch: Channel) => { setActiveChannel(ch); }, []);

  // Filtered by type
  const liveChannels = useMemo(() => playlist.channels.filter(ch => ch.type === 'live'), [playlist.channels]);
  const movieChannels = useMemo(() => playlist.channels.filter(ch => ch.type === 'movie'), [playlist.channels]);
  const seriesChannels = useMemo(() => playlist.channels.filter(ch => ch.type === 'series'), [playlist.channels]);

  // Categories per type
  const liveCategories = useMemo(() => {
    const cats = new Set<string>();
    liveChannels.forEach(ch => { if (ch.group) cats.add(ch.group); });
    return Array.from(cats).sort();
  }, [liveChannels]);

  const movieCategories = useMemo(() => {
    const cats = new Set<string>();
    movieChannels.forEach(ch => { if (ch.group) cats.add(ch.group); });
    return Array.from(cats).sort();
  }, [movieChannels]);

  const seriesCategories = useMemo(() => {
    const cats = new Set<string>();
    seriesChannels.forEach(ch => { if (ch.group) cats.add(ch.group); });
    return Array.from(cats).sort();
  }, [seriesChannels]);

  // Filtered movies
  const filteredMovies = useMemo(() => {
    let list = movieChannels;
    if (movieCategory) list = list.filter(m => m.group === movieCategory);
    if (movieSearch) {
      const q = movieSearch.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.group?.toLowerCase().includes(q));
    }
    return list;
  }, [movieChannels, movieCategory, movieSearch]);

  // Filtered series
  const filteredSeries = useMemo(() => {
    let list = seriesChannels;
    if (seriesCategory) list = list.filter(s => s.group === seriesCategory);
    if (seriesSearch) {
      const q = seriesSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.group?.toLowerCase().includes(q));
    }
    return list;
  }, [seriesChannels, seriesCategory, seriesSearch]);

  // Live TV channel navigation
  const channelIndex = useMemo(() => {
    if (!activeChannel) return -1;
    return playlist.filteredChannels.findIndex(c => c.id === activeChannel.id);
  }, [activeChannel, playlist.filteredChannels]);

  const handleNext = useCallback(() => {
    if (channelIndex < playlist.filteredChannels.length - 1) setActiveChannel(playlist.filteredChannels[channelIndex + 1]);
  }, [channelIndex, playlist.filteredChannels]);

  const handlePrev = useCallback(() => {
    if (channelIndex > 0) setActiveChannel(playlist.filteredChannels[channelIndex - 1]);
  }, [channelIndex, playlist.filteredChannels]);

  if (accessLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;

  // Access denied
  if (access && !access.allowed) {
    const isBanned = access.tempBan?.active;
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full text-center space-y-6">
          <div className={`w-20 h-20 rounded-full ${isBanned ? 'bg-destructive/20' : 'bg-warning/20'} flex items-center justify-center mx-auto`}>
            <ShieldCheck className={`w-10 h-10 ${isBanned ? 'text-destructive' : 'text-warning'}`} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isBanned ? t('accessAccountSuspended') : t('accessActivationRequired')}
          </h1>
          <p className="text-muted-foreground">{access.reason}</p>
          {isBanned && access.tempBan?.expiresAt && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
              ⏱️ {t('accessBanExpires')}: {new Date(access.tempBan.expiresAt).toLocaleString()}
            </div>
          )}
          {!isBanned && (
            <div className="bg-card border border-border rounded-xl p-6 text-start space-y-3">
              <h3 className="text-foreground font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /> Trial Status</h3>
              <div className="flex items-center justify-between"><span className="text-muted-foreground text-sm">Trial Period</span><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/20 text-destructive">{t('accessTrialExpired')}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground text-sm">{t('settingsSubscription')}</span><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/20 text-destructive">Not Active</span></div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">{t('accessActivateMessage')}</p>
          <div className="flex flex-col gap-3">
            {!isBanned && <Link to="/pricing" className="px-6 py-3 rounded-lg gradient-primary text-primary-foreground font-semibold tv-focusable text-center flex items-center justify-center gap-2" data-focusable="true"><CreditCard className="w-4 h-4" /> {t('accessSubscribeNow')}</Link>}
            <button onClick={refreshAccess} className="px-6 py-3 rounded-lg bg-secondary text-secondary-foreground font-semibold tv-focusable flex items-center justify-center gap-2" data-focusable="true"><ShieldCheck className="w-4 h-4" /> {t('accessCheckActivation')}</button>
            <Link to="/settings" className="px-6 py-3 rounded-lg bg-secondary text-secondary-foreground font-semibold tv-focusable text-center" data-focusable="true">{t('accessManageDevices')}</Link>
            <button onClick={signOut} className="px-6 py-3 rounded-lg text-destructive hover:bg-destructive/10 font-semibold tv-focusable" data-focusable="true">{t('signOut')}</button>
          </div>
        </div>
      </div>
    );
  }

  if (playlist.channels.length === 0 || showPlaylistManager) {
    return (
      <PlaylistManager
        onLoadPlaylist={(source) => {
          playlist.loadPlaylist(source);
          setShowPlaylistManager(false);
        }}
        loading={playlist.loading}
        error={playlist.error}
        currentChannelCount={playlist.channels.length}
      />
    );
  }

  // Auto-load active playlist on mount
  if (playlist.channels.length === 0) {
    const saved = getSavedPlaylists();
    const activeId = getActivePlaylistId();
    const active = saved.find(p => p.id === activeId) || saved[0];
    if (active) {
      playlist.loadPlaylist(active.source);
      setActivePlaylistId(active.id);
    }
  }

  // TV Mode - Netflix/Shahid style interface
  if (isTVDevice()) {
    return <TVLayout channels={playlist.channels} favorites={playlist.favorites} onToggleFavorite={playlist.toggleFavorite} />;
  }

  // Playing a channel/movie/episode fullscreen
  if (activeChannel) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <VideoPlayer
          url={activeChannel.url}
          title={activeChannel.name}
          channelId={activeChannel.tvgId || activeChannel.id}
          onBack={() => setActiveChannel(null)}
          onNext={section === 'live' && channelIndex < playlist.filteredChannels.length - 1 ? handleNext : undefined}
          onPrev={section === 'live' && channelIndex > 0 ? handlePrev : undefined}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Trial Banner */}
      {access?.trialActive && (
        <div className="bg-warning/10 border-b border-warning/30 px-4 py-2 flex items-center justify-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-warning" />
          <span className="text-warning font-medium">Trial: {access.trialDaysLeft} {t('accessTrialRemaining')}</span>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden flex-shrink-0 bg-card border-e border-border`}>
          <div className="w-64 h-full flex flex-col">
            {/* App Header */}
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-lg font-bold text-gradient">{t('appName')}</h1>
                <div className="flex gap-1">
                  <LanguageSwitcher />
                  <NotificationBell />
                  <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
                <span className="truncate">{user?.email}</span>
                {access?.subscription?.planType === 'lifetime' && <span className="ms-auto px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent/20 text-accent flex items-center gap-0.5"><Infinity className="w-2.5 h-2.5" /> Lifetime</span>}
                {access?.subscription && access.subscription.planType !== 'lifetime' && <span className="ms-auto px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-success/20 text-success">Active</span>}
                {access?.trialActive && !access?.subscription && <span className="ms-auto px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-warning/20 text-warning">Trial</span>}
              </div>
            </div>

            {/* Main Navigation */}
            <nav className="p-2 space-y-1">
              {[
                { id: 'home' as Section, icon: Home, label: t('dashboardHome'), count: playlist.channels.length },
                { id: 'live' as Section, icon: Radio, label: t('dashboardLive'), count: liveChannels.length },
                { id: 'movies' as Section, icon: Film, label: t('moviesTitle'), count: movieChannels.length },
                { id: 'series' as Section, icon: Tv, label: t('seriesTitle'), count: seriesChannels.length },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all tv-focusable ${
                    section === item.id
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  data-focusable="true"
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-start">{item.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    section === item.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>{item.count}</span>
                </button>
              ))}
            </nav>

            {/* Section-specific sidebar content */}
            {section === 'live' && (
              <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
                <SearchBar value={playlist.searchQuery} onChange={playlist.setSearch} />
                <div className="flex-1 overflow-y-auto">
                  <CategorySidebar categories={liveCategories} selected={playlist.selectedCategory} onSelect={playlist.setCategory} favoriteCount={playlist.favorites.size} />
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="p-2 border-t border-border space-y-1 mt-auto">
              {[
                { to: '/settings', icon: User, label: t('settings') },
                { to: '/pricing', icon: CreditCard, label: t('pricingTitle') },
                { to: '/admin', icon: Settings, label: t('adminTitle') },
                { to: '/reseller', icon: Store, label: t('resellerPanel') },
              ].map(link => (
                <Link key={link.to} to={link.to} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 tv-focusable" data-focusable="true">
                  <link.icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              ))}
              <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-destructive hover:bg-destructive/10 tv-focusable" data-focusable="true">
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('signOut')}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="fixed top-4 start-4 z-50 p-2 bg-card border border-border rounded-lg tv-focusable" data-focusable="true"><Menu className="w-5 h-5 text-foreground" /></button>
          )}

          {/* HOME SECTION */}
          {section === 'home' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Hero Stats */}
              <div className="grid grid-cols-3 gap-4">
                <button onClick={() => setSection('live')} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all tv-focusable group" data-focusable="true">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                      <Radio className="w-7 h-7 text-primary" />
                    </div>
                    <div className="text-start">
                      <p className="text-3xl font-bold text-foreground">{liveChannels.length}</p>
                      <p className="text-sm text-muted-foreground">{t('dashboardLive')}</p>
                    </div>
                  </div>
                </button>
                <button onClick={() => setSection('movies')} className="bg-card border border-border rounded-2xl p-6 hover:border-accent/50 transition-all tv-focusable group" data-focusable="true">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-accent/15 flex items-center justify-center group-hover:bg-accent/25 transition-colors">
                      <Film className="w-7 h-7 text-accent" />
                    </div>
                    <div className="text-start">
                      <p className="text-3xl font-bold text-foreground">{movieChannels.length}</p>
                      <p className="text-sm text-muted-foreground">{t('moviesTitle')}</p>
                    </div>
                  </div>
                </button>
                <button onClick={() => setSection('series')} className="bg-card border border-border rounded-2xl p-6 hover:border-success/50 transition-all tv-focusable group" data-focusable="true">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-success/15 flex items-center justify-center group-hover:bg-success/25 transition-colors">
                      <Tv className="w-7 h-7 text-success" />
                    </div>
                    <div className="text-start">
                      <p className="text-3xl font-bold text-foreground">{seriesChannels.length}</p>
                      <p className="text-sm text-muted-foreground">{t('seriesTitle')}</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Recent Live Channels */}
              {liveChannels.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Radio className="w-5 h-5 text-primary" /> {t('dashboardLive')}</h2>
                    <button onClick={() => setSection('live')} className="text-xs text-primary hover:underline tv-focusable" data-focusable="true">{t('dashboardViewAll')} →</button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {liveChannels.slice(0, 12).map(ch => (
                      <button key={ch.id} onClick={() => { setSection('live'); setActiveChannel(ch); }} className="flex-shrink-0 w-36 bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all tv-focusable group" data-focusable="true">
                        <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                          {ch.logo ? <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform" loading="lazy" /> : <Radio className="w-6 h-6 text-muted-foreground" />}
                        </div>
                        <div className="p-2">
                          <p className="text-[11px] font-medium text-foreground truncate">{ch.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Movies Preview */}
              {movieChannels.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Film className="w-5 h-5 text-accent" /> {t('moviesTitle')}</h2>
                    <button onClick={() => setSection('movies')} className="text-xs text-primary hover:underline tv-focusable" data-focusable="true">{t('dashboardViewAll')} →</button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {movieChannels.slice(0, 10).map(m => (
                      <button key={m.id} onClick={() => { setSection('movies'); setActiveChannel(m); }} className="flex-shrink-0 w-32 bg-card border border-border rounded-xl overflow-hidden hover:border-accent/50 transition-all tv-focusable group" data-focusable="true">
                        <div className="aspect-[2/3] bg-muted flex items-center justify-center overflow-hidden">
                          {m.logo ? <img src={m.logo} alt={m.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" /> : <Film className="w-6 h-6 text-muted-foreground" />}
                        </div>
                        <div className="p-2">
                          <p className="text-[11px] font-medium text-foreground truncate">{m.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Series Preview */}
              {seriesChannels.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Tv className="w-5 h-5 text-success" /> {t('seriesTitle')}</h2>
                    <button onClick={() => setSection('series')} className="text-xs text-primary hover:underline tv-focusable" data-focusable="true">{t('dashboardViewAll')} →</button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {seriesChannels.slice(0, 10).map(s => (
                      <button key={s.id} onClick={() => { setSection('series'); setActiveChannel(s); }} className="flex-shrink-0 w-32 bg-card border border-border rounded-xl overflow-hidden hover:border-success/50 transition-all tv-focusable group" data-focusable="true">
                        <div className="aspect-[2/3] bg-muted flex items-center justify-center overflow-hidden">
                          {s.logo ? <img src={s.logo} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" /> : <Tv className="w-6 h-6 text-muted-foreground" />}
                        </div>
                        <div className="p-2">
                          <p className="text-[11px] font-medium text-foreground truncate">{s.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LIVE TV SECTION */}
          {section === 'live' && (
            <div className="flex-1 flex flex-col lg:flex-row min-h-0">
              <div className="flex-1 p-4 flex flex-col">
                <div className="w-full aspect-video bg-player-bg rounded-lg flex flex-col items-center justify-center gap-3 mb-4">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center"><Radio className="w-10 h-10 text-muted-foreground" /></div>
                  <p className="text-muted-foreground">{t('playerSelectChannel')}</p>
                </div>
              </div>
              <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-s border-border p-3 overflow-y-auto">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 px-1">{playlist.filteredChannels.filter(c => c.type === 'live').length} {t('playerChannels')}</p>
                <ChannelList
                  channels={playlist.filteredChannels.filter(c => c.type === 'live')}
                  activeId={activeChannel?.id}
                  favorites={playlist.favorites}
                  onSelect={handleSelectChannel}
                  onToggleFavorite={playlist.toggleFavorite}
                />
              </div>
            </div>
          )}

          {/* MOVIES SECTION */}
          {section === 'movies' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Search & Category bar */}
              <div className="px-4 py-3 border-b border-border bg-card/50 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="text" placeholder={t('moviesSearchPlaceholder')} value={movieSearch} onChange={e => setMovieSearch(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable" data-focusable="true" />
                    {movieSearch && <button onClick={() => setMovieSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
                  </div>
                  <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="p-2.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground tv-focusable" data-focusable="true">
                    {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button onClick={() => setMovieCategory(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap tv-focusable transition-colors ${!movieCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`} data-focusable="true">{t('allCategories')}</button>
                  {movieCategories.map(cat => (
                    <button key={cat} onClick={() => setMovieCategory(cat === movieCategory ? null : cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap tv-focusable transition-colors ${movieCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`} data-focusable="true">{cat}</button>
                  ))}
                </div>
              </div>
              {/* Grid / List */}
              <div className="flex-1 p-4 overflow-y-auto">
                {filteredMovies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Film className="w-12 h-12 mb-3 opacity-50" />
                    <p>{t('moviesEmpty')}</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filteredMovies.map(movie => (
                      <button key={movie.id} onClick={() => setActiveChannel(movie)} className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all tv-focusable" data-focusable="true">
                        <div className="aspect-[2/3] bg-muted flex items-center justify-center overflow-hidden">
                          {movie.logo ? <img src={movie.logo} alt={movie.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" /> : <Film className="w-8 h-8 text-muted-foreground" />}
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium text-foreground truncate">{movie.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{movie.group}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredMovies.map(movie => (
                      <button key={movie.id} onClick={() => setActiveChannel(movie)} className="w-full flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-all tv-focusable" data-focusable="true">
                        <div className="w-12 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                          {movie.logo ? <img src={movie.logo} alt={movie.name} className="w-full h-full object-cover" loading="lazy" /> : <Film className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0 text-start">
                          <p className="text-sm font-medium text-foreground truncate">{movie.name}</p>
                          <p className="text-xs text-muted-foreground">{movie.group}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SERIES SECTION */}
          {section === 'series' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-border bg-card/50 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="text" placeholder={t('seriesSearchPlaceholder')} value={seriesSearch} onChange={e => setSeriesSearch(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable" data-focusable="true" />
                    {seriesSearch && <button onClick={() => setSeriesSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
                  </div>
                  <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="p-2.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground tv-focusable" data-focusable="true">
                    {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button onClick={() => setSeriesCategory(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap tv-focusable transition-colors ${!seriesCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`} data-focusable="true">{t('allCategories')}</button>
                  {seriesCategories.map(cat => (
                    <button key={cat} onClick={() => setSeriesCategory(cat === seriesCategory ? null : cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap tv-focusable transition-colors ${seriesCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`} data-focusable="true">{cat}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                {filteredSeries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Tv className="w-12 h-12 mb-3 opacity-50" />
                    <p>{t('seriesEmpty')}</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filteredSeries.map(ep => (
                      <button key={ep.id} onClick={() => setActiveChannel(ep)} className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all tv-focusable" data-focusable="true">
                        <div className="aspect-[2/3] bg-muted flex items-center justify-center overflow-hidden">
                          {ep.logo ? <img src={ep.logo} alt={ep.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" /> : <Tv className="w-8 h-8 text-muted-foreground" />}
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium text-foreground truncate">{ep.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{ep.group}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredSeries.map(ep => (
                      <button key={ep.id} onClick={() => setActiveChannel(ep)} className="w-full flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-all tv-focusable" data-focusable="true">
                        <div className="w-12 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                          {ep.logo ? <img src={ep.logo} alt={ep.name} className="w-full h-full object-cover" loading="lazy" /> : <Tv className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0 text-start">
                          <p className="text-sm font-medium text-foreground truncate">{ep.name}</p>
                          <p className="text-xs text-muted-foreground">{ep.group}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
