/**
 * The reader draws a chapter as passages (one <Text> each); a selection,
 * a tap or a line must map back to the same words of the same verse.
 */
import type {BibleVerse} from '../src/hooks/useBibleData';
import {buildChapterDisplay} from '../src/utils/chapterMarks';
import {
  buildPassages,
  lineAtOffset,
  passageRangeToChapterRange,
  verseAtOffset,
  verseExtent,
  type Passage,
  type TextLine,
} from '../src/utils/chapterPassage';

const MARKA = 41;
const SALAMO = 19;
const same = (s: string) => s;

const verse = (n: number, text: string, extra: Partial<BibleVerse> = {}): BibleVerse => ({
  id: 1000 + n,
  book_id: MARKA,
  chapter: 6,
  verse_number: n,
  text,
  ...extra,
});

const chapter = [
  verse(1, 'Dia nivoaka niala teo Izy ka tonga tany amin’ny taniny'),
  verse(2, 'Ary nony tonga ny Sabata, dia nampianatra'),
  verse(3, 'Tsy ilay mpandrafitra va Izy ity?'),
  verse(4, 'Ary hoy Jesosy taminy'),
];

const passageString = (p: Passage) => p.pieces.map(piece => piece.text).join('');
const whole = (verses: BibleVerse[], marks = {}) =>
  buildPassages(verses, same, marks, {breakBefore: null, maxVerses: 50})[0];
const spans = buildChapterDisplay(chapter, same).verseSpans;
const chapterText = buildChapterDisplay(chapter, same).chapterText;

// The selection a finger would make from `fromWords` to the end of `toWords`.
const select = (p: Passage, fromWords: string, toWords: string) => {
  const s = passageString(p);
  return {start: s.indexOf(fromWords), end: s.indexOf(toWords) + toWords.length};
};

test('pieces add up to the passage string, each verse text where the map says', () => {
  const p = whole(chapter);
  const s = passageString(p);
  expect(s.length).toBe(p.length);
  for (const v of p.verses) {
    expect(s.slice(v.textStart, v.textEnd)).toBe(v.display.displayText);
  }
  expect(s.startsWith('1 Dia nivoaka')).toBe(true);
  // Each verse after the first starts after a line break and a short empty line.
  expect(s).toContain('taniny\n\n2 Ary');
});

test('a selection from half of verse 1 to half of verse 2 is one chapter range', () => {
  const p = whole(chapter);
  const {start, end} = select(p, 'tonga tany', 'nony tonga');
  const range = passageRangeToChapterRange(p, start, end, spans)!;
  expect(chapterText.slice(range.start, range.end)).toBe('tonga tany amin’ny taniny\nAry nony tonga');
});

test('a selection over three verses skips the numbers between them', () => {
  const p = whole(chapter);
  const {start, end} = select(p, 'nampianatra', 'Tsy ilay');
  const range = passageRangeToChapterRange(p, start, end, spans)!;
  expect(chapterText.slice(range.start, range.end)).toBe('nampianatra\nTsy ilay');
});

test('a selection starting on a number or ending in a footnote keeps only verse words', () => {
  const withFootnote = [verse(1, 'Ary hoy Jesosy taminy [*Na: tamin’izy ireo]'), verse(2, 'Mandehana')];
  const p = whole(withFootnote);
  const s = passageString(p);
  const footnote = p.pieces.find(piece => piece.kind === 'footnote');
  expect(footnote).toBeDefined();
  // From the very first character (the number) into the middle of the footnote.
  const range = passageRangeToChapterRange(
    p,
    0,
    footnote!.start + 4,
    buildChapterDisplay(withFootnote, same).verseSpans,
  )!;
  const text = buildChapterDisplay(withFootnote, same).chapterText;
  expect(text.slice(range.start, range.end)).toBe(p.verses[0].display.displayText);
  expect(s.slice(0, 2)).toBe('1 ');
});

test('only a number or a title selected: no range', () => {
  const p = whole(chapter);
  expect(passageRangeToChapterRange(p, 0, 1, spans)).toBeNull();
  const psalm = [verse(1, 'Sambatra ny olona', {book_id: SALAMO, title: 'Salamon’i Davida'})];
  const pp = whole(psalm);
  expect(passageString(pp).startsWith('Salamon’i Davida\n1 ')).toBe(true);
  expect(
    passageRangeToChapterRange(pp, 0, 10, buildChapterDisplay(psalm, same).verseSpans),
  ).toBeNull();
});

test('a range view (verses 2-3) gives the same chapter offsets as the whole chapter', () => {
  const full = whole(chapter);
  const range = whole(chapter.slice(1, 3));
  const a = select(full, 'nampianatra', 'mpandrafitra');
  const b = select(range, 'nampianatra', 'mpandrafitra');
  expect(passageRangeToChapterRange(range, b.start, b.end, spans)).toEqual(
    passageRangeToChapterRange(full, a.start, a.end, spans),
  );
});

test('a noted number gets its thin spaces, and its note preview is skipped', () => {
  const marks = {
    2: {bracket: null, startNoteId: 'n1', previews: [{noteId: 'n1', snippet: 'Sabata…'}]},
  };
  const p = whole(chapter, marks);
  const s = passageString(p);
  expect(s).toContain(' 2  Ary nony');
  expect(s).toContain('\n✎ Sabata…');
  const preview = p.pieces.find(piece => piece.kind === 'preview')!;
  expect(preview.noteId).toBe('n1');
  // From inside the preview to verse 3: only verse 3's words.
  const end = s.indexOf('Tsy ilay') + 'Tsy ilay'.length;
  const range = passageRangeToChapterRange(p, preview.start + 3, end, spans)!;
  expect(chapterText.slice(range.start, range.end)).toBe('Tsy ilay');
});

test('a tap maps to its verse; the gap between verses is the first one’s', () => {
  const p = whole(chapter);
  const s = passageString(p);
  expect(verseAtOffset(p, 0)?.verse_number).toBe(1);
  expect(verseAtOffset(p, s.indexOf('nampianatra'))?.verse_number).toBe(2);
  expect(verseAtOffset(p, s.indexOf('\n\n2') + 1)?.verse_number).toBe(1);
  expect(verseAtOffset(p, s.indexOf('3 Tsy'))?.verse_number).toBe(3);
});

test('lines from the layout give each verse its top and bottom', () => {
  const p = whole(chapter.slice(0, 2));
  const s = passageString(p);
  // Laid out as: verse 1 on two lines, the empty line, verse 2 on one line.
  const cut = s.indexOf('tonga tany');
  const v2 = s.indexOf('2 Ary');
  const lines: TextLine[] = [
    {length: cut, y: 0, height: 24},
    {length: v2 - 1 - cut, y: 24, height: 24},
    {length: 1, y: 48, height: 7},
    {length: s.length - v2, y: 55, height: 24},
  ];
  expect(lineAtOffset(lines, v2)?.y).toBe(55);
  expect(verseExtent(lines, p.verses[0])).toEqual({top: 0, bottom: 48});
  expect(verseExtent(lines, p.verses[1])).toEqual({top: 55, bottom: 79});
});

test('passages split before the open note bubble and after the size cap', () => {
  const verses = Array.from({length: 7}, (_, i) => verse(i + 1, `Andininy ${i + 1}`));
  const byBubble = buildPassages(verses, same, {}, {breakBefore: 3, maxVerses: 50});
  expect(byBubble.map(p => p.verses.map(v => v.verse.verse_number))).toEqual([[1, 2], [3, 4, 5, 6, 7]]);
  const byCap = buildPassages(verses, same, {}, {breakBefore: null, maxVerses: 3});
  expect(byCap.map(p => p.verses.length)).toEqual([3, 3, 1]);
  expect(passageString(byCap[1]).startsWith('4 ')).toBe(true);
});
