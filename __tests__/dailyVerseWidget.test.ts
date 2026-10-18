import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from 'react-native-fs';
import {
  DEFAULT_WIDGET_TEXT,
  parseVerseKey,
  recordWidgetHeart,
  readWidgetHearts,
  setWidgetLook,
  setWidgetText,
  syncDailyVerseWidget,
  verseKey,
} from '../src/services/widget/dailyVerseWidget';
import {FAVORITES_KEY} from '../src/constants/favorites';
import {addSituation, EMPTY_STATE, saveTenyHoAnao} from '../src/services/lifeSituations/situationStore';
import {dailyVerseFor} from '../src/constants/dailyVerses';
import {isoDay} from '../src/utils/isoDay';

// Any verse reads back as Salamo text; the heart query returns one row per verse asked.
jest.mock('../src/services/database/DatabaseService', () => ({
  bibleDatabaseService: {
    initDatabase: jest.fn(async () => undefined),
    executeQuery: jest.fn(async (sql: string, params: number[]) => {
      if (sql.includes('v.id, v.book_id')) {
        const [b, c, from, to] = params;
        return {
          rows: Array.from({length: to - from + 1}, (_, i) => ({
            id: 1000 + i,
            book_id: b,
            chapter: c,
            verse_number: from + i,
            text: `andininy ${from + i}`,
            title: null,
            bookName: 'Salamo',
          })),
        };
      }
      return {rows: [{text: 'Jehovah no Mpiandry ahy', name: 'Salamo'}]};
    }),
  },
}));

// An in-memory widget folder.
const files = new Map<string, string>();
const fs = RNFS as unknown as Record<string, jest.Mock>;
fs.writeFile.mockImplementation(async (path: string, data: string) => {
  files.set(path, data);
});
fs.readFile.mockImplementation(async (path: string) => files.get(path) ?? '');
fs.exists.mockImplementation(async (path: string) => files.has(path));
fs.unlink.mockImplementation(async (path: string) => {
  files.delete(path);
});

// Jest runs as iOS, so the feed lands in the App Group folder.
const feed = () => JSON.parse(files.get('/mock/group/dailyVerse.json') as string);
const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return isoDay(date);
};

beforeEach(async () => {
  files.clear();
  await AsyncStorage.clear();
});

test('verse keys go both ways, ranges included', () => {
  expect(verseKey({b: 19, c: 23, v: 1})).toBe('19:23:1');
  expect(verseKey({b: 20, c: 3, v: 5, to: 6})).toBe('20:3:5-6');
  expect(parseVerseKey('20:3:5-6')).toEqual({b: 20, c: 3, v: 5, to: 6});
  expect(parseVerseKey('nope')).toBeNull();
});

test('a calendar day shows Fampaherezana, a plan day its progress, a check-in day nothing', async () => {
  await syncDailyVerseWidget();
  expect(feed().days[day(0)]).toMatchObject({label: 'Fampaherezana', dateLabel: expect.any(String)});
  expect(feed().translation).toBe('MG1865');

  await saveTenyHoAnao(addSituation(EMPTY_STATE, 'grief'));
  await syncDailyVerseWidget();
  expect(feed().days[day(0)].label).toBe('Teny ho anao · 1/21');
  expect(feed().days[day(1)].label).toBe('Teny ho anao · 2/21');
  expect(feed().days[day(7)]).toMatchObject({label: '', ref: 'Teny ho anao'});
  expect(feed().days[day(7)].key).toBeUndefined();
});

test('the heart starts filled for a verse already in the favorites', async () => {
  const ref = dailyVerseFor(new Date());
  const verses = Array.from({length: (ref.to ?? ref.v) - ref.v + 1}, (_, i) => ({
    book_id: ref.b,
    chapter: ref.c,
    verse_number: ref.v + i,
  }));
  await syncDailyVerseWidget();
  expect(feed().days[day(0)]).toMatchObject({key: verseKey(ref), fav: false});

  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(verses));
  await syncDailyVerseWidget();
  expect(feed().days[day(0)].fav).toBe(true);
  expect(feed().days[day(0)].favUrl).toContain(`key=${verseKey(ref)}`);
});

test('text settings reach the feed, and a chosen contrast inks the look', async () => {
  await syncDailyVerseWidget();
  expect(feed().text).toEqual({scale: DEFAULT_WIDGET_TEXT.scale, font: DEFAULT_WIDGET_TEXT.font});

  await setWidgetText({scale: 1.3, font: 'italic', ink: 'dark'});
  expect(feed().text).toEqual({scale: 1.3, font: 'italic'});
  expect(feed().look.text).toBe('#1B1B1B');
});

test('hearts from the widget are resolved against the Bible and kept until a feed shows them', async () => {
  await recordWidgetHeart('20:3:5-6', true);
  await recordWidgetHeart('19:23:1', false);

  const hearts = await readWidgetHearts();
  expect(hearts).toHaveLength(2);
  expect(hearts[0].on).toBe(true);
  expect(hearts[0].verses.map(v => v.verse_number)).toEqual([5, 6]);
  expect(hearts[0].verses[0]).toMatchObject({book_id: 20, chapter: 3, bookName: 'Salamo'});
  expect(hearts[1]).toMatchObject({on: false});
  // Reading again finds them all: nothing is dropped before the favorites have it.
  expect(await readWidgetHearts()).toHaveLength(2);

  // Only 20:3:5 is a favorite yet: the range heart waits, the "off" heart is shown.
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([{book_id: 20, chapter: 3, verse_number: 5}]));
  await syncDailyVerseWidget();
  expect(JSON.parse(files.get('/mock/group/widgetFavorites.json') as string)).toEqual({'20:3:5-6': true});

  await AsyncStorage.setItem(
    FAVORITES_KEY,
    JSON.stringify([5, 6].map(v => ({book_id: 20, chapter: 3, verse_number: v}))),
  );
  await syncDailyVerseWidget();
  expect(files.has('/mock/group/widgetFavorites.json')).toBe(false);
});

test('a sync asked during another resolves once the newer feed is written', async () => {
  const first = syncDailyVerseWidget();
  const second = setWidgetText({scale: 1.15, font: 'sans', ink: 'auto'});
  const third = setWidgetLook({background: '#0B0B0C', text: '#F2E6D5', accent: '#FFD60A'});
  await second;
  expect(feed().text).toEqual({scale: 1.15, font: 'sans'});
  await third;
  expect(feed().look.background).toBe('#0B0B0C');
  await first;
});
