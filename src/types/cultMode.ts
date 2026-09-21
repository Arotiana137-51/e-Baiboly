export type CultBibleEntry = {
  id: string;
  type: 'bible';
  bookId: number;
  bookName: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  // Whole-chapter selection — tells the MainScreen propagator to pass
  // selectedVerseRange={null} to the reader instead of highlighting a range.
  isWholeChapter: boolean;
  label: string;
};

export type CultHymnEntry = {
  id: string;
  type: 'hymn';
  hymnId: string;
  category: string;
  hymnNumber: number;
  title: string;
  label: string;
};

export type CultEntry = CultBibleEntry | CultHymnEntry;

export const isCultBibleEntry = (e: CultEntry): e is CultBibleEntry =>
  e.type === 'bible';

export const isCultHymnEntry = (e: CultEntry): e is CultHymnEntry =>
  e.type === 'hymn';

export const generateCultEntryId = (): string =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

// Entries saved before whole-chapter selections carried a real verse count
// used this as a verseEnd placeholder. Kept only so those old playlist
// entries still play back without a range banner.
export const WHOLE_CHAPTER_VERSE_END = 999;

export const buildBibleLabel = (
  bookName: string,
  chapter: number,
  verseStart: number,
  verseEnd: number,
): string =>
  verseStart === verseEnd
    ? `${bookName} ${chapter}:${verseStart}`
    : `${bookName} ${chapter}:${verseStart}-${verseEnd}`;

export const buildHymnLabel = (
  category: string,
  hymnNumber: number,
  title: string,
): string => `${category} ${hymnNumber} — ${title}`;
