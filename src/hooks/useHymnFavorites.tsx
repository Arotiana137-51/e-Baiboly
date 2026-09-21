import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Hymn } from '../hooks/useHymnsData';

export interface FavoriteHymn extends Hymn {
  addedAt: string;
}

const FAVORITES_KEY = 'favorites_hymns';

type HymnFavoritesContextValue = {
  favorites: FavoriteHymn[];
  isLoading: boolean;
  addToFavorites: (hymn: Hymn) => Promise<void>;
  removeFromFavorites: (hymn: Hymn) => Promise<void>;
  isFavorite: (hymn: Hymn) => boolean;
  clearFavorites: () => Promise<void>;
  loadFavorites: () => Promise<void>;
};

// See useFavorites.tsx for why this is a shared singleton rather than a
// plain hook: MainScreen and FavoritesScreen stay mounted simultaneously.
const HymnFavoritesContext = createContext<HymnFavoritesContextValue | null>(null);

export const HymnFavoritesProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [favorites, setFavorites] = useState<FavoriteHymn[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites from storage
  const loadFavorites = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      if (stored) {
        const parsedFavorites = JSON.parse(stored);
        setFavorites(parsedFavorites);
      }
    } catch (error) {
      console.error('Error loading hymn favorites:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add a hymn to favorites
  const addToFavorites = useCallback(async (hymn: Hymn) => {
    try {
      const favoriteHymn: FavoriteHymn = {
        ...hymn,
        addedAt: new Date().toISOString(),
      };

      setFavorites(prev => {
        // Check if hymn is already in favorites
        const exists = prev.some(fav => fav.id === hymn.id);

        if (exists) {
          return prev; // Don't add if already exists
        }

        const updated = [...prev, favoriteHymn];
        // Save to storage
        AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Error adding hymn to favorites:', error);
    }
  }, []);

  // Remove a hymn from favorites
  const removeFromFavorites = useCallback(async (hymn: Hymn) => {
    try {
      setFavorites(prev => {
        const updated = prev.filter(fav => fav.id !== hymn.id);
        // Save to storage
        AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Error removing hymn from favorites:', error);
    }
  }, []);

  // Check if a hymn is in favorites
  const isFavorite = useCallback((hymn: Hymn) => {
    return favorites.some(fav => fav.id === hymn.id);
  }, [favorites]);

  // Clear all favorites
  const clearFavorites = useCallback(async () => {
    try {
      setFavorites([]);
      await AsyncStorage.removeItem(FAVORITES_KEY);
    } catch (error) {
      console.error('Error clearing hymn favorites:', error);
    }
  }, []);

  // Load favorites on mount
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const value = useMemo(
    () => ({
      favorites,
      isLoading,
      addToFavorites,
      removeFromFavorites,
      isFavorite,
      clearFavorites,
      loadFavorites,
    }),
    [favorites, isLoading, addToFavorites, removeFromFavorites, isFavorite, clearFavorites, loadFavorites]
  );

  return <HymnFavoritesContext.Provider value={value}>{children}</HymnFavoritesContext.Provider>;
};

export const useHymnFavorites = () => {
  const ctx = useContext(HymnFavoritesContext);
  if (!ctx) {
    throw new Error('useHymnFavorites must be used within HymnFavoritesProvider');
  }
  return ctx;
};
