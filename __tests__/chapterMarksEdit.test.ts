import {
  applyMarkToRange,
  eraseMarksInRange,
  rangeStyles,
  type ChapterMark,
} from '../src/utils/chapterMarks';

const mark = (start: number, end: number, style: ChapterMark['style'], color?: string): ChapterMark => ({
  id: `${style}-${start}-${end}`,
  start,
  end,
  style,
  ...(color ? {color} : null),
  createdAt: '2026-10-14T00:00:00.000Z',
});

const shape = (marks: ChapterMark[]) =>
  marks
    .map(m => `${m.style}${m.color ? `:${m.color}` : ''} ${m.start}-${m.end}`)
    .sort();

const YELLOW = '#FFEB3B';
const BLUE = '#2196F3';

describe('applyMarkToRange', () => {
  it('highlights a range with no marks yet', () => {
    expect(shape(applyMarkToRange([], {start: 2, end: 5}, 'highlight', YELLOW))).toEqual([
      `highlight:${YELLOW} 2-5`,
    ]);
  });

  it('replaces the colour underneath, keeping the rest of the old highlight', () => {
    const next = applyMarkToRange([mark(0, 10, 'highlight', YELLOW)], {start: 2, end: 5}, 'highlight', BLUE);
    expect(shape(next)).toEqual([
      `highlight:${BLUE} 2-5`,
      `highlight:${YELLOW} 0-2`,
      `highlight:${YELLOW} 5-10`,
    ]);
  });

  it('takes the colour off when it already covers the whole range', () => {
    const next = applyMarkToRange([mark(0, 10, 'highlight', YELLOW)], {start: 2, end: 5}, 'highlight', YELLOW);
    expect(shape(next)).toEqual([`highlight:${YELLOW} 0-2`, `highlight:${YELLOW} 5-10`]);
  });

  it('toggles bold, and adds it over a range only partly bold', () => {
    const bold = [mark(0, 10, 'bold')];
    expect(shape(applyMarkToRange(bold, {start: 0, end: 10}, 'bold'))).toEqual([]);
    expect(shape(applyMarkToRange(bold, {start: 5, end: 20}, 'bold'))).toEqual(['bold 0-5', 'bold 5-20']);
  });

  it('leaves the other styles alone', () => {
    const next = applyMarkToRange([mark(0, 10, 'italic')], {start: 2, end: 5}, 'bold');
    expect(shape(next)).toEqual(['bold 2-5', 'italic 0-10']);
  });

  it('gives the split-off part its own id', () => {
    const next = applyMarkToRange([mark(0, 10, 'highlight', YELLOW)], {start: 2, end: 5}, 'highlight', BLUE);
    expect(new Set(next.map(m => m.id)).size).toBe(next.length);
  });
});

describe('eraseMarksInRange', () => {
  it('cuts every style out of the range', () => {
    const next = eraseMarksInRange(
      [mark(0, 10, 'highlight', YELLOW), mark(5, 15, 'italic'), mark(20, 25, 'bold')],
      {start: 3, end: 12},
    );
    expect(shape(next)).toEqual(['bold 20-25', `highlight:${YELLOW} 0-3`, 'italic 12-15']);
  });
});

describe('rangeStyles', () => {
  it('reports the colour and styles covering the whole range', () => {
    const marks = [mark(0, 4, 'highlight', YELLOW), mark(4, 10, 'highlight', YELLOW), mark(0, 6, 'bold')];
    expect(rangeStyles(marks, {start: 1, end: 8})).toEqual({
      color: YELLOW,
      bold: false,
      italic: false,
      underline: false,
    });
    expect(rangeStyles(marks, {start: 1, end: 5}).bold).toBe(true);
  });

  it('has no colour when two colours share the range', () => {
    const marks = [mark(0, 4, 'highlight', YELLOW), mark(4, 10, 'highlight', BLUE)];
    expect(rangeStyles(marks, {start: 1, end: 8}).color).toBeUndefined();
  });
});
