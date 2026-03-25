import { useState, useCallback, useMemo, useEffect } from 'react';
import { type Channel, type ParsedPlaylist } from '@/lib/m3u-parser';
import { type XtreamCredentials } from '@/lib/xtream';
import { getCachedPlaylist, setCachedPlaylist, buildCategoryIndex } from '@/lib/playlist-cache';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export type PlaylistSource =
  | { type: 'm3u'; url: string }
  | { type: 'xtream'; credentials: XtreamCredentials }
  | { type: 'file'; content: string };

interface PlaylistState {
  channels: Channel[];
  categories: string[];
  loading: boolean;
  error: string | null;
  selectedCategory: string | null;
  searchQuery: string;
  favorites: Set<string>;
  categoryIndex: Map<string, number[]>;
}

const FAVORITES_KEY = 'iptv_favorites';

function loadLocalFavorites(): Set<string> {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
}

export function usePlaylist() {
  const [state, setState] = useState<PlaylistState>({
    channels: [],
    categories: [],
    loading: false,
    error: null,
    selectedCategory: null,
    searchQuery: '',
    favorites: loadLocalFavorites(),
    categoryIndex: new Map(),
  });

  // Auto-load is now handled by PlaylistManager

  // Load favorites from DB on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('favorites')
        .select('channel_id')
        .eq('user_id', user.id);
      if (data && data.length > 0) {
        const dbFavs = new Set(data.map((f: any) => f.channel_id));
        setState(s => ({ ...s, favorites: dbFavs }));
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...dbFavs]));
      }
    })();
  }, []);

  const loadPlaylist = useCallback(async (source: PlaylistSource) => {
    setState(s => ({ ...s, loading: true, error: null, channels: [], categories: [], categoryIndex: new Map(), selectedCategory: null }));
    try {
      const cacheKey = source.type === 'm3u' ? source.url : source.type === 'xtream' ? `${source.credentials.server}:${source.credentials.username}` : `file-${Date.now()}`;
      
      const cached = getCachedPlaylist(cacheKey);
      if (cached) {
        const categoryIndex = buildCategoryIndex(cached.channels);
        setState(s => ({
          ...s,
          channels: cached.channels,
          categories: cached.categories,
          loading: false,
          selectedCategory: null,
          categoryIndex,
        }));
        return;
      }

      let result: ParsedPlaylist;

      if (source.type === 'file') {
        const { parseM3U } = await import('@/lib/m3u-parser');
        result = parseM3U(source.content);
      } else if (source.type === 'xtream') {
        try {
          const { fetchXtreamPlaylist } = await import('@/lib/xtream');
          result = await fetchXtreamPlaylist(source.credentials);
        } catch (clientErr) {
          console.warn('Client-side Xtream failed, trying edge function:', clientErr);
          try {
            const { data, error } = await supabase.functions.invoke('parse-playlist', {
              body: { type: 'xtream', server: source.credentials.server, username: source.credentials.username, password: source.credentials.password },
            });
            if (error) throw error;
            if (data?.ok === false) throw new Error(data.error || 'Provider error');
            result = data as ParsedPlaylist;
          } catch (serverErr) {
            const clientMessage = clientErr instanceof Error ? clientErr.message : String(clientErr);
            const serverMessage = serverErr instanceof Error ? serverErr.message : String(serverErr);
            const isHttpOnlyOnHttps = clientMessage.includes('HTTP فقط') || clientMessage.includes('HTTPS');
            const serverBlocked = serverMessage.includes('403') || serverMessage.includes('PROVIDER_BLOCKED') || serverMessage.toLowerCase().includes('blocked');

            if (isHttpOnlyOnHttps && serverBlocked) {
              throw new Error('المزود ده شغال HTTP فقط، وده بيتمنع من المتصفح لأن التطبيق على HTTPS، وفي نفس الوقت السيرفر الخلفي محجوب من المزود (403). الحل: رابط HTTPS من المزود أو ملف M3U للرفع المباشر.');
            }

            throw new Error(serverMessage || clientMessage || 'تعذر الاتصال بمزود الخدمة.');
          }
        }
      } else {
        try {
          const { data, error } = await supabase.functions.invoke('parse-playlist', {
            body: { type: 'm3u', url: source.url },
          });
          if (error) throw error;
          if (data?.ok === false) throw new Error(data.error || 'Failed');
          result = data as ParsedPlaylist;
        } catch (serverErr) {
          console.warn('Server M3U failed, trying client:', serverErr);
          const { fetchAndParseM3U } = await import('@/lib/m3u-parser');
          result = await fetchAndParseM3U(source.url);
        }
      }

      setCachedPlaylist(cacheKey, result);

      const categoryIndex = buildCategoryIndex(result.channels);
      setState(s => ({
        ...s,
        channels: result.channels,
        categories: result.categories,
        loading: false,
        selectedCategory: null,
        categoryIndex,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load playlist';
      setState(s => ({
        ...s,
        loading: false,
        error: message,
      }));
      toast.error('فشل تحميل قائمة التشغيل', {
        description: message,
        duration: 9000,
      });
    }
  }, []);

  const setCategory = useCallback((cat: string | null) => {
    setState(s => ({ ...s, selectedCategory: cat }));
  }, []);

  const setSearch = useCallback((q: string) => {
    setState(s => ({ ...s, searchQuery: q }));
  }, []);

  const toggleFavorite = useCallback((channelId: string, channelName?: string) => {
    setState(s => {
      const newFavs = new Set(s.favorites);
      const adding = !newFavs.has(channelId);
      if (adding) newFavs.add(channelId);
      else newFavs.delete(channelId);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...newFavs]));

      // Persist to DB async
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        if (adding) {
          await supabase.from('favorites').upsert({
            user_id: user.id,
            channel_id: channelId,
            channel_name: channelName || '',
          } as any, { onConflict: 'user_id,channel_id' });
        } else {
          await supabase.from('favorites').delete()
            .eq('user_id', user.id)
            .eq('channel_id', channelId);
        }
      })();

      return { ...s, favorites: newFavs };
    });
  }, []);

  const filteredChannels = useMemo(() => {
    let channels = state.channels;

    if (state.selectedCategory === '__favorites__') {
      channels = channels.filter(ch => state.favorites.has(ch.id));
    } else if (state.selectedCategory && state.categoryIndex.has(state.selectedCategory)) {
      const indices = state.categoryIndex.get(state.selectedCategory)!;
      channels = indices.map(i => state.channels[i]);
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      channels = channels.filter(ch =>
        ch.name.toLowerCase().includes(q) || ch.group?.toLowerCase().includes(q)
      );
    }

    return channels;
  }, [state.channels, state.selectedCategory, state.searchQuery, state.favorites, state.categoryIndex]);

  return {
    ...state,
    filteredChannels,
    loadPlaylist,
    setCategory,
    setSearch,
    toggleFavorite,
  };
}
