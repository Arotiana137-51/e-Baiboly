import type {BibleVerse} from '../hooks/useBibleData';
import type {HymnVerse} from '../hooks/useHymnsData';
import {
  extractBracketFootnotes,
  flattenBibleTextForReader,
  processBibleTextWithMetadataForReader,
} from './bibleTextUtils';

const ITALIC_START = '\u0002';
const ITALIC_END = '\u0003';

export const PSALMS_BOOK_ID = 19;
export const PROVERBS_BOOK_ID = 20;

export type MarkStyle = 'highlight' | 'bold' | 'italic' | 'underline' | 'note';

export interface ChapterMark {
  id: string;
  start: number;
  end: number;
  style: MarkStyle;
  color?: string;
  createdAt: string;
  // Free-form user-authored note attached to the range. Always present when
  // style === 'note'. Can also coexist on a 'highlight' mark for a "highlight
  // + comment" pattern, in which case there is one ChapterMark with style
  // 'highlight' AND a sibling mark with style 'note' covering the same range.
  note?: string;
}

export interface VerseSpan {
  verseId: number;
  verseNumber: number;
  start: number;
  end: number;
}

export interface VerseDisplay {
  verseId: number;
  verseNumber: number;
  displayText: string;
  lines: string[];
  italicLines: Set<number>;
  title: string | null;
  footnotes: string[];
}

export interface ChapterDisplay {
  chapterText: string;
  verseSpans: VerseSpan[];
  verses: VerseDisplay[];
  separator: string;
  metaVersion: number;
}

const stripItalicMarkers = (s: string): string =>
  s.replaceAll(ITALIC_START, '').replaceAll(ITALIC_END, '');

const VERSE_SEPARATOR = '\n';
const META_VERSION = 1;

export const buildVerseDisplay = (
  verse: BibleVerse,
  transformText: (text: string) => string,
): VerseDisplay => {
  const isPsalmsOrProverbs =
    verse.book_id === PSALMS_BOOK_ID || verse.book_id === PROVERBS_BOOK_ID;
  const hasTitle =
    typeof verse.title === 'string' && verse.title.trim().length > 0;

  const baseText = transformText(verse.text);
  const readerText =
    !isPsalmsOrProverbs && !hasTitle
      ? flattenBibleTextForReader(baseText)
      : baseText;

  const {textWithoutFootnotes, footnotes} = extractBracketFootnotes(readerText);
  const {lines, italicLines} =
    processBibleTextWithMetadataForReader(textWithoutFootnotes);

  const cleanedLines = lines.map(stripItalicMarkers);
  const displayText = cleanedLines.join('\n');

  return {
    verseId: verse.id,
    verseNumber: verse.verse_number,
    displayText,
    lines,
    italicLines,
    title: hasTitle ? transformText(verse.title!.trim()) : null,
    footnotes,
  };
};

export const buildChapterDisplay = (
  verses: BibleVerse[],
  transformText: (text: string) => string,
): ChapterDisplay => {
  const verseDisplays: VerseDisplay[] = [];
  const verseSpans: VerseSpan[] = [];
  let cursor = 0;
  const parts: string[] = [];

  for (let i = 0; i < verses.length; i += 1) {
    const v = verses[i];
    const display = buildVerseDisplay(v, transformText);
    verseDisplays.push(display);

    const start = cursor;
    const end = cursor + display.displayText.length;
    verseSpans.push({
      verseId: v.id,
      verseNumber: v.verse_number,
      start,
      end,
    });

    parts.push(display.displayText);
    cursor = end;
    if (i < verses.length - 1) {
      cursor += VERSE_SEPARATOR.length;
    }
  }

  return {
    chapterText: parts.join(VERSE_SEPARATOR),
    verseSpans,
    verses: verseDisplays,
    separator: VERSE_SEPARATOR,
    metaVersion: META_VERSION,
  };
};

export const intersectMarksWithSpan = (
  marks: ChapterMark[],
  span: VerseSpan,
): ChapterMark[] => {
  const result: ChapterMark[] = [];
  for (const m of marks) {
    if (m.end <= span.start || m.start >= span.end) continue;
    result.push({
      ...m,
      start: Math.max(m.start, span.start) - span.start,
      end: Math.min(m.end, span.end) - span.start,
    });
  }
  return result;
};

export interface VerseLineSegment {
  text: string;
  italic: boolean;
  marks: MarkStyle[];
  highlightColor?: string;
}

const normalizeRanges = (
  marks: ChapterMark[],
  textLength: number,
): ChapterMark[] => {
  return marks
    .map(m => ({
      ...m,
      start: Math.max(0, Math.min(textLength, m.start)),
      end: Math.max(0, Math.min(textLength, m.end)),
    }))
    .filter(m => m.end > m.start);
};

const getMarksAt = (
  cleanedIdx: number,
  marks: ChapterMark[],
): {styles: Set<MarkStyle>; highlightColor?: string} => {
  const styles = new Set<MarkStyle>();
  let highlightColor: string | undefined;
  for (const m of marks) {
    if (cleanedIdx >= m.start && cleanedIdx < m.end) {
      styles.add(m.style);
      if (m.style === 'highlight' && m.color) {
        highlightColor = m.color;
      }
    }
  }
  return {styles, highlightColor};
};

const setsEqual = (a: Set<MarkStyle>, b: Set<MarkStyle>): boolean => {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
};

export const buildLineSegments = (
  rawLine: string,
  lineStartOffset: number,
  verseMarks: ChapterMark[],
): VerseLineSegment[] => {
  const cleanedLength = stripItalicMarkers(rawLine).length;
  const lineEnd = lineStartOffset + cleanedLength;

  const localMarks: ChapterMark[] = [];
  for (const m of verseMarks) {
    const start = Math.max(m.start, lineStartOffset);
    const end = Math.min(m.end, lineEnd);
    if (end > start) {
      localMarks.push({
        ...m,
        start: start - lineStartOffset,
        end: end - lineStartOffset,
      });
    }
  }
  const merged = normalizeRanges(localMarks, cleanedLength);

  const segments: VerseLineSegment[] = [];
  let buffer = '';
  let italic = false;
  let activeStyles = new Set<MarkStyle>();
  let activeHighlight: string | undefined;
  let cleanedCursor = 0;

  const flush = () => {
    if (!buffer) return;
    segments.push({
      text: buffer,
      italic,
      marks: Array.from(activeStyles),
      highlightColor: activeHighlight,
    });
    buffer = '';
  };

  for (let i = 0; i < rawLine.length; i += 1) {
    const ch = rawLine[i];
    if (ch === ITALIC_START) {
      flush();
      italic = true;
      continue;
    }
    if (ch === ITALIC_END) {
      flush();
      italic = false;
      continue;
    }
    const {styles, highlightColor} = getMarksAt(cleanedCursor, merged);
    if (!setsEqual(styles, activeStyles) || highlightColor !== activeHighlight) {
      flush();
      activeStyles = styles;
      activeHighlight = highlightColor;
    }
    buffer += ch;
    cleanedCursor += 1;
  }
  flush();
  return segments;
};

export const buildVerseLineOffsets = (lines: string[]): number[] => {
  const offsets: number[] = [];
  let cursor = 0;
  for (let i = 0; i < lines.length; i += 1) {
    offsets.push(cursor);
    cursor += stripItalicMarkers(lines[i]).length;
    if (i < lines.length - 1) cursor += 1;
  }
  return offsets;
};

// --- Editing a range of the chapter text, as the highlight bubble does. ---

export type MarkRange = {start: number; end: number};
export type EditableMarkStyle = 'highlight' | 'bold' | 'italic' | 'underline';

const newMarkId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Whether `marks` together cover every character of `range`.
const coversRange = (marks: ChapterMark[], range: MarkRange): boolean => {
  let cursor = range.start;
  for (const m of [...marks].sort((a, b) => a.start - b.start)) {
    if (m.start > cursor) break;
    cursor = Math.max(cursor, m.end);
  }
  return cursor >= range.end;
};

// Takes `range` out of the marks `cut` picks; one running past it on both
// sides is split in two.
const cutRange = (
  marks: ChapterMark[],
  range: MarkRange,
  cut: (m: ChapterMark) => boolean,
): ChapterMark[] =>
  marks.flatMap(m => {
    if (!cut(m) || m.end <= range.start || m.start >= range.end) return [m];
    const parts: ChapterMark[] = [];
    if (m.start < range.start) parts.push({...m, end: range.start});
    if (m.end > range.end) {
      parts.push({...m, id: parts.length ? newMarkId() : m.id, start: range.end});
    }
    return parts;
  });

// What `range` already has: the one colour covering all of it, if any, and
// whether it is all bold / italic / underlined.
export const rangeStyles = (marks: ChapterMark[], range: MarkRange) => {
  const has = (style: MarkStyle) =>
    coversRange(marks.filter(m => m.style === style), range);
  const color = marks.find(
    m =>
      m.style === 'highlight' &&
      coversRange(marks.filter(o => o.style === 'highlight' && o.color === m.color), range),
  )?.color;
  return {color, bold: has('bold'), italic: has('italic'), underline: has('underline')};
};

// One style on `range`, like a pen on paper: a colour replaces the colour
// underneath, and the colour (or bold / italic / underline) already covering
// the whole range comes off instead.
export const applyMarkToRange = (
  marks: ChapterMark[],
  range: MarkRange,
  style: EditableMarkStyle,
  color?: string,
): ChapterMark[] => {
  const same = (m: ChapterMark) =>
    m.style === style && (style !== 'highlight' || m.color === color);
  const alreadyThere = coversRange(marks.filter(same), range);
  const rest = cutRange(marks, range, m => m.style === style);
  if (alreadyThere) return rest;
  return [
    ...rest,
    {
      id: newMarkId(),
      start: range.start,
      end: range.end,
      style,
      ...(style === 'highlight' ? {color} : null),
      createdAt: new Date().toISOString(),
    },
  ];
};

// Takes every colour, bold, italic and underline off `range`.
export const eraseMarksInRange = (marks: ChapterMark[], range: MarkRange): ChapterMark[] =>
  cutRange(marks, range, m => m.style !== 'note');

export const chapterMarksKey = (bookId: number, chapter: number): string =>
  `chapterMarks:${bookId}:${chapter}`;

export const hymnMarksKey = (hymnId: string): string => `hymnMarks:${hymnId}`;

// Title of stanza 0 (the chorus) wherever a hymn is laid out like a chapter:
// the reader, the highlight editor and the notes list.
export const HYMN_CHORUS_LABEL = 'Refrain';

/**
 * Hymn counterpart of buildChapterDisplay so the same editor and mark
 * rendering work on a hymn. One "verse" per stanza (verse_number 0 is the
 * chorus, titled so it reads as such in the editor). Hymn text is plain
 * lines separated by '\n' — none of the Bible markup passes apply.
 */
export const buildHymnDisplay = (
  hymnVerses: HymnVerse[],
  chorusLabel: string,
): ChapterDisplay => {
  const verses: VerseDisplay[] = [];
  const verseSpans: VerseSpan[] = [];
  const parts: string[] = [];
  let cursor = 0;

  const ordered = [...hymnVerses].sort((a, b) => a.verse_number - b.verse_number);
  for (let i = 0; i < ordered.length; i += 1) {
    const v = ordered[i];
    const displayText = v.text.trim();
    verses.push({
      verseId: v.id,
      verseNumber: v.verse_number,
      displayText,
      lines: displayText.split('\n'),
      italicLines: new Set(),
      title: v.is_chorus ? chorusLabel : v.heading || null,
      footnotes: [],
    });
    const end = cursor + displayText.length;
    verseSpans.push({verseId: v.id, verseNumber: v.verse_number, start: cursor, end});
    parts.push(displayText);
    cursor = end + (i < ordered.length - 1 ? VERSE_SEPARATOR.length : 0);
  }

  return {
    chapterText: parts.join(VERSE_SEPARATOR),
    verseSpans,
    verses,
    separator: VERSE_SEPARATOR,
    metaVersion: META_VERSION,
  };
};

export {stripItalicMarkers, META_VERSION, VERSE_SEPARATOR};
