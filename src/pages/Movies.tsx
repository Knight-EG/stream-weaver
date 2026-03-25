import { useState, useMemo } from 'react';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Link } from 'react-router-dom';
import { Film, Search, X, ArrowLeft, Grid3X3, List, SlidersHorizontal } from 'lucide-react';
import type { Channel } from '@/lib/m3u-parser';
import { PlaylistSetup } from '@/components/player/PlaylistSetup';

export default function Movies() {
  useSpatialNavigation();
  const { t } = useLanguage();
  const playlist = usePlaylist();
  const [activeMovie, setActiveMovie] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'group'>('name');
  const [showFilters, setShowFilters] = useState(false);

  const movies = useMemo(() => {
    return playlist.channels.filter(ch => ch.type === 'movie');
  }, [playlist.channels]);

  const movieCategories = useMemo(() => {
    const cats = new Set<string>();
    movies.forEach(m => { if (m.group) cats.add(m.group); });
    return Array.from(cats).sort();
  }, [movies]);

  const filtered = useMemo(() => {
    let list = movies;
    if (selectedCategory) list = list.filter(m => m.group === selectedCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.group?.toLowerCase().includes(q));
    }
    if (sortBy === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else list = [...list].sort((a, b) => (a.group || '').localeCompare(b.group || ''));
    return list;
  }, [movies, selectedCategory, searchQuery, sortBy]);

  if (playlist.channels.length === 0) {
    return <PlaylistSetup onSubmit={playlist.loadPlaylist} loading={playlist.loading} error={playlist.error} />;
  }

  if (activeMovie) {
    return (
      <div className="min-h-screen bg-background">
        <VideoPlayer url={activeMovie.url} title={activeMovie.name} channelId={activeMovie.tvgId || activeMovie.id} onBack={() => setActiveMovie(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Film className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">{t('moviesTitle')}</h1>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{filtered.length}</span>
        <div className="flex-1" />
        <LanguageSwitcher />
        <NotificationBell />
      </header>

      {/* Search & Filters */}
      <div className="px-4 py-3 border-b border-border bg-card/50 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder={t('moviesSearchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable" data-focusable="true" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
          </div>
          <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="p-2.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground tv-focusable" data-focusable="true">
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className="p-2.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground tv-focusable" data-focusable="true">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2">
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-1.5 rounded-lg bg-muted border border-border text-foreground text-sm tv-focusable" data-focusable="true">
              <option value="name">{t('sortByName')}</option>
              <option value="group">{t('sortByCategory')}</option>
            </select>
          </div>
        )}

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setSelectedCategory(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap tv-focusable transition-colors ${!selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`} data-focusable="true">
            {t('allCategories')}
          </button>
          {movieCategories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap tv-focusable transition-colors ${selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`} data-focusable="true">
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Film className="w-12 h-12 mb-3 opacity-50" />
            <p>{t('moviesEmpty')}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map(movie => (
              <button key={movie.id} onClick={() => setActiveMovie(movie)} className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all tv-focusable" data-focusable="true">
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
            {filtered.map(movie => (
              <button key={movie.id} onClick={() => setActiveMovie(movie)} className="w-full flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-all tv-focusable" data-focusable="true">
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
  );
}
