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
// index: where the session is, or where ▶ resumes it (absent before resume).
type StoredActive = {isActive: boolean; index?: number};

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
  // Bumped by goTo, so a tap on the entry already playing still brings the
  // reader back to it.
  revealTick: number;
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
  const [revealTick, setRevealTick] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // While the tutorial runs we work on a throwaway in-memory playlist: persists
  // are suppressed and the real one is stashed here, restored by endTutorial.
  const tutorialSnapshot = useRef<{
    entries: CultEntry[];
    isActive: boolean;
    currentIndex: number;
  } | null>(null);
  const inTutorial = () => tutorialSnapshot.current !== null;
  // Read by the playlist edits, which are stable callbacks.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

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
          if (parsed.isActive === true) setIsActive(true);
          const index = parsed.index;
          if (typeof index === 'number' && Number.isInteger(index) && index >= 0) setCurrentIndex(index);
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

  // Stable (refs and setters only), so the playlist edits can list it.
  const persistPlaylist = useCallback((next: CultEntry[]) => {
    if (tutorialSnapshot.current) return; // tutorial slate never overwrites the real playlist
    AsyncStorage.setItem(
      CULT_PLAYLIST_KEY,
      JSON.stringify({entries: next} satisfies StoredPlaylist),
    ).catch(err => console.error('Error saving cult playlist:', err));
  }, []);

  // The session and its position survive a restart, so ▶ resumes there.
  useEffect(() => {
    if (isLoading || inTutorial()) return; // tutorial slate never overwrites the real state
    AsyncStorage.setItem(
      CULT_MODE_ACTIVE_KEY,
      JSON.stringify({isActive, index: currentIndex} satisfies StoredActive),
    ).catch(err => console.error('Error saving cult mode active flag:', err));
  }, [isActive, currentIndex, isLoading]);

  // An edit while stopped makes a new service: ▶ starts it from the top.
  const restartIfStopped = useCallback(() => {
    if (!isActiveRef.current) setCurrentIndex(0);
  }, []);

  const addEntry = useCallback((entry: CultEntryInput) => {
    const id = generateCultEntryId();
    setEntries(prev => {
      const withId = {...entry, id} as CultEntry;
      const next = [...prev, withId];
      persistPlaylist(next);
      return next;
    });
    restartIfStopped();
    return id;
  }, [persistPlaylist, restartIfStopped]);

  const removeEntry = useCallback((id: string) => {
    const at = entries.findIndex(e => e.id === id);
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      persistPlaylist(next);
      return next;
    });
    // During a session, an entry removed above the current one must not
    // shift the session onto the next entry.
    if (isActiveRef.current) setCurrentIndex(i => (at !== -1 && at < i ? i - 1 : i));
    else restartIfStopped();
  }, [entries, persistPlaylist, restartIfStopped]);

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
      restartIfStopped();
    },
    [persistPlaylist, restartIfStopped],
  );

  const beginTutorial = useCallback(() => {
    if (tutorialSnapshot.current) return; // already isolated
    tutorialSnapshot.current = {entries, isActive, currentIndex};
    setEntries([]);
    setIsActive(false);
    setCurrentIndex(0);
  }, [entries, isActive, currentIndex]);

  const endTutorial = useCallback(() => {
    const snap = tutorialSnapshot.current;
    tutorialSnapshot.current = null; // clear FIRST so restored state persists
    setEntries(snap?.entries ?? []);
    setIsActive(snap?.isActive ?? false);
    setCurrentIndex(snap?.currentIndex ?? 0);
  }, []);

  // ▶ resumes where ■ left the session, like pause; stopped on the last
  // entry, the service was over, so it starts again from the top.
  const toggleActive = useCallback(
    (next?: boolean) => {
      const target = typeof next === 'boolean' ? next : !isActive;
      if (target && entries.length === 0) return;
      setIsActive(target);
      if (target && currentIndex >= entries.length - 1) setCurrentIndex(0);
    },
    [isActive, entries.length, currentIndex],
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
      setRevealTick(tick => tick + 1);
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
      revealTick,
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
      revealTick,
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
