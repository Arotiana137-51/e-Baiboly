/**
 * Old notes were 'note' marks stored with the highlights, positioned by
 * character offsets. The migration turns them into verse-anchored notes and
 * must never lose one: not on a re-run, not when other marks share the key.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collectLegacyNotes,
  legacyMarkToVerseRange,
  stripLegacyNoteMarks,
} from '../src/utils/legacyNotes';
import type {VerseSpan} from '../src/utils/chapterMarks';

// Three verses: [0,10) [11,25) [26,40), separated by '\n'.
const SPANS: VerseSpan[] = [
  {verseId: 1, verseNumber: 1, start: 0, end: 10},
  {verseId: 2, verseNumber: 2, start: 11, end: 25},
  {verseId: 3, verseNumber: 3, start: 26, end: 40},
];

describe('legacyMarkToVerseRange', () => {
  test('inside one verse', () => {
    expect(legacyMarkToVerseRange({start: 12, end: 20}, SPANS)).toEqual({verseStart: 2, verseEnd: 2});
  });

  test('the whole verse, end offset exclusive', () => {
    expect(legacyMarkToVerseRange({start: 11, end: 25}, SPANS)).toEqual({verseStart: 2, verseEnd: 2});
  });

  test('across verses', () => {
    expect(legacyMarkToVerseRange({start: 5, end: 30}, SPANS)).toEqual({verseStart: 1, verseEnd: 3});
  });

  test('an offset past the end lands on the last verse', () => {
    expect(legacyMarkToVerseRange({start: 90, end: 99}, SPANS)).toEqual({verseStart: 3, verseEnd: 3});
  });

  test('no verses, no anchor', () => {
    expect(legacyMarkToVerseRange({start: 0, end: 5}, [])).toBeNull();
  });
});

describe('migration', () => {
  const loaders = {
    chapterSpans: jest.fn(async () => SPANS),
    hymnSpans: jest.fn(async () => [
      {verseId: 7, verseNumber: 0, start: 0, end: 20},
      {verseId: 8, verseNumber: 1, start: 21, end: 50},
    ]),
  };

  const highlight = {id: 'h1', start: 0, end: 4, style: 'highlight', color: '#FFEB3B', createdAt: '2026-01-01'};
  const bibleNote = {id: 'n1', start: 12, end: 30, style: 'note', note: ' Fitiavana ', createdAt: '2026-02-02'};
  const hymnNote = {id: 'n2', start: 2, end: 6, style: 'note', note: 'Refrain', createdAt: '2026-03-03'};
  const emptyNote = {id: 'n3', start: 0, end: 3, style: 'note', note: '   ', createdAt: '2026-04-04'};

  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('chapterMarks:43:3', JSON.stringify([highlight, bibleNote, emptyNote]));
    await AsyncStorage.setItem('hymnMarks:ffpm_1', JSON.stringify([hymnNote]));
    await AsyncStorage.setItem('favorites_verses', '[]');
  });

  test('builds verse- and stanza-anchored notes, keeping ids and dates', async () => {
    const notes = await collectLegacyNotes(loaders);
    expect(notes).toEqual(
      expect.arrayContaining([
        {
          id: 'n1',
          anchor: {kind: 'bible', bookId: 43, chapter: 3, verseStart: 2, verseEnd: 3},
          text: 'Fitiavana',
          createdAt: '2026-02-02',
          updatedAt: '2026-02-02',
        },
        {
          id: 'n2',
          anchor: {kind: 'hymn', hymnId: 'ffpm_1', stanza: 0},
          text: 'Refrain',
          createdAt: '2026-03-03',
          updatedAt: '2026-03-03',
        },
      ]),
    );
    // A blank note was never shown; it is not carried over.
    expect(notes.map(n => n.id).sort()).toEqual(['n1', 'n2']);
  });

  test('stripping keeps highlights and drops keys left empty', async () => {
    await stripLegacyNoteMarks();
    expect(JSON.parse((await AsyncStorage.getItem('chapterMarks:43:3'))!)).toEqual([highlight]);
    expect(await AsyncStorage.getItem('hymnMarks:ffpm_1')).toBeNull();
    expect(await AsyncStorage.getItem('favorites_verses')).toBe('[]');
  });

  test('collecting twice gives the same ids, so an interrupted run cannot duplicate', async () => {
    const first = await collectLegacyNotes(loaders);
    const second = await collectLegacyNotes(loaders);
    expect(second.map(n => n.id)).toEqual(first.map(n => n.id));
  });
});
