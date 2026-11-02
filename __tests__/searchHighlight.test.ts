import { findHighlightRanges, normalizeForHighlight, segmentTextForHighlight } from '../src/utils/searchHighlight';

test('highlight grows to the whole word', () => {
  const text = 'Ary Jehovah nanao hoe';
  const ranges = findHighlightRanges(text, normalizeForHighlight('hov'));
  expect(segmentTextForHighlight(text, ranges).filter(s => s.match).map(s => s.text)).toEqual(['Jehovah']);
});
