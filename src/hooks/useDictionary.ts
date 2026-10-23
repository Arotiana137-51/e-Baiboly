import {useCallback, useEffect, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useFocusEffect} from '@react-navigation/native';
import {bibleDatabaseService} from '../services/database/DatabaseService';
import {extractBracketFootnotes} from '../utils/bibleTextUtils';
import {loadFontScale} from '../utils/readerFontScale';
import {
  buildEntryFinder,
  indexDictionaryWords,
  type DictionaryRef,
  type DictionaryWord,
  type IndexedWord,
} from '../utils/dictionary';

// The 3167 headwords are read once per app run and shared by the list and
// every entry (which needs them to resolve "Jereo X").
let wordsPromise: Promise<IndexedWord[]> | null = null;

const loadWords = () => {
  if (!wordsPromise) {
    wordsPromise = (async () => {
      await bibleDatabaseService.initDatabase();
      const {rows} = await bibleDatabaseService.executeQuery<DictionaryWord>(
        'SELECT id, word FROM Dictionary ORDER BY id',
      );
      return indexDictionaryWords(rows);
    })();
    // A failed read is tried again next time instead of being kept.
    wordsPromise.catch(() => {
      wordsPromise = null;
    });
  }
  return wordsPromise;
};

export const useDictionaryWords = () => {
  const [words, setWords] = useState<IndexedWord[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadWords().then(
      list => {
        if (!cancelled) setWords(list);
      },
      error => {
        console.error('Error loading dictionary:', error);
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const findEntry = useMemo(
    () => (words ? buildEntryFinder(words) : () => undefined),
    [words],
  );

  return {words, failed, findEntry};
};

export const useDictionaryEntry = (id: number) => {
  const [entry, setEntry] = useState<{word: string; text: string} | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await bibleDatabaseService.initDatabase();
        const {rows} = await bibleDatabaseService.executeQuery<{word: string; text: string}>(
          'SELECT word, text FROM Dictionary WHERE id = ?',
          [id],
        );
        if (cancelled) return;
        if (rows[0]) setEntry(rows[0]);
        else setFailed(true);
      } catch (error) {
        console.error('Error loading dictionary entry:', error);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return {entry, failed};
};

// The last verse of every chapter, read once, so the book's misprinted refs
// stay plain text instead of opening an empty passage.
let chapterSizesPromise: Promise<Map<string, number>> | null = null;

const loadChapterSizes = () => {
  if (!chapterSizesPromise) {
    chapterSizesPromise = (async () => {
      await bibleDatabaseService.initDatabase();
      const {rows} = await bibleDatabaseService.executeQuery<{book_id: number; chapter: number; last: number}>(
        'SELECT book_id, chapter, MAX(verse_number) AS last FROM Verses GROUP BY book_id, chapter',
      );
      return new Map(rows.map(r => [`${r.book_id}:${r.chapter}`, r.last]));
    })();
    chapterSizesPromise.catch(() => {
      chapterSizesPromise = null;
    });
  }
  return chapterSizesPromise;
};

export const useChapterSizes = () => {
  const [sizes, setSizes] = useState<Map<string, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadChapterSizes().then(
      map => {
        if (!cancelled) setSizes(map);
      },
      error => console.error('Error loading chapter sizes:', error),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return sizes;
};

// The last entries opened, newest first: what dictionary apps show before
// anything is typed, so a word looked up yesterday is one tap away.
const RECENT_KEY = 'dictionary.recent';
const RECENT_MAX = 8;

// Kept by full headword ("ABAGITA (Estera 1 : 10)", unique in the book), not
// by id: ids follow the book's order and shift when entries are added. A
// headword that is gone just drops out of the list.
export type RecentLookup = {word: string};

const readRecent = async (): Promise<RecentLookup[]> => {
  try {
    const list = JSON.parse((await AsyncStorage.getItem(RECENT_KEY)) ?? '[]');
    return Array.isArray(list) ? list.filter(r => typeof r?.word === 'string') : [];
  } catch {
    return [];
  }
};

export const addRecentLookup = async (word: string): Promise<void> => {
  const list = await readRecent();
  const next = [{word}, ...list.filter(r => r.word !== word)].slice(0, RECENT_MAX);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
};

// Re-read on focus, so coming back from an entry shows it at the top.
export const useRecentLookups = () => {
  const [recent, setRecent] = useState<RecentLookup[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      readRecent().then(list => {
        if (active) setRecent(list);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const clear = useCallback(() => {
    setRecent([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  }, []);

  return {recent, clear};
};

// The reader's A+ / A- size, re-read on focus in case it changed on Home.
export const useReaderFontScale = () => {
  const [scale, setScale] = useState(1);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadFontScale().then(value => {
        if (active) setScale(value);
      });
      return () => {
        active = false;
      };
    }, []),
  );
  return scale;
};

export type PassageVerse = {verse_number: number; text: string};

// The verses a dictionary ref cites, footnotes and their marks removed. Empty
// when the book cites a verse MG1865 doesn't have (about 1% of its refs are
// misprints such as "Nomery 37 : 12").
export const loadDictionaryPassage = async (ref: DictionaryRef): Promise<PassageVerse[]> => {
  await bibleDatabaseService.initDatabase();
  const {rows} = await bibleDatabaseService.executeQuery<PassageVerse>(
    'SELECT verse_number, text FROM Verses WHERE book_id = ? AND chapter = ? AND verse_number BETWEEN ? AND ? ORDER BY verse_number',
    [ref.bookId, ref.chapter, ref.verseStart, ref.verseEnd],
  );
  return rows.map(v => ({
    verse_number: v.verse_number,
    text: extractBracketFootnotes(v.text).textWithoutFootnotes.replace(/\*/g, ''),
  }));
};
