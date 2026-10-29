/**
 * The hymn's double-tap sheet is the Bible's: it names the stanza and offers
 * the stanza's rows only for a stanza; the reader marks that stanza.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import HymnActionPopover from '../src/components/HymnActionPopover';
import HymnReaderView from '../src/components/HymnReaderView';
import type { Hymn, HymnVerse } from '../src/hooks/useHymnsData';
import { t } from '../src/i18n/strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const wrap = (node: React.ReactNode) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>{node}</ThemeProvider>
  </SafeAreaProvider>
);

const hymn = { id: 'ffpm_12', number: 12, category: 'ffpm', title: 'Hira' } as Hymn;
const noop = () => {};

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map(node => [node.props.children].flat().join(''));

let tree: ReactTestRenderer;
afterEach(() => act(() => tree.unmount()));

const sheet = (stanzaNumber: number | null) =>
  wrap(
    <HymnActionPopover
      visible
      hymn={hymn}
      stanzaNumber={stanzaNumber}
      stanzaText={stanzaNumber === null ? null : 'andalana'}
      onClose={noop}
      onNote={noop}
      onAddToFavorites={noop}
      onShare={noop}
      onReportIssue={noop}
    />,
  );

test('a double-tapped chorus: named, with its own note, share and report rows', async () => {
  await act(async () => {
    tree = create(sheet(0));
  });
  const shown = texts(tree);
  expect(shown.some(s => s.includes('FFPM') && s.endsWith('· Refrain'))).toBe(true);
  for (const label of [t('actions.noteAdd'), t('actions.hymnNoteAdd'), t('actions.addToFavorites'), t('actions.share'), t('actions.reportQuestion')]) {
    expect(shown).toContain(label);
  }
});

test('the whole hymn only: no stanza rows', async () => {
  await act(async () => {
    tree = create(sheet(null));
  });
  const shown = texts(tree);
  expect(shown).toContain(t('actions.hymnNoteAdd'));
  expect(shown).not.toContain(t('actions.noteAdd'));
  expect(shown).not.toContain(t('actions.share'));
  expect(shown).not.toContain(t('actions.reportQuestion'));
});

test('the reader marks the stanza the sheet is for', async () => {
  const verses: HymnVerse[] = [1, 2, 3].map(n => ({
    id: n,
    hymn_id: 'ffpm_12',
    verse_number: n,
    text: `andalana ${n}`,
    is_chorus: false,
  }));
  await act(async () => {
    tree = create(wrap(<HymnReaderView hymnVerses={verses} isLoading={false} selectedStanza={2} sheetHeight={300} />));
  });
  // Pressable is a memo'd forwardRef: found by name, not by type.
  const marked = tree.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      ((node.type as {displayName?: string}).displayName ?? (node.type as {name?: string}).name) === 'Pressable' &&
      StyleSheet.flatten(node.props.style)?.backgroundColor === 'rgba(10, 132, 255, 0.16)',
  );
  expect(marked).toHaveLength(1);
  expect(texts(tree)).toContain('2');
});
