/**
 * Notes are the user's own writing, so the store must keep them across
 * relaunches, put a deleted note back on undo, and never let the highlight
 * storage drop an old note before the migration has moved it.
 */
import React from 'react';
import {act, create} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {JesusNameProvider} from '../src/contexts/JesusNameContext';
import {NotesProvider, useNotes} from '../src/contexts/NotesContext';
import {useChapterMarks} from '../src/hooks/useChapterMarks';
import type {Note} from '../src/types/notes';

// The migration is marked done in these tests, so no query ever runs.
jest.mock('../src/services/database/DatabaseService', () => ({
  bibleDatabaseService: {initDatabase: jest.fn(), executeQuery: jest.fn()},
  hymnsDatabaseService: {initDatabase: jest.fn(), executeQuery: jest.fn()},
}));

const NOTES_KEY = 'notes_v1';

const note = (id: string, verse: number): Note => ({
  id,
  anchor: {kind: 'bible', bookId: 43, chapter: 3, verseStart: verse, verseEnd: verse},
  text: `naoty ${id}`,
  createdAt: '2026-10-13T08:00:00.000Z',
  updatedAt: '2026-10-13T08:00:00.000Z',
});

let api: ReturnType<typeof useNotes>;
const Capture = () => {
  api = useNotes();
  return null;
};

const settle = () =>
  act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });

const mount = async () => {
  await act(async () => {
    create(
      <JesusNameProvider>
        <NotesProvider>
          <Capture />
        </NotesProvider>
      </JesusNameProvider>,
    );
  });
  await settle();
  await settle();
};

const stored = async (): Promise<Note[]> => JSON.parse((await AsyncStorage.getItem(NOTES_KEY)) ?? '[]');

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('notes_migrated_v1', '1');
});

test('saved notes survive a relaunch', async () => {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify([note('a', 16)]));
  await mount();
  expect(api.isLoading).toBe(false);
  expect(api.notes.map(n => n.id)).toEqual(['a']);

  await act(async () => api.saveNote(note('b', 17)));
  await settle();
  expect((await stored()).map(n => n.id)).toEqual(['a', 'b']);

  await mount();
  expect(api.notes.map(n => n.id)).toEqual(['a', 'b']);
});

test('editing replaces the note in place', async () => {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify([note('a', 16)]));
  await mount();
  await act(async () => api.saveNote({...note('a', 16), text: 'novaina'}));
  await settle();
  expect(await stored()).toEqual([{...note('a', 16), text: 'novaina'}]);
});

test('delete then undo brings the same note back', async () => {
  const a = note('a', 16);
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify([a]));
  await mount();

  await act(async () => api.removeNote('a'));
  await settle();
  expect(await stored()).toEqual([]);

  await act(async () => api.saveNote(a));
  await settle();
  expect(await stored()).toEqual([a]);
});

// --- highlight storage keeps old note marks until the migration moves them ---

let marksApi: ReturnType<typeof useChapterMarks>;
const MarksCapture = () => {
  marksApi = useChapterMarks(43, 3);
  return null;
};

test('saving highlights never drops a not-yet-migrated note mark', async () => {
  const highlight = {id: 'h', start: 0, end: 4, style: 'highlight', color: '#FFEB3B', createdAt: 'x'};
  const oldNote = {id: 'n', start: 10, end: 20, style: 'note', note: 'taloha', createdAt: 'x'};
  await AsyncStorage.setItem('chapterMarks:43:3', JSON.stringify([highlight, oldNote]));

  await act(async () => {
    create(<MarksCapture />);
  });
  await settle();
  // The editor only ever sees highlights...
  expect(marksApi.marks.map(m => m.id)).toEqual(['h']);

  // ...and clearing them all still leaves the old note in storage.
  await act(async () => marksApi.setAllMarks([]));
  expect(JSON.parse((await AsyncStorage.getItem('chapterMarks:43:3'))!)).toEqual([oldNote]);
});
