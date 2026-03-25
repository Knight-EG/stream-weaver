import { useState, useCallback, useMemo, useEffect } from 'react';
import { type Channel, type ParsedPlaylist } from '@/lib/m3u-parser';
import { type XtreamCredentials } from '@/lib/xtream';
import { getCachedPlaylist, setCachedPlaylist, buildCategoryIndex } from '@/lib/playlist-cache';
import { supabase } from '@/integrations/supabase/client';

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
const SAVED_SOURCE_KEY = 'iptv_saved_source';

function saveSource(source: PlaylistSource) {
  try {
    if (source.type === 'file') return; // Don't save file content (too large)
    localStorage.setItem(SAVED_SOURCE_KEY, JSON.stringify(source));
  } catch {}
}

function loadSavedSource(): PlaylistSource | null {
  try {
    const stored = localStorage.getItem(SAVED_SOURCE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

export function clearSavedSource() {
  localStorage.removeItem(SAVED_SOURCE_KEY);
}

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

  // Auto-load saved playlist source on mount
  useEffect(() => {
    const saved = loadSavedSource();
    if (saved && state.channels.length === 0) {
      loadPlaylist(saved);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    setState(s => ({ ...s, loading: true, error: null }));
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

      // File upload: parse directly on client
      if (source.type === 'file') {
        const { parseM3U } = await import('@/lib/m3u-parser');
        result = parseM3U(source.content);
      } else {
      try {
        const body = source.type === 'm3u'
          ? { type: 'm3u', url: source.url }
          : { type: 'xtream', server: source.credentials.server, username: source.credentials.username, password: source.credentials.password };

        const { data, error } = await supabase.functions.invoke('parse-playlist', { body });
        if (error) throw error;

        if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
          // For Xtream provider-blocked: auto-convert to M3U URL and try client-side
          if (source.type === 'xtream' && data.code === 'PROVIDER_BLOCKED') {
            const creds = source.credentials;
            let base = creds.server.replace(/\/$/, '');
            if (!/^https?:\/\//i.test(base)) base = 'http://' + base;
            const m3uUrl = `${base}/get.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&type=m3u_plus&output=ts`;
            
            try {
              const { fetchAndParseM3U } = await import('@/lib/m3u-parser');
              result = await fetchAndParseM3U(m3uUrl);
            } catch (clientErr) {
              throw new Error(typeof data.error === 'string' ? data.error + '\n\nTip: Try downloading the M3U file from your provider and uploading it directly.' : 'Provider blocked');
            }
          } else {
            throw new Error(typeof data.error === 'string' ? data.error : 'Playlist provider request failed');
          }
        }

        if (!result!) {
          result = data as ParsedPlaylist;
        }
      } catch (serverErr) {
        console.warn('Server-side parsing failed, falling back to client:', serverErr);

        const serverMessage = serverErr instanceof Error ? serverErr.message : String(serverErr);
        const shouldNotFallbackToClient = source.type === 'xtream' && (
          serverMessage.includes('provider blocked both API and M3U') ||
          serverMessage.includes('Tip: Try downloading')
        );

        if (shouldNotFallbackToClient) {
          throw new Error(serverMessage);
        }

        const { fetchAndParseM3U } = await import('@/lib/m3u-parser');
        const { fetchXtreamPlaylist } = await import('@/lib/xtream');
        
        if (source.type === 'm3u') {
          result = await fetchAndParseM3U(source.url);
        } else {
          result = await fetchXtreamPlaylist(source.credentials);
        }
      }
      }

      setCachedPlaylist(cacheKey, result);
      // Save the source so user doesn't have to re-enter it
      saveSource(source);

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
      setState(s => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load playlist',
      }));
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
