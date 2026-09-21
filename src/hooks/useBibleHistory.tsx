import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BibleVerse } from '../hooks/useBibleData';

export interface BibleHistoryItem {
  id: string;
  title: string;
  lastAccessed: number;
}

const BIBLE_HISTORY_KEY = 'bible_history';
const MAX_HISTORY_ITEMS = 50;

type BibleHistoryContextValue = {
  history: BibleHistoryItem[];
  isLoading: boolean;
  logAccess: (verse: BibleVerse, bookName: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  loadHistory: () => Promise<void>;
};

// See useFavorites.tsx for why this is a shared singleton rather than a
// plain hook: MainScreen and HistoryScreen stay mounted simultaneously.
const BibleHistoryContext = createContext<BibleHistoryContextValue | null>(null);

export const BibleHistoryProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [history, setHistory] = useState<BibleHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load history from storage
  const loadHistory = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(BIBLE_HISTORY_KEY);
      if (stored) {
        const parsedHistory = JSON.parse(stored);
        setHistory(parsedHistory);
      }
    } catch (error) {
      console.error('Error loading Bible history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Log access to a Bible verse
  const logAccess = useCallback(async (verse: BibleVerse, bookName: string) => {
    try {
      const historyId = `${verse.book_id}-${verse.chapter}-${verse.verse_number}`;
      const title = `${bookName} ${verse.chapter}:${verse.verse_number}`;
      const now = Date.now();

      setHistory(prev => {
        // Remove existing entry if present
        const filtered = prev.filter(item => item.id !== historyId);

        // Add new entry at the beginning
        const updated = [{ id: historyId, title, lastAccessed: now }, ...filtered];

        // Limit to MAX_HISTORY_ITEMS
        const limited = updated.slice(0, MAX_HISTORY_ITEMS);

        // Save to storage
        AsyncStorage.setItem(BIBLE_HISTORY_KEY, JSON.stringify(limited));
        return limited;
      });
    } catch (error) {
      console.error('Error logging Bible access:', error);
    }
  }, []);

  // Remove a single entry by id
  const removeItem = useCallback(async (id: string) => {
    try {
      setHistory(prev => {
        const updated = prev.filter(item => item.id !== id);
        AsyncStorage.setItem(BIBLE_HISTORY_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Error removing Bible history item:', error);
    }
  }, []);

  // Clear all history
  const clearHistory = useCallback(async () => {
    try {
      setHistory([]);
      await AsyncStorage.removeItem(BIBLE_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing Bible history:', error);
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

  return <BibleHistoryContext.Provider value={value}>{children}</BibleHistoryContext.Provider>;
};

export const useBibleHistory = () => {
  const ctx = useContext(BibleHistoryContext);
  if (!ctx) {
    throw new Error('useBibleHistory must be used within BibleHistoryProvider');
  }
  return ctx;
};
