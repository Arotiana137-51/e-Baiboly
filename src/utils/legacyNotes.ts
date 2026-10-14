import AsyncStorage from '@react-native-async-storage/async-storage';
import type {ChapterMark, VerseSpan} from './chapterMarks';
import type {Note} from '../types/notes';

// Notes used to be 'note' marks inside the highlight storage, positioned by
// character offsets into the chapter (or hymn) text. This turns them into
// verse-anchored notes once, then removes them from the highlight storage.

const CHAPTER_MARKS_KEY_RE = /^chapterMarks:(\d+):(\d+)$/;
const HYMN_MARKS_KEY_RE = /^hymnMarks:(.+)$/;

const isLegacyNote = (m: unknown): m is ChapterMark => {
  if (typeof m !== 'object' || m === null) return false;
  const c = m as Record<string, unknown>;
  return (
    c.style === 'note' &&
    typeof c.id === 'string' &&
    typeof c.start === 'number' &&
    typeof c.end === 'number' &&
    typeof c.note === 'string' &&
    c.note.trim().length > 0
  );
};

// The verse holding the note's first character, through the verse holding its
// last one. An offset past the end (text changed since the note was written)
// falls back to the last verse, as the old notes list did.
export const legacyMarkToVerseRange = (
  mark: {start: number; end: number},
  spans: VerseSpan[],
): {verseStart: number; verseEnd: number} | null => {
  if (spans.length === 0) return null;
  const last = spans[spans.length - 1];
  const spanAt = (offset: number) =>
    spans.find(s => offset >= s.start && offset < s.end) ?? last;
  const verseStart = spanAt(mark.start).verseNumber;
  const verseEnd = spanAt(Math.max(mark.start, mark.end - 1)).verseNumber;
  return {verseStart, verseEnd: Math.max(verseStart, verseEnd)};
};

export type LegacySpanLoaders = {
  chapterSpans: (bookId: number, chapter: number) => Promise<VerseSpan[]>;
  hymnSpans: (hymnId: string) => Promise<VerseSpan[]>;
};

const readLegacyMarks = async (): Promise<Array<[string, ChapterMark[]]>> => {
  const keys = await AsyncStorage.getAllKeys();
  const markKeys = keys.filter(k => CHAPTER_MARKS_KEY_RE.test(k) || HYMN_MARKS_KEY_RE.test(k));
  if (markKeys.length === 0) return [];
  const pairs = await AsyncStorage.multiGet(markKeys);
  const out: Array<[string, ChapterMark[]]> = [];
  for (const [key, raw] of pairs) {
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push([key, parsed as ChapterMark[]]);
    } catch {
      // unreadable entry: leave it alone
    }
  }
  return out;
};

// Builds verse-anchored notes from every legacy note mark. Writes nothing.
// The old mark id becomes the note id, so running this again after an
// interrupted migration finds the same notes instead of duplicating them.
export const collectLegacyNotes = async (load: LegacySpanLoaders): Promise<Note[]> => {
  const notes: Note[] = [];
  for (const [key, marks] of await readLegacyMarks()) {
    const legacy = marks.filter(isLegacyNote);
    if (legacy.length === 0) continue;

    const chapterMatch = CHAPTER_MARKS_KEY_RE.exec(key);
    const hymnMatch = chapterMatch ? null : HYMN_MARKS_KEY_RE.exec(key);
    const spans = chapterMatch
      ? await load.chapterSpans(Number(chapterMatch[1]), Number(chapterMatch[2]))
      : hymnMatch
      ? await load.hymnSpans(hymnMatch[1])
      : [];

    for (const mark of legacy) {
      const range = legacyMarkToVerseRange(mark, spans);
      if (!range) continue;
      const createdAt = mark.createdAt || new Date().toISOString();
      notes.push({
        id: mark.id,
        anchor: chapterMatch
          ? {
              kind: 'bible',
              bookId: Number(chapterMatch[1]),
              chapter: Number(chapterMatch[2]),
              ...range,
            }
          : {kind: 'hymn', hymnId: hymnMatch![1], stanza: range.verseStart},
        text: (mark.note ?? '').trim(),
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
  return notes;
};

// Removes the 'note' marks from the highlight storage, keeping every other
// mark. Run only after the migrated notes are safely written.
export const stripLegacyNoteMarks = async (): Promise<void> => {
  for (const [key, marks] of await readLegacyMarks()) {
    const kept = marks.filter(m => !(m && (m as ChapterMark).style === 'note'));
    if (kept.length === marks.length) continue;
    if (kept.length === 0) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(kept));
    }
  }
};
