import {Platform} from 'react-native';

// A verse is one <Text>: [title + "\n"] + number + " " + the verse text
// (its lines joined by "\n") + ["\n" + footnote]*. A native selection gives
// positions in that whole string; these helpers turn them into positions in
// the verse text alone. The reader and these helpers must build the number
// the same way, hence verseNumberLabel.

// onLongPress for a tappable span inside selectable text. Android: without
// one, React Native calls onPress when a long press that selected the span
// is released. iOS: the text view already drops that tap, and a span with
// onLongPress would keep the long press from selecting.
export const SPAN_LONG_PRESS = Platform.OS === 'android' ? () => {} : undefined;

// Thin spaces pad the number when it is a note's coloured button.
export const verseNumberLabel = (verseNumber: number, startsNote: boolean): string =>
  startsNote ? ` ${verseNumber} ` : `${verseNumber}`;

// How many characters come before the verse text inside the verse's <Text>.
export const verseTextPrefixLength = (title: string | null, numberLabel: string): number =>
  (title ? title.length + 1 : 0) + numberLabel.length + 1;

// A selection [start, end) in the verse's <Text>, as offsets in the verse
// text. Parts on the title, the number or a footnote are cut off; null when
// nothing of the verse text itself is selected.
export const selectionToVerseRange = (
  start: number,
  end: number,
  prefixLength: number,
  textLength: number,
): {start: number; end: number} | null => {
  const from = Math.min(Math.max(Math.min(start, end) - prefixLength, 0), textLength);
  const to = Math.min(Math.max(Math.max(start, end) - prefixLength, 0), textLength);
  return to > from ? {start: from, end: to} : null;
};
