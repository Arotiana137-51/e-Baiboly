// src/hooks/useBibleData.ts
import {useCallback, useEffect, useState} from 'react';
import { bibleDatabaseService } from '../services/database/DatabaseService';

export interface BibleBook {
  id: number;
  name: string;
  testament: 'old' | 'new';
  chapters: number;
  filename: string;
}

export interface BibleVerse {
  id: number;
  book_id: number;
  chapter: number;
  verse_number: number;
  text: string;
  title?: string | null;
}

export interface BibleCrossReference {
  votes: number;
  to_book: number;
  to_chapter: number;
  to_verse_start: number;
  to_verse_end: number;
  to_book_id: number;
  to_book_name: string;
}

export const useBibleData = () => {
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all Bible books
  const loadBooks = useCallback(async () => {
    try {
      setIsLoading(true);
      await bibleDatabaseService.initDatabase();
      const { rows } = await bibleDatabaseService.executeQuery<BibleBook>(
        'SELECT id, name, testament, chapters, filename FROM Books ORDER BY id'
      );
      
      const booksList: BibleBook[] = rows.map(b => ({
        ...b,
        testament: b.id <= 39 ? 'old' : 'new',
      }));
      
      setBooks(booksList);
      return booksList;
    } catch (error) {
      console.error('Error loading books:', error);
      setError('Failed to load Bible books');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load verses for a specific book and chapter
  const loadVerses = useCallback(async (bookId: number, chapter: number) => {
    try {
      setIsLoading(true);
      await bibleDatabaseService.initDatabase();
      const { rows } = await bibleDatabaseService.executeQuery<BibleVerse>(
        'SELECT id, book_id, chapter, verse_number, text, title FROM Verses WHERE book_id = ? AND chapter = ? ORDER BY verse_number',
        [bookId, chapter]
      );
      
      const versesList: BibleVerse[] = rows;
      
      setVerses(versesList);
      return versesList;
    } catch (error) {
      console.error('Error loading verses:', error);
      setError('Failed to load verses');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getVerseCount = useCallback(async (bookId: number, chapter: number) => {
    try {
      await bibleDatabaseService.initDatabase();
      const { rows } = await bibleDatabaseService.executeQuery<{ count: number | null }>(
        'SELECT MAX(verse_number) as count FROM Verses WHERE book_id = ? AND chapter = ?',
        [bookId, chapter]
      );

      const count = rows[0]?.count ?? 0;
      return typeof count === 'number' ? count : 0;
    } catch (error) {
      console.error('Error getting verse count:', error);
      return 0;
    }
  }, []);

  // Get a specific verse
  const getVerse = useCallback(
    async (bookId: number, chapter: number, verseNumber: number) => {
    try {
      await bibleDatabaseService.initDatabase();
      const { rows } = await bibleDatabaseService.executeQuery<BibleVerse>(
        'SELECT id, book_id, chapter, verse_number, text, title FROM Verses WHERE book_id = ? AND chapter = ? AND verse_number = ?',
        [bookId, chapter, verseNumber]
      );
      
      if (rows.length > 0) {
        return rows[0];
      }
      return null;
    } catch (error) {
      console.error('Error getting verse:', error);
      return null;
    }
    },
    []
  );

  // Search for verses containing a specific text
  const searchVerses = useCallback(async (query: string) => {
    try {
      await bibleDatabaseService.initDatabase();
      const { rows } = await bibleDatabaseService.executeQuery<
        BibleVerse & { book_name: string }
      >(
        `SELECT v.id, v.book_id, v.chapter, v.verse_number, v.text, b.name as book_name
         FROM VersesFts f
         JOIN Verses v ON v.id = f.rowid
         JOIN Books b ON b.id = v.book_id
         WHERE VersesFts MATCH ?
         ORDER BY bm25(VersesFts)`,
        [query]
      );
      
      return rows;
    } catch (error) {
      console.error('Error searching verses:', error);
      return [];
    }
  }, []);

  const getCrossReferences = useCallback(
    async (bookId: number, chapter: number, verseNumber: number, limit = 200) => {
      try {
        await bibleDatabaseService.initDatabase();

        // Built from OpenBible.info and already in MG numbering (see
        // importCrossReferences in scripts/buildBibleDatabase.js), with book
        // ids as stored in Books.
        const { rows } = await bibleDatabaseService.executeQuery<BibleCrossReference>(
          `SELECT
             cr.votes,
             cr.to_book,
             cr.to_chapter,
             cr.to_verse_start,
             cr.to_verse_end,
             b_to.id as to_book_id,
             b_to.name as to_book_name
           FROM CrossReferences cr
           JOIN Books b_to ON b_to.id = cr.to_book
           WHERE cr.from_book = ? AND cr.from_chapter = ? AND cr.from_verse = ?
           ORDER BY cr.votes DESC
           LIMIT ?`,
          [bookId, chapter, verseNumber, limit]
        );

        return rows;
      } catch (error) {
        console.error('Error loading cross references:', error);
        return [];
      }
    },
    []
  );

  // Load all data on initial render
  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  return {
    books,
    verses,
    isLoading,
    error,
    loadBooks,
    loadVerses,
    getVerseCount,
    getVerse,
    searchVerses,
    getCrossReferences,
  };
};
