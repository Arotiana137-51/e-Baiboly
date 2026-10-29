/**
 * The readers on the phone's own word selection (SelectionMenu): a selection
 * brings the highlight bubble, whose colour lands on the selected words of
 * the chapter or hymn; a double-tap on a chorus opens the sheet for the copy
 * tapped. The native module is replaced by its events.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { TutorialProvider } from '../src/contexts/TutorialContext';
import { JesusNameProvider } from '../src/contexts/JesusNameContext';
import BibleReaderView from '../src/components/BibleReaderView';
import HymnReaderView from '../src/components/HymnReaderView';
import { buildChapterDisplay, buildHymnDisplay, HYMN_CHORUS_LABEL, type ChapterMark } from '../src/utils/chapterMarks';
import type { NativeSelection } from '../src/services/selectionMenu';
import type { BibleVerse } from '../src/hooks/useBibleData';
import type { HymnVerse } from '../src/hooks/useHymnsData';
import { buildPassages } from '../src/utils/chapterPassage';
import { t } from '../src/i18n/strings';
// The methods Jest's mocked View shares: measured here as a reader on screen.
// Only reachable by its path.
// eslint-disable-next-line @react-native/no-deep-imports
import MockNativeMethods from 'react-native/jest/MockNativeMethods';

type Measure = (cb: (x: number, y: number, w: number, h: number) => void) => void;
// A selectable text as Jest renders it: a mocked native component.
type Node = { props: { children?: unknown }; text: string; measureInWindow: Measure };

const mockNative = {
  nextTag: 100,
  texts: new Map<number, Node>(),
  onSelection: null as ((tag: number, selection: NativeSelection | null) => void) | null,
  onDoubleTap: null as ((tap: { tag: number; offset: number }) => void) | null,
};

jest.mock('../src/services/selectionMenu', () => ({
  ...jest.requireActual('../src/services/selectionMenu'),
  NATIVE_SELECTION: true,
  // The mocked native text never answers a measure: it sits 200 down.
  attachSelectionMenu: (instance: Node | null) => {
    if (!instance) return null;
    const tag = mockNative.nextTag++;
    instance.measureInWindow = cb => cb(0, 200, 360, 120);
    instance.text = mockTextOf(instance.props.children);
    mockNative.texts.set(tag, instance);
    return tag;
  },
  clearSelection: jest.fn(),
  onSelectionChange: (listener: typeof mockNative.onSelection) => {
    mockNative.onSelection = listener;
    return () => {};
  },
  onTextDoubleTap: (listener: typeof mockNative.onDoubleTap) => {
    mockNative.onDoubleTap = listener;
    return { remove: () => {} };
  },
  skipLines: jest.fn(),
}));

// The words under an element, as the native text would hold them.
const mockTextOf = (children: unknown): string => {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(mockTextOf).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return mockTextOf((children as { props: { children?: unknown } }).props.children);
  }
  return '';
};

const tagOf = (text: string) => {
  const found = [...mockNative.texts].find(([, node]) => node.text === text);
  if (!found) throw new Error(`no selectable text "${text}"`);
  return found[0];
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let tree: ReactTestRenderer;
const render = async (node: React.ReactElement) => {
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider>
          <JesusNameProvider>
            <TutorialProvider>{node}</TutorialProvider>
          </JesusNameProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
  });
};

beforeEach(() => {
  (MockNativeMethods.measureInWindow as jest.Mock).mockImplementation((cb: Parameters<Measure>[0]) =>
    cb(0, 0, 390, 800),
  );
  mockNative.texts.clear();
  mockNative.onSelection = null;
  mockNative.onDoubleTap = null;
});
afterEach(() => act(() => tree.unmount()));

// Selects text [start, end) of a selectable text, then takes the bubble's
// first colour.
const highlight = async (tag: number, start: number, end: number) => {
  await act(async () => {
    mockNative.onSelection?.(tag, { tag, start, end, x: 40, top: 10, bottom: 30 });
  });
  const swatches = tree.root.findAll(
    n => n.props.accessibilityLabel === t('highlight.color') && typeof n.props.onPress === 'function',
  );
  expect(swatches.length).toBeGreaterThan(0);
  await act(async () => {
    swatches[0].props.onPress();
  });
};

test('the Bible: a colour lands on the selected word of the chapter', async () => {
  const verses: BibleVerse[] = [
    { id: 1, book_id: 43, chapter: 3, verse_number: 15, text: 'Mba hanana fiainana mandrakizay.' },
    { id: 2, book_id: 43, chapter: 3, verse_number: 16, text: 'Fa toy izao no nitiavan Andriamanitra izao tontolo izao.' },
  ];
  const onChange = jest.fn<void, [ChapterMark[]]>();
  await render(
    <BibleReaderView verses={verses} isLoading={false} chapterMarks={[]} onChapterMarksChange={onChange} />,
  );
  // The passage's string, which the selection's offsets index.
  const [passage] = buildPassages(verses, text => text, {}, { breakBefore: null, maxVerses: 50 });
  const chars = Array<string>(passage.length).fill(' ');
  for (const piece of passage.pieces) chars.splice(piece.start, piece.text.length, ...piece.text);
  const [tag] = [...mockNative.texts][0];
  const word = 'Andriamanitra';
  const at = chars.join('').indexOf(word);
  expect(at).toBeGreaterThan(0);
  await highlight(tag, at, at + word.length);

  expect(onChange).toHaveBeenCalledTimes(1);
  const [mark] = onChange.mock.calls[0][0];
  const chapter = buildChapterDisplay(verses, text => text).chapterText;
  expect(mark.style).toBe('highlight');
  expect(chapter.slice(mark.start, mark.end)).toBe(word);
});

const hymnVerses: HymnVerse[] = [
  { id: 1, hymn_id: 'ffpm_1', verse_number: 1, text: 'Andeha isika hidera', is_chorus: false },
  { id: 2, hymn_id: 'ffpm_1', verse_number: 2, text: 'Ny Tompo be fitia', is_chorus: false },
  { id: 3, hymn_id: 'ffpm_1', verse_number: 0, text: 'Haleloia, Amena', is_chorus: true },
];

test('a hymn: a colour on stanza 2 lands on its words in the hymn', async () => {
  const onChange = jest.fn<void, [ChapterMark[]]>();
  await render(<HymnReaderView hymnVerses={hymnVerses} isLoading={false} marks={[]} onMarksChange={onChange} />);
  const word = 'fitia';
  const tag = tagOf('Ny Tompo be fitia');
  const at = 'Ny Tompo be fitia'.indexOf(word);
  await highlight(tag, at, at + word.length);

  const [mark] = onChange.mock.calls[0][0];
  const hymn = buildHymnDisplay(hymnVerses, HYMN_CHORUS_LABEL).chapterText;
  expect(hymn.slice(mark.start, mark.end)).toBe(word);
});

test('a hymn: the chorus double-tapped after stanza 2 is the one marked', async () => {
  const onDoubleTap = jest.fn();
  const reader = (selectedStanza: number | null) => (
    <HymnReaderView
      hymnVerses={hymnVerses}
      isLoading={false}
      onHymnDoubleTap={onDoubleTap}
      onMarksChange={() => {}}
      selectedStanza={selectedStanza}
      sheetHeight={selectedStanza == null ? 0 : 300}
    />
  );
  await render(reader(null));
  // The chorus is drawn after each stanza: its second copy is the later tag.
  const chorusTags = [...mockNative.texts].filter(([, node]) => node.text === 'Haleloia, Amena').map(([tag]) => tag);
  expect(chorusTags).toHaveLength(2);
  await act(async () => {
    mockNative.onDoubleTap?.({ tag: chorusTags[1], offset: 2 });
  });
  expect(onDoubleTap).toHaveBeenCalledWith(0, 'Haleloia, Amena');

  await act(async () => {
    tree.update(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider>
          <JesusNameProvider>
            <TutorialProvider>{reader(0)}</TutorialProvider>
          </JesusNameProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
  });
  const marked = tree.root.findAll(
    n =>
      typeof n.type === 'string' &&
      StyleSheet.flatten(n.props.style)?.backgroundColor === 'rgba(10, 132, 255, 0.16)',
  );
  expect(marked).toHaveLength(1);
  // The marked card is the chorus's second copy, the one after stanza 2.
  const choruses = tree.root.findAll(
    n =>
      typeof n.type === 'string' &&
      StyleSheet.flatten(n.props.style)?.borderRadius === 12 &&
      mockTextOf(n.props.children).includes(HYMN_CHORUS_LABEL),
  );
  expect(choruses).toHaveLength(2);
  expect(choruses.indexOf(marked[0])).toBe(1);
});
