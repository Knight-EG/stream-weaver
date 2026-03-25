import { useState, useCallback, useMemo } from 'react';
import { useSpatialNavigation } from '@/hooks/useSpatialNavigation';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useAccessGuard } from '@/hooks/useAccessGuard';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Channel } from '@/lib/m3u-parser';
import { PlaylistSetup } from '@/components/player/PlaylistSetup';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { ChannelList } from '@/components/player/ChannelList';
import { CategorySidebar } from '@/components/player/CategorySidebar';
import { SearchBar } from '@/components/player/SearchBar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Menu, X, Settings, LogOut, User, Loader2, Clock, ShieldCheck, Infinity, CreditCard, Store, Film, Tv } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  useSpatialNavigation();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const { access, loading: accessLoading, refresh: refreshAccess } = useAccessGuard();

  const playlist = usePlaylist();
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSelectChannel = useCallback((ch: Channel) => { setActiveChannel(ch); }, []);

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

  if (playlist.channels.length === 0) return <PlaylistSetup onSubmit={playlist.loadPlaylist} loading={playlist.loading} error={playlist.error} />;

  return (
    <div className="min-h-screen flex flex-col">
      {access?.trialActive && (
        <div className="bg-warning/10 border-b border-warning/30 px-4 py-2 flex items-center justify-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-warning" />
          <span className="text-warning font-medium">Trial: {access.trialDaysLeft} {t('accessTrialRemaining')}</span>
        </div>
      )}

      <div className="flex-1 flex">
        <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden flex-shrink-0 bg-card border-e border-border`}>
          <div className="w-72 h-full flex flex-col p-3 gap-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-gradient">{t('appName')}</h1>
              <div className="flex gap-1">
                <LanguageSwitcher />
                <NotificationBell />
                <Link to="/settings" className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true" title={t('settings')}><User className="w-4 h-4" /></Link>
                <Link to="/reseller" className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true" title="Reseller"><Store className="w-4 h-4" /></Link>
                <Link to="/movies" className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true" title={t('moviesTitle')}><Film className="w-4 h-4" /></Link>
                <Link to="/series" className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true" title={t('seriesTitle')}><Tv className="w-4 h-4" /></Link>
                <Link to="/admin" className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true" title="Admin"><Settings className="w-4 h-4" /></Link>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded" data-focusable="true"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex items-center gap-2 px-1 py-1.5 text-xs text-muted-foreground border-b border-border pb-3">
              <span className="truncate">{user?.email}</span>
              {access?.subscription?.planType === 'lifetime' && <span className="ms-auto px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent/20 text-accent flex items-center gap-0.5"><Infinity className="w-2.5 h-2.5" /> Lifetime</span>}
              {access?.subscription && access.subscription.planType !== 'lifetime' && <span className="ms-auto px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-success/20 text-success">Active</span>}
              {access?.trialActive && !access?.subscription && <span className="ms-auto px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-warning/20 text-warning">Trial</span>}
              <button onClick={signOut} className="text-muted-foreground hover:text-destructive tv-focusable" data-focusable="true" title={t('signOut')}><LogOut className="w-3.5 h-3.5" /></button>
            </div>
            <SearchBar value={playlist.searchQuery} onChange={playlist.setSearch} />
            <CategorySidebar categories={playlist.categories} selected={playlist.selectedCategory} onSelect={playlist.setCategory} favoriteCount={playlist.favorites.size} />
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-h-0">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="fixed top-4 start-4 z-50 p-2 bg-card border border-border rounded-lg tv-focusable" data-focusable="true"><Menu className="w-5 h-5 text-foreground" /></button>
          )}
          <div className="flex-1 flex flex-col lg:flex-row">
            <div className="flex-1 p-4">
              {activeChannel ? (
                <VideoPlayer url={activeChannel.url} title={activeChannel.name} channelId={activeChannel.tvgId || activeChannel.id} onBack={() => setActiveChannel(null)} onNext={channelIndex < playlist.filteredChannels.length - 1 ? handleNext : undefined} onPrev={channelIndex > 0 ? handlePrev : undefined} />
              ) : (
                <div className="w-full aspect-video bg-player-bg rounded-lg flex flex-col items-center justify-center gap-3">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center"><Menu className="w-10 h-10 text-muted-foreground" /></div>
                  <p className="text-muted-foreground">{t('playerSelectChannel')}</p>
                </div>
              )}
            </div>
            <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-s border-border p-3 overflow-y-auto">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 px-1">{playlist.filteredChannels.length} {t('playerChannels')}</p>
              <ChannelList channels={playlist.filteredChannels} activeId={activeChannel?.id} favorites={playlist.favorites} onSelect={handleSelectChannel} onToggleFavorite={playlist.toggleFavorite} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
