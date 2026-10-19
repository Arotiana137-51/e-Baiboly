/**
 * The widget feed (dailyVerse.json) is written here and read by two widgets
 * nothing compiles on a Windows machine. The iOS one decodes it strictly: one
 * missing or mistyped field and JSONDecoder fails, so the widget shows only
 * its "open the app" fallback. These checks read both readers' source, so a
 * field renamed on either side fails here first.
 */
import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from 'react-native-fs';
import {
  recordWidgetHeart,
  setWidgetFollowDark,
  setWidgetLook,
  syncDailyVerseWidget,
} from '../src/services/widget/dailyVerseWidget';
import {
  addSituation,
  EMPTY_STATE,
  saveTenyHoAnao,
} from '../src/services/lifeSituations/situationStore';

jest.mock('../src/services/database/DatabaseService', () => ({
  bibleDatabaseService: {
    initDatabase: jest.fn(async () => undefined),
    executeQuery: jest.fn(async () => ({
      rows: [{ text: 'Jehovah no Mpiandry ahy', name: 'Salamo' }],
    })),
  },
}));

const files = new Map<string, string>();
const rnfs = RNFS as unknown as Record<string, jest.Mock>;
rnfs.writeFile.mockImplementation(async (p: string, data: string) => {
  files.set(p, data);
});
rnfs.readFile.mockImplementation(async (p: string) => files.get(p) ?? '');
rnfs.exists.mockImplementation(async (p: string) => files.has(p));
rnfs.unlink.mockImplementation(async (p: string) => {
  files.delete(p);
});
rnfs.copyFile.mockImplementation(async (_from: string, to: string) => {
  files.set(to, 'jpeg');
});

const repo = (...parts: string[]) =>
  fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');

// The Decodable structs of the iOS widget: name -> [field, Swift type].
const swiftStructs = (() => {
  const source = repo('ios', 'DailyVerseWidget', 'DailyVerseWidget.swift');
  const structs: Record<string, Array<[string, string]>> = {};
  for (const [, name, body] of source.matchAll(
    /struct (\w+): Decodable \{([\s\S]*?)\n\}/g,
  )) {
    structs[name] = [...body.matchAll(/^\s*let (\w+): ([^=\n]+?)\s*$/gm)].map(
      ([, field, type]) => [field, type],
    );
  }
  return structs;
})();

// What JSONDecoder would reject, as "path: problem" lines.
const decodeErrors = (value: unknown, type: string, at: string): string[] => {
  if (type.endsWith('?'))
    return value == null ? [] : decodeErrors(value, type.slice(0, -1), at);
  if (value == null) return [`${at}: missing, Swift needs ${type}`];
  const dict = /^\[String: (.+)\]$/.exec(type);
  if (dict) {
    if (typeof value !== 'object' || Array.isArray(value))
      return [`${at}: not an object`];
    return Object.entries(value).flatMap(([k, v]) =>
      decodeErrors(v, dict[1], `${at}.${k}`),
    );
  }
  const scalar: Record<string, string> = {
    String: 'string',
    Double: 'number',
    Bool: 'boolean',
  };
  if (scalar[type])
    return typeof value === scalar[type]
      ? []
      : [`${at}: ${typeof value}, Swift needs ${type}`];
  const fields = swiftStructs[type];
  if (!fields) return [`${at}: Swift type ${type} is unknown to this test`];
  if (typeof value !== 'object') return [`${at}: not an object`];
  return fields.flatMap(([field, fieldType]) =>
    decodeErrors(
      (value as Record<string, unknown>)[field],
      fieldType,
      `${at}.${field}`,
    ),
  );
};

// Every key the Android widget reads: optString("ref"), getJSONObject("days")...
const kotlinKeys = [
  ...repo(
    'android',
    'app',
    'src',
    'main',
    'java',
    'com',
    'ebaiboly',
    'app',
    'DailyVerseWidgetProvider.kt',
  ).matchAll(/\b(?:opt|get)(?:String|JSONObject|Double|Boolean|Int)\("(\w+)"/g),
].map(m => m[1]);

const keysIn = (value: unknown, into = new Set<string>()): Set<string> => {
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k);
      keysIn(v, into);
    }
  }
  return into;
};

const written = new Set<string>();
const feed = () =>
  JSON.parse(files.get('/mock/group/dailyVerse.json') as string);

beforeEach(async () => {
  files.clear();
  await AsyncStorage.clear();
});

test('both readers were found', () => {
  expect(Object.keys(swiftStructs)).toEqual(
    expect.arrayContaining(['Feed', 'Day', 'FeedLook', 'FeedVeil', 'FeedText']),
  );
  expect(kotlinKeys).toEqual(
    expect.arrayContaining(['days', 'ref', 'text', 'url', 'background']),
  );
});

test.each([
  ['a fresh install', async () => {}],
  [
    'a photo behind the verse',
    async () => {
      await setWidgetLook({
        background: '#0B0B0C',
        text: '#FFFFFF',
        accent: '#FFFFFF',
        imageUri: 'file:///picked.jpg',
      });
    },
  ],
  [
    'dark mode followed',
    async () => {
      await setWidgetFollowDark(true);
    },
  ],
  [
    'a plan with its check-in days',
    async () => {
      await saveTenyHoAnao(addSituation(EMPTY_STATE, 'grief'));
    },
  ],
])('%s: the iOS widget decodes the feed', async (_name, arrange) => {
  await arrange();
  await syncDailyVerseWidget();
  expect(decodeErrors(feed(), 'Feed', 'feed')).toEqual([]);
  keysIn(feed(), written);
});

// Some keys only exist in some feeds (the veil comes with a photo), so this
// runs over all the feeds above.
test('every key the Android widget reads is written by one of those feeds', () => {
  expect(kotlinKeys.filter(k => !written.has(k))).toEqual([]);
});

test('the hearts file is the map both widgets decode', async () => {
  await recordWidgetHeart('19:23:1', true);
  expect(
    decodeErrors(
      JSON.parse(files.get('/mock/group/widgetFavorites.json') as string),
      '[String: Bool]',
      'hearts',
    ),
  ).toEqual([]);
});
