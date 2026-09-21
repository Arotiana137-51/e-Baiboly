/**
 * Guards the cult-tutorial playlist isolation: the walkthrough's demo entries
 * must NEVER overwrite the user's real saved playlist, and the real playlist
 * must be restored when the tutorial ends. Regression test for the bug where
 * finishing the tutorial called clearAll() and wiped a real worship playlist.
 */
import React from 'react';
import {act, create} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CultModeProvider,
  useCultMode,
} from '../src/contexts/CultModeContext';

const PLAYLIST_KEY = 'cult_playlist_v1';

const realBible = {
  type: 'bible' as const,
  bookId: 1,
  bookName: 'Genesisy',
  chapter: 1,
  verseStart: 1,
  verseEnd: 1,
  isWholeChapter: false,
  label: 'Genesisy 1:1',
};
const demoHymn = {
  type: 'hymn' as const,
  hymnId: 'h164',
  category: 'FFPM',
  hymnNumber: 164,
  title: 'Demo',
  label: 'FFPM 164',
};

// Capture the live context so the test can drive it imperatively.
let api: ReturnType<typeof useCultMode>;
const Capture = () => {
  api = useCultMode();
  return null;
};

const flush = async () => {
  // let the hydrate effect + any pending persists settle
  await act(async () => {
    await Promise.resolve();
  });
};

const persistedEntries = async () => {
  const raw = await AsyncStorage.getItem(PLAYLIST_KEY);
  return raw ? JSON.parse(raw).entries : [];
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('demo entries added during the tutorial never persist over the real playlist, which is restored on end', async () => {
  await act(async () => {
    create(
      <CultModeProvider>
        <Capture />
      </CultModeProvider>,
    );
  });
  await flush();

  // User builds a real playlist (persisted).
  await act(async () => api.addEntry(realBible));
  await flush();
  expect(api.entries).toHaveLength(1);
  expect(await persistedEntries()).toHaveLength(1);

  // Tutorial starts: live list is emptied, real playlist untouched on disk.
  await act(async () => api.beginTutorial());
  await flush();
  expect(api.entries).toHaveLength(0);
  expect(await persistedEntries()).toHaveLength(1);

  // Demo entry added during the walkthrough shows live but is NOT persisted.
  await act(async () => api.addEntry(demoHymn));
  await flush();
  expect(api.entries).toHaveLength(1);
  expect(api.entries[0].label).toBe('FFPM 164');
  expect(await persistedEntries()).toHaveLength(1);
  expect((await persistedEntries())[0].label).toBe('Genesisy 1:1');

  // Tutorial ends: real playlist restored, demo gone.
  await act(async () => api.endTutorial());
  await flush();
  expect(api.entries).toHaveLength(1);
  expect(api.entries[0].label).toBe('Genesisy 1:1');
});
