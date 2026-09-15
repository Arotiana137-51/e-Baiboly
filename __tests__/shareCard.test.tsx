/**
 * Share card: the reference/range helpers the modal relies on, the hymn item
 * order (stanza, refrain, next stanza) and that the card renders at 1 and 5
 * items without the fit text losing its height constraint.
 */
import React from 'react';
import {act, create} from 'react-test-renderer';
import {Image, Text} from 'react-native';
import {ShareCard} from '../src/components/ShareCard';
import {
  buildBibleShareItems,
  buildHymnShareItems,
  buildSelectionShareItems,
  buildShareReference,
  buildShareText,
  lookForColor,
  lookForImage,
  MAX_SHARE_ITEMS,
  PRESET_LOOKS,
  type ShareCardData,
} from '../src/utils/shareCard';
import {buildChapterDisplay} from '../src/utils/chapterMarks';
import type {BibleVerse} from '../src/hooks/useBibleData';
import type {HymnVerse} from '../src/hooks/useHymnsData';

const verse = (n: number, text = `Andininy ${n}`): BibleVerse => ({
  id: 100 + n,
  book_id: 43,
  chapter: 3,
  verse_number: n,
  text,
});

const bibleData = (count: number): ShareCardData => ({
  reference: 'Jaona 3:',
  appendRange: true,
  rangeStepper: true,
  items: buildBibleShareItems(
    [verse(15), verse(16), verse(17), verse(18), verse(19), verse(20), verse(21)],
    1,
    s => s,
  ).slice(0, count),
});

test('bible reference appends a single verse or a range', () => {
  expect(buildShareReference(bibleData(5), 1)).toBe('Jaona 3:16');
  expect(buildShareReference(bibleData(5), 3)).toBe('Jaona 3:16-18');
  expect(buildShareText(bibleData(5), 1)).toBe('Andininy 16\n\nJaona 3:16');
  expect(buildShareText(bibleData(5), 2)).toBe('16 Andininy 16\n17 Andininy 17\n\nJaona 3:16-17');
});

test('bible items are capped and stripped of markup', () => {
  const items = buildBibleShareItems(
    [verse(1, 'Voalohany [*fanamarihana] <n>manokana</n>'), ...Array.from({length: 9}, (_, i) => verse(i + 2))],
    0,
    s => s,
  );
  expect(items).toHaveLength(MAX_SHARE_ITEMS);
  expect(items[0]).toEqual({label: '1', text: 'Voalohany manokana'});
});

test('hymn items go stanza, refrain, next stanza and keep a fixed reference', () => {
  const hymnVerses: HymnVerse[] = [
    {id: 1, hymn_id: 'ffpm-1', verse_number: 1, text: 'Andininy 1', is_chorus: false},
    {id: 2, hymn_id: 'ffpm-1', verse_number: 0, text: 'Isan-andininy', is_chorus: true},
    {id: 3, hymn_id: 'ffpm-1', verse_number: 2, text: 'Andininy 2', is_chorus: false},
    {id: 4, hymn_id: 'ffpm-1', verse_number: 3, text: 'Andininy 3', is_chorus: false},
  ];
  const items = buildHymnShareItems(hymnVerses, 2, 'Refrain');
  expect(items.map(i => i.label)).toEqual(['2', 'Refrain', '3']);

  const data: ShareCardData = {
    reference: 'Fihirana 1 · Lohateny',
    appendRange: false,
    rangeStepper: true,
    items,
  };
  expect(buildShareReference(data, 3)).toBe('Fihirana 1 · Lohateny');
  expect(buildHymnShareItems(hymnVerses, 9, 'Refrain')).toEqual([]);
});

test('editor selection is split per verse and keeps only the selected slice', () => {
  const chapter = buildChapterDisplay(
    [verse(1, 'Voalohany ny teny'), verse(2, 'Faharoa ny teny'), verse(3, 'Fahatelo ny teny')],
    s => s,
  );
  const [v1, v2, v3] = chapter.verseSpans;

  // Half of verse 2 → one item, partial text, no range in the reference.
  const half = buildSelectionShareItems(chapter, v2.start + 8, v2.end);
  expect(half).toEqual([{label: '2', text: 'ny teny'}]);
  const halfData: ShareCardData = {reference: 'Jaona 3:', appendRange: true, rangeStepper: false, items: half};
  expect(buildShareReference(halfData, half.length)).toBe('Jaona 3:2');

  // Tail of verse 1 through head of verse 3 → three items, boundaries trimmed.
  const run = buildSelectionShareItems(chapter, v1.end - 4, v3.start + 8);
  expect(run.map(i => i.label)).toEqual(['1', '2', '3']);
  expect(run[0].text).toBe('teny');
  expect(run[2].text).toBe('Fahatelo');
  const runData: ShareCardData = {reference: 'Jaona 3:', appendRange: true, rangeStepper: false, items: run};
  expect(buildShareReference(runData, run.length)).toBe('Jaona 3:1-3');

  // A selection made of only the separator yields nothing to share.
  expect(buildSelectionShareItems(chapter, v1.end, v2.start)).toEqual([]);
});

test('background colour picks readable ink; a photo always gets the light ink', () => {
  expect(lookForColor('#0D2818').text).toBe('#FFFFFF');
  expect(lookForColor('#F6EBD9').text).toBe('#1B1B1B');
  expect(lookForImage('file:///bg.jpg')).toMatchObject({text: '#FFFFFF', imageUri: 'file:///bg.jpg'});
});

test('card on a photo paints the image under a scrim', () => {
  const data = bibleData(1);
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <ShareCard items={data.items} reference="Jaona 3:16" look={lookForImage('file:///bg.jpg')} />,
    );
  });
  const sources = tree.root.findAll(node => node.type === Image).map(node => node.props.source.uri);
  expect(sources).toContain('file:///bg.jpg');
  // The shade overlay is inline data, never a bundled asset or a network fetch.
  expect(sources.filter(uri => uri.startsWith('data:image/png;base64,'))).toHaveLength(1);
});

test.each([1, 5])('card renders %i item(s) with a height-bounded auto-fit body', count => {
  const data = bibleData(count);
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <ShareCard items={data.items} reference={buildShareReference(data, count)} look={PRESET_LOOKS[0]} />,
    );
  });
  const fit = tree.root.findAll(node => node.type === Text && node.props.adjustsFontSizeToFit === true);
  expect(fit).toHaveLength(1);
  const style = [fit[0].props.style].flat(Infinity).filter(Boolean) as Record<string, unknown>[];
  expect(style.some(s => typeof s.maxHeight === 'number')).toBe(true);
  // Labels only make sense on a range.
  const labelled = fit[0].findAll(node => node.type === Text && node.props.children === '16 ');
  expect(labelled.length).toBe(count > 1 ? 1 : 0);
});
