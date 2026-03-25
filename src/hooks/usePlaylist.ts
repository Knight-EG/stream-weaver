import { useState, useCallback } from 'react';
import { type Channel, type ParsedPlaylist, fetchAndParseM3U } from '@/lib/m3u-parser';
import { type XtreamCredentials, fetchXtreamPlaylist } from '@/lib/xtream';

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
  });

  const loadPlaylist = useCallback(async (source: PlaylistSource) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      let result: ParsedPlaylist;
      if (source.type === 'm3u') {
        result = await fetchAndParseM3U(source.url);
      } else {
        result = await fetchXtreamPlaylist(source.credentials);
      }
      setState(s => ({
        ...s,
        channels: result.channels,
        categories: result.categories,
        loading: false,
        selectedCategory: null,
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

  const filteredChannels = state.channels.filter(ch => {
    if (state.selectedCategory === '__favorites__') return state.favorites.has(ch.id);
    if (state.selectedCategory && ch.group !== state.selectedCategory) return false;
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      return ch.name.toLowerCase().includes(q) || ch.group?.toLowerCase().includes(q);
    }
    return true;
  });

  return {
    ...state,
    filteredChannels,
    loadPlaylist,
    setCategory,
    setSearch,
    toggleFavorite,
  };
}
