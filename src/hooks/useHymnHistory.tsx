import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Hymn } from '../hooks/useHymnsData';

export interface HymnHistoryItem {
  id: string;
  title: string;
  lastAccessed: number;
}

const HYMN_HISTORY_KEY = 'hymn_history';
const MAX_HISTORY_ITEMS = 50;

type HymnHistoryContextValue = {
  history: HymnHistoryItem[];
  isLoading: boolean;
  logAccess: (hymn: Hymn) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  loadHistory: () => Promise<void>;
};

// See useFavorites.tsx for why this is a shared singleton rather than a
// plain hook: MainScreen and HistoryScreen stay mounted simultaneously.
const HymnHistoryContext = createContext<HymnHistoryContextValue | null>(null);

export const HymnHistoryProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [history, setHistory] = useState<HymnHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load history from storage
  const loadHistory = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(HYMN_HISTORY_KEY);
      if (stored) {
        const parsedHistory = JSON.parse(stored);
        setHistory(parsedHistory);
      }
    } catch (error) {
      console.error('Error loading hymn history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Log access to a hymn
  const logAccess = useCallback(async (hymn: Hymn) => {
    try {
      const title = `${hymn.category ? `${hymn.category.toUpperCase()} ` : ''}Hymne ${hymn.number}`;
      const now = Date.now();

      setHistory(prev => {
        // Remove existing entry if present
        const filtered = prev.filter(item => item.id !== hymn.id);

        // Add new entry at the beginning
        const updated = [{ id: hymn.id, title, lastAccessed: now }, ...filtered];

        // Limit to MAX_HISTORY_ITEMS
        const limited = updated.slice(0, MAX_HISTORY_ITEMS);

        // Save to storage
        AsyncStorage.setItem(HYMN_HISTORY_KEY, JSON.stringify(limited));
        return limited;
      });
    } catch (error) {
      console.error('Error logging hymn access:', error);
    }
  }, []);

  // Remove a single entry by id
  const removeItem = useCallback(async (id: string) => {
    try {
      setHistory(prev => {
        const updated = prev.filter(item => item.id !== id);
        AsyncStorage.setItem(HYMN_HISTORY_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Error removing hymn history item:', error);
    }
  }, []);

  // Clear all history
  const clearHistory = useCallback(async () => {
    try {
      setHistory([]);
      await AsyncStorage.removeItem(HYMN_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing hymn history:', error);
    }
  }, []);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const value = useMemo(
    () => ({
      history,
      isLoading,
      logAccess,
      removeItem,
      clearHistory,
      loadHistory,
    }),
    [history, isLoading, logAccess, removeItem, clearHistory, loadHistory]
  );

  return <HymnHistoryContext.Provider value={value}>{children}</HymnHistoryContext.Provider>;
};

export const useHymnHistory = () => {
  const ctx = useContext(HymnHistoryContext);
  if (!ctx) {
    throw new Error('useHymnHistory must be used within HymnHistoryProvider');
  }
  return ctx;
};
