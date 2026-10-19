/**
 * Typing runs a search 300 ms after each pause, and clearing the debounce
 * timer cannot stop a search already running. On a slow phone a search for
 * an earlier, shorter query ("fitia" matches more and takes longer) can end
 * after the one for what is now typed, and must not replace its results.
 * Both search boxes work this way: the search screen and the book picker.
 */
import React from 'react';
import { TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import GlobalSearchScreen from '../src/screens/GlobalSearchScreen';
import BibleSelectionModal from '../src/components/BibleSelectionModal';
import { TutorialProvider } from '../src/contexts/TutorialContext';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ setOptions: jest.fn(), navigate: jest.fn() }),
}));

// Each search waits until the test settles it.
const mockPending = new Map<string, (r: unknown) => void>();
const mockSearch = (query: string) =>
  new Promise(resolve => mockPending.set(query, resolve));

jest.mock('../src/hooks/useGlobalSearch', () => ({
  useGlobalSearch: () => ({ search: mockSearch, isLoading: false }),
}));
jest.mock('../src/hooks/useBibleSearch', () => ({
  useBibleSearch: () => ({ searchBible: mockSearch, isLoading: false }),
}));
jest.mock('../src/hooks/useBibleData', () => ({
  useBibleData: () => ({
    books: [],
    isLoading: false,
    getVerseCount: async () => 0,
  }),
}));

let tree: ReactTestRenderer;

const render = async (screen: React.ReactElement) => {
  await act(async () => {
    tree = create(<ThemeProvider>{screen}</ThemeProvider>);
  });
};
const type = async (text: string) => {
  await act(async () => {
    tree.root.findByType(TextInput).props.onChangeText(text);
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
};
const settle = async (query: string, results: unknown) => {
  await act(async () => {
    mockPending.get(query)!(results);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockPending.clear();
});

afterEach(() => {
  act(() => tree.unmount());
  jest.useRealTimers();
});

describe('search screen', () => {
  // Collapsed, the Bible section shows its count: two results told apart by it.
  const result = (verseCount: number) => ({
    bible: [{ bookId: 43, bookName: 'Jaona', testament: 'old', verseCount }],
    hymns: [],
  });
  const CURRENT = result(3);
  const LATE = result(7);
  const shows = (r: typeof CURRENT) =>
    tree.root.findAll(
      n =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.endsWith(`, ${r.bible[0].verseCount}`),
    ).length > 0;

  beforeEach(() => render(<GlobalSearchScreen />));

  test('the results of a search show (the harness sees them)', async () => {
    await type('fitiavana');
    await settle('fitiavana', CURRENT);
    expect(shows(CURRENT)).toBe(true);
  });

  test('a search that ends late does not replace the results of what is typed now', async () => {
    await type('fitia');
    await type('fitiavana');
    await settle('fitiavana', CURRENT);
    await settle('fitia', LATE);
    expect(shows(CURRENT)).toBe(true);
    expect(shows(LATE)).toBe(false);
  });

  test('results that arrive after the box was cleared are not shown', async () => {
    await type('fitia');
    await type('');
    await settle('fitia', LATE);
    expect(shows(LATE)).toBe(false);
  });
});

describe('book picker, searching verse words', () => {
  const result = (matchedText: string) => [
    {
      bookId: 43,
      bookName: 'Jaona',
      verseCount: 1,
      matchedChapter: 3,
      matchedVerseNumber: 16,
      matchedText,
    },
  ];
  const shows = (text: string) =>
    tree.root.findAll(n => n.props.children === text).length > 0;

  beforeEach(() =>
    render(
      <TutorialProvider>
        <BibleSelectionModal onClose={() => {}} onBibleSelect={() => {}} />
      </TutorialProvider>,
    ),
  );

  test('the results of a search show (the harness sees them)', async () => {
    await type('fitiavana');
    await settle('fitiavana', result('current'));
    expect(shows('current')).toBe(true);
  });

  test('a search that ends late does not replace the results of what is typed now', async () => {
    await type('fitia');
    await type('fitiavana');
    await settle('fitiavana', result('current'));
    await settle('fitia', result('late'));
    expect(shows('current')).toBe(true);
    expect(shows('late')).toBe(false);
  });
});
