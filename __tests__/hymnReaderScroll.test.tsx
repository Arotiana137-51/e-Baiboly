/**
 * The shipped 1.4.2 Bible reader crashed the app ("scrollToIndex out of range",
 * fatal, ~70 reports) when a scroll scheduled for one chapter ran against a
 * shorter list. The hymn reader schedules the same kind of scroll for its note
 * bubble (120 ms) and retries a failed one (220 ms); a hymn change in between
 * must not turn either into a crash.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import HymnReaderView from '../src/components/HymnReaderView';
import type { HymnVerse } from '../src/hooks/useHymnsData';

const hymn = (stanzas: number): HymnVerse[] =>
  Array.from({ length: stanzas }, (_, i) => ({
    id: i + 1,
    hymn_id: `h${stanzas}`,
    verse_number: i + 1,
    text: `andalana ${i + 1}`,
    is_chorus: false,
  }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const reader = (verses: HymnVerse[], bubble: number | null) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>
      <HymnReaderView
        hymnVerses={verses}
        isLoading={false}
        noteBubbleStanza={bubble}
        renderNoteBubble={() => null}
      />
    </ThemeProvider>
  </SafeAreaProvider>
);

let tree: ReactTestRenderer;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => tree.unmount());
  jest.useRealTimers();
});

test('the bubble scroll for stanza 12 does not run against the next, three-stanza hymn', async () => {
  await act(async () => {
    tree = create(reader(hymn(12), 12));
  });
  // The next hymn arrives before the 120 ms scroll fires.
  await act(async () => {
    tree.update(reader(hymn(3), null));
  });
  expect(() => act(() => jest.advanceTimersByTime(1000))).not.toThrow();
});

test('the retry of a failed scroll does not run against a hymn that got shorter', async () => {
  await act(async () => {
    tree = create(reader(hymn(12), 12));
  });
  // The scroll fires; nothing is laid out under Jest, so stanza 12 is not
  // measured yet and the list schedules its 220 ms retry.
  act(() => jest.advanceTimersByTime(150));
  await act(async () => {
    tree.update(reader(hymn(3), null));
  });
  expect(() => act(() => jest.advanceTimersByTime(1000))).not.toThrow();
});
