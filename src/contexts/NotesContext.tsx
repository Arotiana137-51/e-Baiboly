import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {bibleDatabaseService, hymnsDatabaseService} from '../services/database/DatabaseService';
import {useJesusName} from './JesusNameContext';
import {buildChapterDisplay, buildHymnDisplay, HYMN_CHORUS_LABEL} from '../utils/chapterMarks';
import {collectLegacyNotes, stripLegacyNoteMarks} from '../utils/legacyNotes';
import type {Note} from '../types/notes';
import type {BibleVerse} from '../hooks/useBibleData';
import type {HymnVerse} from '../hooks/useHymnsData';

const NOTES_KEY = 'notes_v1';
const MIGRATED_KEY = 'notes_migrated_v1';

type NotesContextValue = {
  notes: Note[];
  isLoading: boolean;
  // Insert or replace by id; also how an undone delete comes back.
  saveNote: (note: Note) => void;
  removeNote: (id: string) => void;
};

const NotesContext = createContext<NotesContextValue | null>(null);

const parseNotes = (raw: string | null): Note[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Note[]) : [];
  } catch {
    return [];
  }
};

// Old notes were positioned with whatever Jesoa/Jesosy setting was active, so
// the current one is the best guess for turning their offsets into verses.
const migrateLegacyNotes = async (
  stored: Note[],
  transformText: (text: string) => string,
): Promise<Note[]> => {
  await Promise.all([bibleDatabaseService.initDatabase(), hymnsDatabaseService.initDatabase()]);
  const legacy = await collectLegacyNotes({
    chapterSpans: async (bookId, chapter) => {
      const res = await bibleDatabaseService.executeQuery<BibleVerse>(
        'SELECT id, book_id, chapter, verse_number, text, title FROM Verses WHERE book_id = ? AND chapter = ? ORDER BY verse_number',
        [bookId, chapter],
      );
      return buildChapterDisplay(res.rows, transformText).verseSpans;
    },
    hymnSpans: async hymnId => {
      const res = await hymnsDatabaseService.executeQuery<HymnVerse>(
        'SELECT id, hymn_id, verse_number, text, is_chorus FROM HymnVerses WHERE hymn_id = ? ORDER BY verse_number',
        [hymnId],
      );
      return buildHymnDisplay(res.rows, HYMN_CHORUS_LABEL).verseSpans;
    },
  });
  const known = new Set(stored.map(n => n.id));
  const merged = [...stored, ...legacy.filter(n => !known.has(n.id))];
  // Notes first, then the cleanup: an interruption leaves the old marks in
  // place and the next launch finds the same ids instead of losing anything.
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(merged));
  await stripLegacyNoteMarks();
  await AsyncStorage.setItem(MIGRATED_KEY, '1');
  return merged;
};

// One shared instance at the app root, like FavoritesProvider: the reader and
// the notes list stay mounted together, and separate copies would overwrite
// each other's writes.
export const NotesProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {transformText, isReady: jesusNameReady} = useJesusName();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadStarted = useRef(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!jesusNameReady || loadStarted.current) return;
    loadStarted.current = true;
    (async () => {
      let stored: Note[];
      try {
        stored = parseNotes(await AsyncStorage.getItem(NOTES_KEY));
      } catch (error) {
        // Unreadable: stay unloaded so nothing gets written over the notes.
        console.error('Error loading notes:', error);
        setIsLoading(false);
        return;
      }
      try {
        if ((await AsyncStorage.getItem(MIGRATED_KEY)) !== '1') {
          stored = await migrateLegacyNotes(stored, transformText);
        }
      } catch (error) {
        // The old marks stay where they are and the next launch retries.
        console.error('Error migrating notes:', error);
      }
      loaded.current = true;
      setNotes(stored);
      setIsLoading(false);
    })();
  }, [jesusNameReady, transformText]);

  // Persist after every change, never before the first load finished (that
  // would overwrite the stored notes with the empty initial list).
  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes)).catch(error =>
      console.error('Error saving notes:', error),
    );
  }, [notes]);

  const saveNote = useCallback((note: Note) => {
    setNotes(prev =>
      prev.some(n => n.id === note.id)
        ? prev.map(n => (n.id === note.id ? note : n))
        : [...prev, note],
    );
  }, []);

  const removeNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const value = useMemo(
    () => ({notes, isLoading, saveNote, removeNote}),
    [notes, isLoading, saveNote, removeNote],
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
};

export const useNotes = (): NotesContextValue => {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used within NotesProvider');
  return ctx;
};
