import {Platform} from 'react-native';

// Bits of a verse shared by the reader and the passage maps
// (utils/chapterPassage.ts), which must build them the same way.

// onLongPress for a tappable span inside selectable text. Android: without
// one, React Native calls onPress when a long press that selected the span
// is released. iOS: the text view already drops that tap, and a span with
// onLongPress would keep the long press from selecting.
export const SPAN_LONG_PRESS = Platform.OS === 'android' ? () => {} : undefined;

// Thin spaces pad the number when it is a note's coloured button.
export const verseNumberLabel = (verseNumber: number, startsNote: boolean): string =>
  startsNote ? ` ${verseNumber} ` : `${verseNumber}`;
