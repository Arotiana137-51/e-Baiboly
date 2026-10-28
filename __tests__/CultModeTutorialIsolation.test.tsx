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

test('▶ resumes where ■ stopped, except after the last entry or an edit, and across a restart', async () => {
  const mount = async () => {
    let root!: ReturnType<typeof create>;
    await act(async () => {
      root = create(
        <CultModeProvider>
          <Capture />
        </CultModeProvider>,
      );
    });
    await flush();
    return root;
  };
  const step = async (fn: () => void) => {
    await act(async () => fn());
    await flush();
  };

  const first = await mount();
  for (const n of [1, 2, 3]) await step(() => api.addEntry({...realBible, chapter: n}));

  await step(() => api.toggleActive(true));
  await step(() => api.goNext());
  await step(() => api.toggleActive(false));
  await step(() => api.toggleActive(true));
  expect(api.currentIndex).toBe(1);

  // Closed mid-session: the reopened app is on the same entry.
  await act(async () => first.unmount());
  await mount();
  expect(api.isActive).toBe(true);
  expect(api.currentIndex).toBe(1);

  // Stopped on the last entry: the service was over.
  await step(() => api.goNext());
  await step(() => api.toggleActive(false));
  await step(() => api.toggleActive(true));
  expect(api.currentIndex).toBe(0);

  // Edited while stopped: a new service.
  await step(() => api.goNext());
  await step(() => api.toggleActive(false));
  await step(() => api.addEntry({...realBible, chapter: 4}));
  await step(() => api.toggleActive(true));
  expect(api.currentIndex).toBe(0);
});

test('a session keeps its entry when one above is removed, re-shows a tapped current entry, and ignores a bad saved index', async () => {
  await AsyncStorage.setItem('cult_mode_active_v1', JSON.stringify({isActive: false, index: -1}));
  await act(async () => {
    create(
      <CultModeProvider>
        <Capture />
      </CultModeProvider>,
    );
  });
  await flush();
  expect(api.currentIndex).toBe(0);

  const step = async (fn: () => void) => {
    await act(async () => fn());
    await flush();
  };
  for (const n of [1, 2, 3]) await step(() => api.addEntry({...realBible, chapter: n}));
  await step(() => api.toggleActive(true));
  await step(() => api.goTo(1));
  await step(() => api.removeEntry(api.entries[0].id));
  expect(api.currentEntry && 'chapter' in api.currentEntry ? api.currentEntry.chapter : null).toBe(2);

  const tick = api.revealTick;
  await step(() => api.goTo(api.currentIndex));
  expect(api.revealTick).toBe(tick + 1);
});
