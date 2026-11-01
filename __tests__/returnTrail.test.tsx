import React from 'react';
import {act, create} from 'react-test-renderer';
import {useReturnTrail} from '../src/hooks/useReturnTrail';
import {
  MAX_RETURN_TRAIL,
  formatReaderSpot,
  pushReturnSpot,
  type ReaderSpot,
} from '../src/utils/returnTrail';

const spot = (verse: number, extra: Partial<ReaderSpot> = {}): ReaderSpot => ({
  bookId: 40,
  bookName: 'Matio',
  chapter: 2,
  verse,
  range: null,
  ...extra,
});

describe('pushReturnSpot', () => {
  it('stacks spots newest last', () => {
    expect(pushReturnSpot(pushReturnSpot([], spot(5)), spot(15))).toEqual([spot(5), spot(15)]);
  });

  it('keeps one step for two references tapped from the same verse', () => {
    expect(pushReturnSpot([spot(5)], spot(5))).toEqual([spot(5)]);
  });

  it('tells a narrowed reader apart from the whole chapter', () => {
    const narrowed = spot(5, {range: {start: 5, end: 6}});
    expect(pushReturnSpot([spot(5)], narrowed)).toHaveLength(2);
  });

  it('drops the oldest steps past the cap', () => {
    let trail: ReaderSpot[] = [];
    for (let v = 1; v <= MAX_RETURN_TRAIL + 3; v++) trail = pushReturnSpot(trail, spot(v));
    expect(trail).toHaveLength(MAX_RETURN_TRAIL);
    expect(trail[0].verse).toBe(4);
  });
});

it('formats a spot as book chapter:verse', () => {
  expect(formatReaderSpot(spot(5))).toBe('Matio 2:5');
});

// Mounts the hook and hands back a live view of what it returns.
const renderHook = <T,>(hook: () => T) => {
  const result = {current: null as unknown as T};
  const Probe = () => {
    result.current = hook();
    return null;
  };
  act(() => {
    create(<Probe />);
  });
  return {result};
};

describe('useReturnTrail', () => {
  it('pops back through the trail, newest first', () => {
    const {result} = renderHook(() => useReturnTrail());
    act(() => {
      result.current.push(spot(5));
      result.current.push(spot(15, {bookId: 23, bookName: 'Isaia', chapter: 7}));
    });
    expect(result.current.depth).toBe(2);
    expect(result.current.top?.bookName).toBe('Isaia');

    let popped: ReaderSpot | null = null;
    act(() => {
      popped = result.current.pop();
    });
    expect(popped).toEqual(spot(15, {bookId: 23, bookName: 'Isaia', chapter: 7}));
    expect(result.current.top).toEqual(spot(5));

    act(() => {
      result.current.pop();
    });
    expect(result.current.top).toBeNull();
    let empty: ReaderSpot | null = spot(1);
    act(() => {
      empty = result.current.pop();
    });
    expect(empty).toBeNull();
  });

  it('clears the whole trail', () => {
    const {result} = renderHook(() => useReturnTrail());
    act(() => {
      result.current.push(spot(5));
      result.current.push(spot(9));
      result.current.clear();
    });
    expect(result.current.depth).toBe(0);
  });
});
