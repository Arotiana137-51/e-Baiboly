import {useCallback, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {chapterMarksKey, hymnMarksKey, type ChapterMark} from '../utils/chapterMarks';

const isMark = (m: any): m is ChapterMark =>
  m &&
  typeof m.id === 'string' &&
  typeof m.start === 'number' &&
  typeof m.end === 'number' &&
  typeof m.style === 'string' &&
  m.end > m.start &&
  (m.note === undefined || typeof m.note === 'string');

// Notes now live in NotesContext. Old 'note' marks still in this storage are
// hidden here and kept on every write, so only the one-shot migration
// (utils/legacyNotes.ts) ever removes them.
const isLegacyNoteMark = (m: any): boolean => !!m && m.style === 'note';

// Marks for one Bible chapter or one hymn, keyed by storage key. The two
// exported hooks below only differ in how they derive that key.
const useMarksForKey = (key: string | null) => {
  const [marks, setMarks] = useState<ChapterMark[]>([]);

  useEffect(() => {
    if (key == null) {
      setMarks([]);
      return;
    }
    // A load for a chapter already left never lands on the next one.
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        const validMarks = Array.isArray(parsed)
          ? parsed.filter(m => isMark(m) && !isLegacyNoteMark(m))
          : [];
        if (!cancelled) setMarks(validMarks);
      } catch (error) {
        console.error('Error loading chapter marks:', error);
        if (!cancelled) setMarks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  const persist = useCallback(
    async (next: ChapterMark[]) => {
      if (key == null) return;
      try {
        const raw = await AsyncStorage.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        const legacyNotes = Array.isArray(parsed) ? parsed.filter(isLegacyNoteMark) : [];
        const toStore = [...next.filter(m => !isLegacyNoteMark(m)), ...legacyNotes];
        if (toStore.length === 0) {
          await AsyncStorage.removeItem(key);
        } else {
          await AsyncStorage.setItem(key, JSON.stringify(toStore));
        }
      } catch (error) {
        console.error('Error saving chapter marks:', error);
      }
    },
    [key],
  );

  const setAllMarks = useCallback(
    async (next: ChapterMark[]) => {
      setMarks(next);
      await persist(next);
    },
    [persist],
  );

  return {marks, setAllMarks};
};

export const useChapterMarks = (bookId: number | null, chapter: number | null) =>
  useMarksForKey(bookId == null || chapter == null ? null : chapterMarksKey(bookId, chapter));

export const useHymnMarks = (hymnId: string | null) =>
  useMarksForKey(hymnId ? hymnMarksKey(hymnId) : null);
