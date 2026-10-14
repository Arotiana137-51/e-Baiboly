import {useEffect, useRef, useState} from 'react';
import {bibleDatabaseService, hymnsDatabaseService} from '../services/database/DatabaseService';
import {useJesusName} from '../contexts/JesusNameContext';
import {getBibleBookShortName} from '../utils/bibleBookNames';
import {HYMN_CHORUS_LABEL} from '../utils/chapterMarks';
import type {Note} from '../types/notes';

export type NoteDetails = {
  bookName: string;          // Bible only, for navigation
  reference: string;         // "Jaona 3:16-18" / "FFPM 312 · 2"
  shortReference: string;    // "Jao 3:16-18" in the list
  quote: string;             // the noted verses / stanza
};

type ChapterRows = Array<{verse_number: number; text: string}>;
type HymnInfo = {
  number: number;
  category: string | null;
  title: string;
  stanzas: Array<{verse_number: number; text: string}>;
};

const rangeLabel = (start: number, end: number) => (end > start ? `${start}-${end}` : `${start}`);

// Reference and quoted text for every note, for the notes list. Chapters and
// hymns are read from the database once each and kept, so adding or editing a
// note doesn't re-query what is already known.
export const useNoteDetails = (notes: Note[]) => {
  const {transformText} = useJesusName();
  const books = useRef<Map<number, string> | null>(null);
  const chapters = useRef(new Map<string, ChapterRows>());
  const hymns = useRef(new Map<string, HymnInfo | null>());
  const [details, setDetails] = useState<Map<string, NoteDetails>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!books.current) {
          await bibleDatabaseService.initDatabase();
          const res = await bibleDatabaseService.executeQuery<{id: number; name: string}>(
            'SELECT id, name FROM Books',
          );
          books.current = new Map(res.rows.map(b => [b.id, b.name]));
        }
        const next = new Map<string, NoteDetails>();
        for (const note of notes) {
          const a = note.anchor;
          if (a.kind === 'bible') {
            const key = `${a.bookId}:${a.chapter}`;
            if (!chapters.current.has(key)) {
              const res = await bibleDatabaseService.executeQuery<{verse_number: number; text: string}>(
                'SELECT verse_number, text FROM Verses WHERE book_id = ? AND chapter = ? ORDER BY verse_number',
                [a.bookId, a.chapter],
              );
              chapters.current.set(key, res.rows);
            }
            const bookName = books.current.get(a.bookId) ?? '';
            const range = `${a.chapter}:${rangeLabel(a.verseStart, a.verseEnd)}`;
            next.set(note.id, {
              bookName,
              reference: `${bookName} ${range}`,
              shortReference: `${getBibleBookShortName(bookName, a.bookId)} ${range}`,
              quote: (chapters.current.get(key) ?? [])
                .filter(v => v.verse_number >= a.verseStart && v.verse_number <= a.verseEnd)
                .map(v => transformText(v.text))
                .join(' '),
            });
            continue;
          }
          if (!hymns.current.has(a.hymnId)) {
            await hymnsDatabaseService.initDatabase();
            const info = await hymnsDatabaseService.executeQuery<{number: number; category: string | null; title: string}>(
              'SELECT number, category, title FROM Hymns WHERE id = ?',
              [a.hymnId],
            );
            const stanzas = await hymnsDatabaseService.executeQuery<{verse_number: number; text: string}>(
              'SELECT verse_number, text FROM HymnVerses WHERE hymn_id = ? ORDER BY verse_number',
              [a.hymnId],
            );
            const row = info.rows[0];
            hymns.current.set(a.hymnId, row ? {...row, stanzas: stanzas.rows} : null);
          }
          const hymn = hymns.current.get(a.hymnId);
          if (!hymn) continue;
          const label = `${hymn.category ? `${hymn.category.toUpperCase()} ` : ''}${hymn.number}`;
          const part =
            a.stanza === null
              ? hymn.title.trim()
              : a.stanza === 0
              ? HYMN_CHORUS_LABEL
              : String(a.stanza);
          const reference = part ? `${label} · ${part}` : label;
          next.set(note.id, {
            bookName: '',
            reference,
            shortReference: reference,
            quote:
              a.stanza === null
                ? ''
                : hymn.stanzas
                    .filter(s => s.verse_number === a.stanza)
                    .map(s => s.text.trim())
                    .join(' / '),
          });
        }
        if (!cancelled) setDetails(next);
      } catch (error) {
        console.error('Error loading note details:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notes, transformText]);

  return details;
};
