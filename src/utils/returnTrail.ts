import type {SelectedVerseRange} from '../components/BibleReaderView';

// A place in the Bible reader the user left by tapping a reference: the
// chapter, the verse the reference sat in, and the verse range the reader was
// narrowed to then (null when the whole chapter was showing).
export type ReaderSpot = {
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  range: SelectedVerseRange;
};

// Reference to reference to reference… past this the oldest steps drop off.
export const MAX_RETURN_TRAIL = 20;

const sameSpot = (a: ReaderSpot, b: ReaderSpot) =>
  a.bookId === b.bookId &&
  a.chapter === b.chapter &&
  a.verse === b.verse &&
  a.range?.start === b.range?.start &&
  a.range?.end === b.range?.end;

// The trail with `spot` on top. Tapping two references from the same verse
// leaves one step back, not two to the same place.
export const pushReturnSpot = (
  trail: ReadonlyArray<ReaderSpot>,
  spot: ReaderSpot,
): ReaderSpot[] => {
  const top = trail[trail.length - 1];
  if (top && sameSpot(top, spot)) return [...trail];
  const next = [...trail, spot];
  return next.length > MAX_RETURN_TRAIL ? next.slice(next.length - MAX_RETURN_TRAIL) : next;
};

// "Matio 2:5": what the back chip reads.
export const formatReaderSpot = (spot: ReaderSpot): string =>
  `${spot.bookName} ${spot.chapter}:${spot.verse}`;
