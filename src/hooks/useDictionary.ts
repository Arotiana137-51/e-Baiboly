import {useEffect, useMemo, useState} from 'react';
import {bibleDatabaseService} from '../services/database/DatabaseService';
import {extractBracketFootnotes} from '../utils/bibleTextUtils';
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
