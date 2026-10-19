import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CultBibleEntry,
  CultEntry,
  CultHymnEntry,
  generateCultEntryId,
} from '../types/cultMode';

const CULT_PLAYLIST_KEY = 'cult_playlist_v1';
const CULT_MODE_ACTIVE_KEY = 'cult_mode_active_v1';

type StoredPlaylist = {entries: CultEntry[]};
type StoredActive = {isActive: boolean};

type CultEntryInput =
  | Omit<CultBibleEntry, 'id'>
  | Omit<CultHymnEntry, 'id'>;

type CultModeContextValue = {
  // Playlist
  entries: CultEntry[];
  // Returns the id of the newly created entry so callers can highlight it.
  addEntry: (entry: CultEntryInput) => string;
  removeEntry: (id: string) => void;
  reorderEntries: (fromIndex: number, toIndex: number) => void;
  // Tutorial isolation: run the walkthrough on an empty in-memory slate so the
  // playlist step shows only the demo entries the user adds — without ever
  // persisting them over the real saved playlist. endTutorial restores it.
  beginTutorial: () => void;
  endTutorial: () => void;
  // Active session
  isActive: boolean;
  toggleActive: (next?: boolean) => void;
  currentIndex: number;
  currentEntry: CultEntry | null;
  goNext: () => void;
  goPrev: () => void;
  goTo: (index: number) => void;
  isFirst: boolean;
  isLast: boolean;
  isLoading: boolean;
};

const CultModeContext = createContext<CultModeContextValue | undefined>(
  undefined,
);

export const CultModeProvider = ({children}: {children: ReactNode}) => {
  const [entries, setEntries] = useState<CultEntry[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // While the tutorial runs we work on a throwaway in-memory playlist: persists
  // are suppressed and the real one is stashed here, restored by endTutorial.
  const tutorialSnapshot = useRef<{entries: CultEntry[]; isActive: boolean} | null>(
    null,
  );
  const inTutorial = () => tutorialSnapshot.current !== null;

  // Hydrate both stores in parallel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [playlistRaw, activeRaw] = await Promise.all([
          AsyncStorage.getItem(CULT_PLAYLIST_KEY),
          AsyncStorage.getItem(CULT_MODE_ACTIVE_KEY),
        ]);
        if (cancelled) return;
        if (playlistRaw) {
          const parsed = JSON.parse(playlistRaw) as Partial<StoredPlaylist>;
          if (Array.isArray(parsed.entries)) setEntries(parsed.entries);
        }
        if (activeRaw) {
          const parsed = JSON.parse(activeRaw) as Partial<StoredActive>;
          if (parsed.isActive === true) {
            setIsActive(true);
            setCurrentIndex(0);
          }
        }
      } catch (err) {
        console.error('Error loading cult mode state:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Clamp current index if entries shrink.
  useEffect(() => {
    if (entries.length === 0) {
      if (currentIndex !== 0) setCurrentIndex(0);
      return;
    }
    if (currentIndex >= entries.length) {
      setCurrentIndex(entries.length - 1);
    }
  }, [entries.length, currentIndex]);

  const persistPlaylist = (next: CultEntry[]) => {
    if (inTutorial()) return; // tutorial slate never overwrites the real playlist
    AsyncStorage.setItem(
      CULT_PLAYLIST_KEY,
      JSON.stringify({entries: next} satisfies StoredPlaylist),
    ).catch(err => console.error('Error saving cult playlist:', err));
  };

  const persistActive = (active: boolean) => {
    if (inTutorial()) return; // tutorial slate never overwrites the real state
    AsyncStorage.setItem(
      CULT_MODE_ACTIVE_KEY,
      JSON.stringify({isActive: active} satisfies StoredActive),
    ).catch(err => console.error('Error saving cult mode active flag:', err));
  };

  const addEntry = useCallback((entry: CultEntryInput) => {
    const id = generateCultEntryId();
    setEntries(prev => {
      const withId = {...entry, id} as CultEntry;
      const next = [...prev, withId];
      persistPlaylist(next);
      return next;
    });
    return id;
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      persistPlaylist(next);
      return next;
    });
  }, []);

  const reorderEntries = useCallback(
    (fromIndex: number, toIndex: number) => {
      setEntries(prev => {
        if (
          fromIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex < 0 ||
          toIndex >= prev.length
        ) {
          return prev;
        }
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        persistPlaylist(next);
        return next;
      });
    },
    [],
  );

  const beginTutorial = useCallback(() => {
    if (tutorialSnapshot.current) return; // already isolated
    tutorialSnapshot.current = {entries, isActive};
    setEntries([]);
    setIsActive(false);
    setCurrentIndex(0);
  }, [entries, isActive]);

  const endTutorial = useCallback(() => {
    const snap = tutorialSnapshot.current;
    tutorialSnapshot.current = null; // clear FIRST so restored state persists
    setEntries(snap?.entries ?? []);
    setIsActive(snap?.isActive ?? false);
    setCurrentIndex(0);
  }, []);

  const toggleActive = useCallback(
    (next?: boolean) => {
      const target = typeof next === 'boolean' ? next : !isActive;
      if (target && entries.length === 0) return;
      setIsActive(target);
      if (target) setCurrentIndex(0);
      persistActive(target);
    },
    [isActive, entries.length],
  );

  const goNext = useCallback(() => {
    setCurrentIndex(prev => {
      if (entries.length === 0) return 0;
      return Math.min(prev + 1, entries.length - 1);
    });
  }, [entries.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, entries.length - 1)));
    },
    [entries.length],
  );

  const currentEntry: CultEntry | null = useMemo(() => {
    if (!isActive || entries.length === 0) return null;
    const idx = Math.max(0, Math.min(currentIndex, entries.length - 1));
    return entries[idx] ?? null;
  }, [isActive, entries, currentIndex]);

  const isFirst = currentIndex <= 0;
  const isLast = entries.length === 0 || currentIndex >= entries.length - 1;

  const value: CultModeContextValue = useMemo(
    () => ({
      entries,
      addEntry,
      removeEntry,
      reorderEntries,
      beginTutorial,
      endTutorial,
      isActive,
      toggleActive,
      currentIndex,
      currentEntry,
      goNext,
      goPrev,
      goTo,
      isFirst,
      isLast,
      isLoading,
    }),
    [
      entries,
      addEntry,
      removeEntry,
      reorderEntries,
      beginTutorial,
      endTutorial,
      isActive,
      toggleActive,
      currentIndex,
      currentEntry,
      goNext,
      goPrev,
      goTo,
      isFirst,
      isLast,
      isLoading,
    ],
  );

  return (
    <CultModeContext.Provider value={value}>
      {children}
    </CultModeContext.Provider>
  );
};

export const useCultMode = (): CultModeContextValue => {
  const ctx = useContext(CultModeContext);
  if (!ctx) {
    throw new Error('useCultMode must be used within CultModeProvider');
  }
  return ctx;
};
