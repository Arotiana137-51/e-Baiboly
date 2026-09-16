// src/hooks/useHymnsData.ts
import {useCallback, useEffect, useState} from 'react';
import { hymnsDatabaseService } from '../services/database/DatabaseService';

export interface Hymn {
  id: string;
  number: number;
  category?: string;
  title: string;
  authors: string[];
  // Hymnbook annotation under the number ("Maintimolaly", "Hira Paska").
  note?: string | null;
}

export interface HymnVerse {
  id: number;
  hymn_id: string;
  verse_number: number;
  // Cue printed above the stanza ("Fizarana II", "Vakiteny 3").
  heading?: string | null;
  text: string;
  is_chorus: boolean;
}

export const useHymnsData = () => {
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [verses, setVerses] = useState<HymnVerse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all hymns
  const loadHymns = useCallback(async () => {
    try {
      setIsLoading(true);
      await hymnsDatabaseService.initDatabase();
      const { rows } = await hymnsDatabaseService.executeQuery<{
        id: string;
        number: number;
        category?: string;
        title: string;
        authors: string;
        note: string | null;
      }>('SELECT id, number, category, title, authors, note FROM Hymns ORDER BY number');
      
      const hymnsList: Hymn[] = rows.map(hymn => ({
        ...hymn,
        authors: hymn.authors ? JSON.parse(hymn.authors) : []
      }));
      
      setHymns(hymnsList);
      return hymnsList;
    } catch (error) {
      console.error('Error loading hymns:', error);
      setError('Failed to load hymns');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load verses for a specific hymn
  const loadHymnVerses = useCallback(async (hymnId: string) => {
    try {
      setIsLoading(true);
      await hymnsDatabaseService.initDatabase();
      const { rows } = await hymnsDatabaseService.executeQuery<HymnVerse>(
        'SELECT id, hymn_id, verse_number, heading, text, is_chorus FROM HymnVerses WHERE hymn_id = ? ORDER BY verse_number',
        [hymnId]
      );

      const versesList: HymnVerse[] = rows;

      setVerses(versesList);
      return versesList;
    } catch (error) {
      console.error('Error loading hymn verses:', error);
      setError('Failed to load hymn verses');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search for hymns by title or content
  const searchHymns = useCallback(async (query: string) => {
    try {
      await hymnsDatabaseService.initDatabase();
      const { rows } = await hymnsDatabaseService.executeQuery<{
        id: string;
        number: number;
        category?: string;
        title: string;
        authors: string;
      }>(
        // HymnVersesFts is contentless, so we look up hymn_id by joining
        // HymnVerses on rowid rather than selecting it from FTS.
        `SELECT h.id, h.number, h.category, h.title, h.authors
         FROM Hymns h
         WHERE h.id IN (
           SELECT hymn_id FROM HymnsFts WHERE HymnsFts MATCH ?
           UNION
           SELECT v.hymn_id
             FROM HymnVersesFts f
             JOIN HymnVerses v ON v.rowid = f.rowid
             WHERE HymnVersesFts MATCH ?
         )
         ORDER BY h.number
         LIMIT 200`,
        [query, query]
      );
      
      const hymnsList: Hymn[] = rows.map(hymn => ({
        ...hymn,
        authors: hymn.authors ? JSON.parse(hymn.authors) : []
      }));
      
      return hymnsList;
    } catch (error) {
      console.error('Error searching hymns:', error);
      return [];
    }
  }, []);

  // Load all data on initial render
  useEffect(() => {
    loadHymns();
  }, [loadHymns]);

  return {
    hymns,
    verses,
    isLoading,
    error,
    loadHymns,
    loadHymnVerses,
    searchHymns,
  };
};
