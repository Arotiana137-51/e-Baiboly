/**
 * A verse is one <Text>: [title + "\n"] + number + " " + verse text +
 * ["\n" + footnote]. The phone's selection gives positions in that whole
 * string; these must land on the same words of the verse text.
 */
import {
  selectionToVerseRange,
  verseNumberLabel,
  verseTextPrefixLength,
} from '../src/utils/verseSelection';

const verseText = "Fa toy izao no nitiavan'Andriamanitra izao tontolo izao";

// What the reader renders, built the same way.
const rendered = (title: string | null, number: string, footnote?: string) =>
  `${title ? `${title}\n` : ''}${number} ${verseText}${footnote ? `\n${footnote}` : ''}`;

const select = (whole: string, words: string) => {
  const start = whole.indexOf(words);
  return {start, end: start + words.length};
};

test('plain verse: the selected words map back exactly', () => {
  const label = verseNumberLabel(16, false);
  const whole = rendered(null, label);
  const {start, end} = select(whole, "nitiavan'Andriamanitra");
  const range = selectionToVerseRange(start, end, verseTextPrefixLength(null, label), verseText.length);
  expect(range).not.toBeNull();
  expect(verseText.slice(range!.start, range!.end)).toBe("nitiavan'Andriamanitra");
});

test('a noted number (thin spaces) and a psalm title are skipped', () => {
  const title = 'Salamon\'i Davida';
  const label = verseNumberLabel(16, true);
  expect(label).toBe(' 16 ');
  const whole = rendered(title, label);
  const {start, end} = select(whole, 'tontolo');
  const range = selectionToVerseRange(start, end, verseTextPrefixLength(title, label), verseText.length);
  expect(verseText.slice(range!.start, range!.end)).toBe('tontolo');
});

test('a selection running into the number or a footnote is cut to the verse text', () => {
  const label = verseNumberLabel(3, false);
  const whole = rendered(null, label, 'Na: fitiavana');
  const prefix = verseTextPrefixLength(null, label);
  // From the number to the middle of the footnote.
  const range = selectionToVerseRange(0, whole.length - 3, prefix, verseText.length);
  expect(range).toEqual({start: 0, end: verseText.length});
});

test('only the number (or title) selected: nothing of the verse text', () => {
  const label = verseNumberLabel(12, false);
  expect(selectionToVerseRange(0, label.length, verseTextPrefixLength(null, label), verseText.length)).toBeNull();
});

test('a backwards selection (end before start) is handled', () => {
  const label = verseNumberLabel(1, false);
  const prefix = verseTextPrefixLength(null, label);
  expect(selectionToVerseRange(prefix + 6, prefix + 2, prefix, verseText.length)).toEqual({start: 2, end: 6});
});
