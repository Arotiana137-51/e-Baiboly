/**
 * Share card: the reference/range helpers the modal relies on, the hymn item
 * order (stanza, refrain, next stanza) and that the card renders at 1 and 5
 * items without the fit text losing its height constraint.
 */
import React from 'react';
import {act, create} from 'react-test-renderer';
import {Image, Text} from 'react-native';
import {ShareCard} from '../src/components/ShareCard';
import {pageOf, stripSlots} from '../src/components/LookPicker';
import {
  buildBibleShareItems,
  buildHymnShareItems,
  buildSelectionShareItems,
  buildShareReference,
  cleanShareText,
  LARGE_WHITE_MIN,
  lookForColor,
  lookForImage,
  MAX_SHARE_ITEMS,
  nightLook,
  PRESET_LOOKS,
  widgetInk,
  type ShareCardData,
} from '../src/utils/shareCard';
import {buildChapterDisplay} from '../src/utils/chapterMarks';
import {contrastRatio, getRelativeLuminance} from '../src/utils/colorUtils';
import {PRIMARY_COLOR_OPTIONS} from '../src/theme/personalizationPalette';
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

test.each(PRIMARY_COLOR_OPTIONS.map(o => [o.name, o.hex]))('%s: white on dark, black on light', (_name, hex) => {
  const look = lookForColor(hex);
  const other = look.text === '#FFFFFF' ? '#1B1B1B' : '#FFFFFF';
  expect(['#FFFFFF', '#1B1B1B']).toContain(look.text);
  expect(contrastRatio(look.text, hex)).toBeGreaterThanOrEqual(contrastRatio(other, hex));
  expect(look.accent).toBe(look.text);
  expect(contrastRatio(look.text, hex)).toBeGreaterThanOrEqual(3); // verse text is large
});

test('share card: only the nine lightest palette colours keep dark ink', () => {
  const dark = PRIMARY_COLOR_OPTIONS.filter(o => lookForColor(o.hex, 'large').text === '#1B1B1B').map(o => o.name);
  expect(dark.sort()).toEqual(
    ['Amber', 'Cyan', 'Fasika', 'Green', 'Lime', 'Liturgical Gold', 'Mofon-tany Maitso', 'Mustard', 'Teal'].sort(),
  );
  expect(LARGE_WHITE_MIN).toBe(2.5);
});

test('share card: white below 4.5:1 gets the soft shadow, the widget looks never do', () => {
  expect(lookForColor('#F97316', 'large').softShadow).toBe(true); // orange, 2.8:1
  expect(lookForColor('#04395E', 'large').softShadow).toBeUndefined(); // deep navy, 12:1
  expect(lookForColor('#F59E0B', 'large').softShadow).toBeUndefined(); // amber keeps dark ink
  expect(PRIMARY_COLOR_OPTIONS.some(o => lookForColor(o.hex).softShadow)).toBe(false);
});

test('share card: orange, blue and coral in white, the yellows stay dark', () => {
  expect(lookForColor('#F97316', 'large').text).toBe('#FFFFFF');
  expect(lookForColor('#0A84FF', 'large').text).toBe('#FFFFFF');
  expect(lookForColor('#F43F5E', 'large').text).toBe('#FFFFFF');
  expect(lookForColor('#F59E0B', 'large').text).toBe('#1B1B1B');
  expect(lookForColor('#84CC16', 'large').text).toBe('#1B1B1B');
});

test.each(
  [...PRESET_LOOKS, ...PRIMARY_COLOR_OPTIONS.map(o => lookForColor(o.hex))].flatMap(l => [
    [l.background, 'white', l] as const,
    [l.background, 'dark', l] as const,
  ]),
)('%s in %s text reads at 4.5:1 on its adjusted colour', (_bg, ink, look) => {
  const inked = widgetInk(look, ink);
  expect(inked.text).toBe(ink === 'white' ? '#FFFFFF' : '#1B1B1B');
  expect(inked.accent).toBe(inked.text);
  expect(contrastRatio(inked.text, inked.background)).toBeGreaterThanOrEqual(4.5);
});

test('auto keeps a colour look as it is; a photo gets a veil matching its ink', () => {
  const look = lookForColor('#007991');
  expect(widgetInk(look, 'auto')).toEqual(look);
  const photo = lookForImage('file:///bg.jpg');
  expect(widgetInk(photo, 'auto')).toMatchObject({text: '#FFFFFF', veil: {color: '#000000', alpha: 0.45}});
  expect(widgetInk(photo, 'dark')).toMatchObject({text: '#1B1B1B', veil: {color: '#FFFFFF', alpha: 0.6}});
});

test.each([...PRESET_LOOKS, ...PRIMARY_COLOR_OPTIONS.map(o => lookForColor(o.hex))].map(l => [l.background, l]))(
  'night look of %s is dark and readable',
  (_bg, look) => {
    const night = nightLook(look);
    expect(getRelativeLuminance(night.background)).toBeLessThan(0.2);
    expect(contrastRatio(night.text, night.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(night.accent, night.background)).toBeGreaterThanOrEqual(4.5);
  },
);

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

describe('footnotes on the card', () => {
  it('drops the marks in a verse', () => {
    expect(cleanShareText('tsy manam-pahendrena*, aoka izy')).toBe('tsy manam-pahendrena, aoka izy');
    expect(cleanShareText('Indreo (Inty*) mpanomponao')).toBe('Indreo (Inty) mpanomponao');
  });

  it("drops a hymn's note with the lines after it (FFPM 95, 282)", () => {
    const ffpm95 =
      'Ny hazo nihomboanao\nDia voninahitray;\nNy nanalam-baraka Anao\nNo isandratanay ! (in-3) *\n' +
      "Ny nanalam-baraka Anao.\n\n*) Ho an’ny feony (1) ihany";
    expect(cleanShareText(ffpm95)).toBe(
      'Ny hazo nihomboanao\nDia voninahitray;\nNy nanalam-baraka Anao\nNo isandratanay ! (in-3)\nNy nanalam-baraka Anao.',
    );
    const ffpm282 = 'Dia raiso ny mpanomponao\nHiala sasatra Aminao !\n\n*) Inty, raha olona iray no\natokana';
    expect(cleanShareText(ffpm282)).toBe('Dia raiso ny mpanomponao\nHiala sasatra Aminao !');
    expect(cleanShareText('Hanolotra ny tenanay *\nHiasa ho Anao.\n\n* na Haniraka ny namanay')).toBe(
      'Hanolotra ny tenanay\nHiasa ho Anao.',
    );
  });

  it('drops a lone mark line, and a piece that is only a mark (Fifohazana 147)', () => {
    expect(cleanShareText('*\nMamiko tokoa na dia ho faty,')).toBe('Mamiko tokoa na dia ho faty,');
    expect(cleanShareText('*')).toBe('');
  });
});

describe('share strip and colour pages', () => {
  it('shows the first colours, a colour picked further on taking the last place', () => {
    expect(stripSlots(4, 1)).toEqual([0, 1, 2, 3]);
    expect(stripSlots(4, -1)).toEqual([0, 1, 2, 3]);
    expect(stripSlots(4, 10)).toEqual([0, 1, 2, 10]);
  });

  it('opens the grid on the chosen colour page', () => {
    expect(pageOf(PRESET_LOOKS[0])).toBe(0);
    expect(pageOf(lookForImage('file:///bg.jpg'))).toBe(0);
    // Parchment, black, then the palette: orange is the 11th swatch, page 2.
    expect(pageOf(lookForColor('#F97316', 'large'))).toBe(1);
  });
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
