/**
 * What a verse shows for its notes while reading: the margin bracket, the
 * coloured number on the verse a note starts on, and the note's first line
 * under the verse it ends on.
 */
import {
  firstLineOf,
  noteMarksForVerses,
  noteSnippet,
  noteSnippetBudget,
  type Note,
} from '../src/types/notes';

const PHONE = noteSnippetBudget(360);

const note = (id: string, verseStart: number, verseEnd: number, text = `naoty ${id}`): Note => ({
  id,
  anchor: {kind: 'bible', bookId: 43, chapter: 3, verseStart, verseEnd},
  text,
  createdAt: '2026-10-14T08:00:00.000Z',
  updatedAt: '2026-10-14T08:00:00.000Z',
});

test('a one-verse note: number, bracket and preview on the same verse', () => {
  const marks = noteMarksForVerses([note('a', 16, 16)], PHONE);
  expect(marks[16]).toEqual({
    bracket: {noteId: 'a', isStart: true, isEnd: true},
    startNoteId: 'a',
    previews: [{noteId: 'a', snippet: 'naoty a'}],
  });
  expect(marks[15]).toBeUndefined();
});

test('a range: number on the first verse, preview under the last', () => {
  const marks = noteMarksForVerses([note('a', 16, 18)], PHONE);
  expect(marks[16].startNoteId).toBe('a');
  expect(marks[16].previews).toEqual([]);
  expect(marks[17]).toEqual({
    bracket: {noteId: 'a', isStart: false, isEnd: false},
    startNoteId: null,
    previews: [],
  });
  expect(marks[18].bracket).toEqual({noteId: 'a', isStart: false, isEnd: true});
  expect(marks[18].previews).toEqual([{noteId: 'a', snippet: 'naoty a'}]);
});

test('overlapping notes: the later start owns the bracket, both keep their number and preview', () => {
  const marks = noteMarksForVerses([note('inner', 17, 17), note('outer', 16, 18)], PHONE);
  expect(marks[16].bracket?.noteId).toBe('outer');
  expect(marks[17].bracket).toEqual({noteId: 'inner', isStart: true, isEnd: true});
  expect(marks[18].bracket?.noteId).toBe('outer');
  expect(marks[16].startNoteId).toBe('outer');
  expect(marks[17].startNoteId).toBe('inner');
  expect(marks[17].previews.map(p => p.noteId)).toEqual(['inner']);
  expect(marks[18].previews.map(p => p.noteId)).toEqual(['outer']);
});

test('two notes ending on the same verse give two previews', () => {
  const marks = noteMarksForVerses([note('a', 14, 16), note('b', 16, 16)], PHONE);
  expect(marks[16].previews.map(p => p.noteId)).toEqual(['a', 'b']);
});

test('hymn notes are ignored here', () => {
  const hymn: Note = {...note('h', 1, 1), anchor: {kind: 'hymn', hymnId: 'ffpm_1', stanza: 1}};
  expect(noteMarksForVerses([hymn], PHONE)).toEqual({});
});

test('the first line is the first non-empty one, trimmed', () => {
  expect(firstLineOf('  Fitiavana tsy misy fepetra  \nandalana faharoa')).toBe('Fitiavana tsy misy fepetra');
});

describe('snippet under the verse', () => {
  test('a short note shows whole, without dots', () => {
    expect(noteSnippet('Fitiavana', PHONE)).toBe('Fitiavana');
    expect(noteSnippet('Tsy misy fepetra', PHONE)).toBe('Tsy misy fepetra');
  });

  test('a long note shows its first words, then …', () => {
    expect(noteSnippet('Fitiavana tsy misy fepetra ho an\'izao tontolo izao', PHONE)).toBe(
      'Fitiavana tsy misy…',
    );
  });

  test('a second line counts as more', () => {
    expect(noteSnippet('Fitiavana\nandalana faharoa', PHONE)).toBe('Fitiavana…');
  });

  test('long words are cut at a space within the character budget', () => {
    // 3 words but 43 characters: kept up to the last space before 28.
    expect(noteSnippet("Nitiavan'Andriamanitra tontolo fanamelohana", PHONE)).toBe(
      "Nitiavan'Andriamanitra…",
    );
  });

  test('a single word longer than the budget is hard-cut', () => {
    const word = 'a'.repeat(40);
    expect(noteSnippet(word, PHONE)).toBe(`${'a'.repeat(28)}…`);
  });

  test('tabs and runs of spaces count as one gap', () => {
    expect(noteSnippet('  Fitiavana \t tsy   misy  ', PHONE)).toBe('Fitiavana tsy misy');
  });
});

test('the budget grows with the width', () => {
  expect(noteSnippetBudget(360)).toEqual({maxWords: 3, maxChars: 28});
  expect(noteSnippetBudget(412)).toEqual({maxWords: 4, maxChars: 36});
  expect(noteSnippetBudget(800)).toEqual({maxWords: 6, maxChars: 52});
});
