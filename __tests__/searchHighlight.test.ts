import { findHighlightRanges, normalizeForHighlight, segmentTextForHighlight } from '../src/utils/searchHighlight';

test('highlight grows to the whole word', () => {
  const text = 'Ary Jehovah nanao hoe';
  const ranges = findHighlightRanges(text, normalizeForHighlight('hov'));
  expect(segmentTextForHighlight(text, ranges).filter(s => s.match).map(s => s.text)).toEqual(['Jehovah']);
});

test('whole words only: the word itself, not the longer ones it starts', () => {
  const text = 'Tia Anao aho, ry Tompo, fa tiako ny lalanao';
  const ranges = findHighlightRanges(text, normalizeForHighlight('tia'), true);
  expect(segmentTextForHighlight(text, ranges).filter(s => s.match).map(s => s.text)).toEqual(['Tia']);
});
