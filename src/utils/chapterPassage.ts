import type {BibleVerse} from '../hooks/useBibleData';
import type {VerseNoteMarks} from '../types/notes';
import {buildVerseDisplay, type MarkRange, type VerseDisplay, type VerseSpan} from './chapterMarks';
import {verseNumberLabel} from './verseSelection';

// The reader draws runs of consecutive verses as one <Text>, a passage, so
// the phone's own selection can run from one verse into the next, as on
// paper. A passage is described once, as pieces in reading order: the reader
// draws the pieces, and selections, taps and lines map back through the same
// pieces, so the two never disagree on where a verse's words sit.

export type PieceKind =
  | 'title' // Psalm title, with its line break
  | 'number' // the verse number (thin spaces around it when a note starts there)
  | 'gap' // the space after the number
  | 'text' // the verse's own words, lines joined by "\n"
  | 'footnote' // "\n" + one footnote
  | 'preview' // "\n" + the start of a note ending at this verse
  | 'separator' // ends the verse's last line
  | 'spacer'; // the short empty line between two verses

export type PassagePiece = {
  kind: PieceKind;
  verseNumber: number;
  // Exactly what the piece adds to the passage's string, from `start`.
  text: string;
  start: number;
  noteId?: string;
};

export type PassageVerse = {
  verse: BibleVerse;
  display: VerseDisplay;
  // From the title (or number) to the last preview; the gap to the next
  // verse belongs to neither.
  start: number;
  end: number;
  // The verse's own words.
  textStart: number;
  textEnd: number;
  // The note starting here, whose button the number becomes.
  noteStartId: string | null;
};

export type Passage = {
  key: string;
  verses: PassageVerse[];
  pieces: PassagePiece[];
  length: number;
};

// A line of a laid-out passage: how many characters it holds (its line break
// included), its top and its height.
export type TextLine = {length: number; y: number; height: number};

const NOTE_PREVIEW_MARK = '✎';

// Splits the visible verses into passages: a new one starts at `breakBefore`
// (the verse the open note bubble sits above) and after `maxVerses`, which
// keeps a very long chapter from being one huge text.
export const buildPassages = (
  verses: BibleVerse[],
  transformText: (text: string) => string,
  noteMarksByVerse: Record<number, VerseNoteMarks | undefined>,
  {breakBefore, maxVerses}: {breakBefore: number | null; maxVerses: number},
): Passage[] => {
  const passages: Passage[] = [];
  let passage: Passage | null = null;

  for (const verse of verses) {
    if (!passage || passage.verses.length >= maxVerses || verse.verse_number === breakBefore) {
      passage = {key: '', verses: [], pieces: [], length: 0};
      passages.push(passage);
    }
    const current = passage;
    const push = (kind: PieceKind, text: string, verseNumber: number, noteId?: string) => {
      current.pieces.push({kind, verseNumber, text, start: current.length, ...(noteId ? {noteId} : null)});
      current.length += text.length;
    };

    const previous = current.verses[current.verses.length - 1];
    if (previous) {
      push('separator', '\n', previous.verse.verse_number);
      push('spacer', '\n', previous.verse.verse_number);
    }

    const n = verse.verse_number;
    const marks = noteMarksByVerse[n];
    const display = buildVerseDisplay(verse, transformText);
    const start = current.length;
    if (display.title) push('title', `${display.title}\n`, n);
    push('number', verseNumberLabel(n, !!marks?.startNoteId), n);
    push('gap', ' ', n);
    const textStart = current.length;
    push('text', display.displayText, n);
    const textEnd = current.length;
    for (const footnote of display.footnotes) push('footnote', `\n${footnote}`, n);
    for (const preview of marks?.previews ?? []) {
      push('preview', `\n${NOTE_PREVIEW_MARK} ${preview.snippet}`, n, preview.noteId);
    }
    current.verses.push({
      verse,
      display,
      start,
      end: current.length,
      textStart,
      textEnd,
      noteStartId: marks?.startNoteId ?? null,
    });
  }
  // Named by its first and last verse: a range view starting at the same verse
  // is a different passage, so it never reuses this one's laid-out lines.
  for (const p of passages) {
    p.key = `passage-${p.verses[0].verse.id}-${p.verses[p.verses.length - 1].verse.id}`;
  }
  return passages;
};

// A selection [start, end) in a passage's string, as chapter offsets, the ones
// the marks use (verse texts joined by "\n" over the whole chapter, see
// buildChapterDisplay). Titles, numbers, footnotes, previews and the gaps
// between verses are left out; null when no word of any verse is selected.
export const passageRangeToChapterRange = (
  passage: Passage,
  start: number,
  end: number,
  verseSpans: VerseSpan[],
): MarkRange | null => {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const first = passage.verses.find(v => v.textEnd > from);
  const last = [...passage.verses].reverse().find(v => v.textStart < to);
  const firstSpan = first && verseSpans.find(s => s.verseId === first.verse.id);
  const lastSpan = last && verseSpans.find(s => s.verseId === last.verse.id);
  if (!first || !last || !firstSpan || !lastSpan) return null;
  const chapterStart = firstSpan.start + Math.max(from, first.textStart) - first.textStart;
  const chapterEnd = lastSpan.start + Math.min(to, last.textEnd) - last.textStart;
  return chapterEnd > chapterStart ? {start: chapterStart, end: chapterEnd} : null;
};

// The verse drawn at `offset`; the gap between two verses counts as the
// first one's.
export const verseAtOffset = (passage: Passage, offset: number): BibleVerse | null => {
  let found: PassageVerse | undefined;
  for (const v of passage.verses) {
    if (v.start > offset) break;
    found = v;
  }
  return (found ?? passage.verses[0])?.verse ?? null;
};

// The line holding `offset`, from the lines of the laid-out passage.
export const lineAtOffset = (lines: TextLine[], offset: number): TextLine | null => {
  let cursor = 0;
  for (const line of lines) {
    cursor += line.length;
    if (offset < cursor) return line;
  }
  return lines[lines.length - 1] ?? null;
};

// Where a verse sits in its laid-out passage, from its first line's top to
// its last line's bottom.
export const verseExtent = (
  lines: TextLine[],
  verse: PassageVerse,
): {top: number; bottom: number} | null => {
  const first = lineAtOffset(lines, verse.start);
  const last = lineAtOffset(lines, Math.max(verse.start, verse.end - 1));
  return first && last ? {top: first.y, bottom: last.y + last.height} : null;
};
