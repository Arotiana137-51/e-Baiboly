/**
 * The highlight bubble next to the phone's own selection menu (Copy,
 * Translate...): on the side the menu leaves free.
 */
import {
  BUBBLE_MARGIN,
  HANDLE_ROOM,
  SYSTEM_MENU_ROOM,
  placeBubble,
  systemMenuAbove,
} from '../src/utils/bubblePlacement';

const size = { width: 250, height: 92, arrow: 12 };
const reader = { readerTopOnScreen: 50, readerWidth: 390, readerHeight: 700 };

const overlaps = (a: { top: number; bottom: number }, b: { top: number; bottom: number }) =>
  a.top < b.bottom && b.top < a.bottom;

test('mid-screen: the menu above the words, the bubble under them, clear of the handles', () => {
  const place = placeBubble({ ...reader, x: 120, top: 300, bottom: 320 }, size);
  expect(systemMenuAbove(50 + 300)).toBe(true);
  expect(place.below).toBe(true);
  expect(place.top).toBe(320 + HANDLE_ROOM);
  // Nowhere near the menu's band above the words.
  expect(overlaps({ top: place.top, bottom: place.top + size.height }, { top: 300 - SYSTEM_MENU_ROOM, bottom: 300 })).toBe(false);
});

test('near the top of the screen: the menu goes under the words, the bubble under the menu', () => {
  const place = placeBubble({ ...reader, readerTopOnScreen: 0, x: 120, top: 10, bottom: 30 }, size);
  expect(systemMenuAbove(10)).toBe(false);
  expect(place.below).toBe(true);
  const menu = { top: 30, bottom: 30 + HANDLE_ROOM + SYSTEM_MENU_ROOM };
  expect(overlaps({ top: place.top, bottom: place.top + size.height }, menu)).toBe(false);
});

test('near the bottom of the reader: the bubble over the menu, over the words', () => {
  const place = placeBubble({ ...reader, x: 120, top: 640, bottom: 660 }, size);
  expect(place.below).toBe(false);
  expect(place.top + size.height).toBeLessThanOrEqual(640 - SYSTEM_MENU_ROOM);
});

test('a selection as tall as the reader: the bubble stays in view', () => {
  const place = placeBubble({ ...reader, x: 120, top: 5, bottom: 695 }, size);
  expect(place.top).toBeGreaterThanOrEqual(BUBBLE_MARGIN);
  expect(place.top + size.height).toBeLessThanOrEqual(700 - BUBBLE_MARGIN);
});

test('the bubble stays inside the reader sideways, its arrow on the words', () => {
  const place = placeBubble({ ...reader, x: 380, top: 300, bottom: 320 }, size);
  expect(place.left).toBe(390 - size.width - BUBBLE_MARGIN);
  expect(place.left + place.arrowX).toBeLessThanOrEqual(380);
});
