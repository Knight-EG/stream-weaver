import { useState, useCallback, useMemo } from 'react';
import { type Channel, type ParsedPlaylist, fetchAndParseM3U } from '@/lib/m3u-parser';
import { type XtreamCredentials, fetchXtreamPlaylist } from '@/lib/xtream';
import { getCachedPlaylist, setCachedPlaylist, buildCategoryIndex } from '@/lib/playlist-cache';

export type PlaylistSource =
  | { type: 'm3u'; url: string }
  | { type: 'xtream'; credentials: XtreamCredentials };

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

function loadFavorites(): Set<string> {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
}

export function usePlaylist() {
  const [state, setState] = useState<PlaylistState>({
    channels: [],
    categories: [],
    loading: false,
    error: null,
    selectedCategory: null,
    searchQuery: '',
    favorites: loadFavorites(),
    categoryIndex: new Map(),
  });

  const loadPlaylist = useCallback(async (source: PlaylistSource) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      // Check cache first
      const cacheKey = source.type === 'm3u' ? source.url : `${source.credentials.server}:${source.credentials.username}`;
      const cached = getCachedPlaylist(cacheKey);

      let result: ParsedPlaylist;
      if (cached) {
        result = cached;
      } else {
        if (source.type === 'm3u') {
          result = await fetchAndParseM3U(source.url);
        } else {
          result = await fetchXtreamPlaylist(source.credentials);
        }
        // Cache the result
        setCachedPlaylist(cacheKey, result);
      }

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

  const toggleFavorite = useCallback((channelId: string) => {
    setState(s => {
      const newFavs = new Set(s.favorites);
      if (newFavs.has(channelId)) newFavs.delete(channelId);
      else newFavs.add(channelId);
      saveFavorites(newFavs);
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
