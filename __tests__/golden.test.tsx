/**
 * Golden outputs over the real bundled dev databases (assets/data/dev). The
 * snapshot is the contract: a cleanup or refactor must leave it identical, so
 * any diff here is a behaviour change to explain, not to re-record blindly.
 * A DB rebuild (yarn build:bible / build:hymns) legitimately changes the
 * search and verse-text hashes; re-record then, and only then.
 */
import React from 'react';
import {createHash} from 'crypto';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from 'react-native-fs';
import {act, create} from 'react-test-renderer';
import {setWidgetFollowDark, setWidgetText, syncDailyVerseWidget} from '../src/services/widget/dailyVerseWidget';
import {addSituation, EMPTY_STATE, saveTenyHoAnao} from '../src/services/lifeSituations/situationStore';
import {dailyVerseFor} from '../src/constants/dailyVerses';
import {FAVORITES_KEY} from '../src/constants/favorites';
import {useGlobalSearch, type GlobalSearchResults} from '../src/hooks/useGlobalSearch';
import {useBibleSearch, type BibleVerseResult} from '../src/hooks/useBibleSearch';
import {buildChapterDisplay} from '../src/utils/chapterMarks';
import {buildPassages} from '../src/utils/chapterPassage';
import {transformJesusName} from '../src/utils/jesusName';
import type {BibleVerse} from '../src/hooks/useBibleData';

// Both services answer from the dev databases through node's sqlite3 (same
// SQLite major, FTS5 and the trigram tokenizer included).
jest.mock('../src/services/database/DatabaseService', () => {
  const sqlite3 = require('sqlite3');
  const nodePath = require('path');
  const open: Record<string, unknown> = {};
  const service = (file: string) => {
    const db = () =>
      (open[file] ??= new sqlite3.Database(
        nodePath.join(__dirname, '../assets/data/dev', file),
        sqlite3.OPEN_READONLY,
      )) as {all: (sql: string, params: unknown[], cb: (e: Error | null, rows: unknown[]) => void) => void};
    const executeQuery = (sql: string, params: unknown[] = []) =>
      new Promise((resolve, reject) => db().all(sql, params, (e, rows) => (e ? reject(e) : resolve({rows}))));
    return {initDatabase: async () => undefined, executeQuery, executeQuerySilent: executeQuery};
  };
  return {
    bibleDatabaseService: service('BibleMG65.db'),
    hymnsDatabaseService: service('Hymns.db'),
    __closeAll: () => Object.values(open).forEach(db => (db as {close: () => void}).close()),
  };
});

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

// Read-only access to the dev Bible for the verse-text and versification goldens.
const bibleRows = <T,>(sql: string): Promise<T[]> => {
  const sqlite3 = require('sqlite3');
  const db = new sqlite3.Database(path.join(__dirname, '../assets/data/dev/BibleMG65.db'), sqlite3.OPEN_READONLY);
  return new Promise((resolve, reject) =>
    db.all(sql, [], (e: Error | null, rows: T[]) => {
      db.close();
      return e ? reject(e) : resolve(rows);
    }),
  );
};

afterAll(() => {
  require('../src/services/database/DatabaseService').__closeAll();
});

describe('widget feed: 60 days from a fixed date', () => {
  // Local dates decide the feed's keys; pin the zone the app is used in.
  const realTz = process.env.TZ;
  const files = new Map<string, string>();
  const fs = RNFS as unknown as Record<string, jest.Mock>;

  beforeAll(() => {
    process.env.TZ = 'Indian/Antananarivo';
    // Only Date is faked: the feed's promises and the reporting timers run for real.
    jest.useFakeTimers({
      now: new Date('2026-12-01T06:30:00+03:00'),
      doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance'],
    });
    fs.writeFile.mockImplementation(async (p: string, data: string) => void files.set(p, data));
    fs.readFile.mockImplementation(async (p: string) => files.get(p) ?? '');
    fs.exists.mockImplementation(async (p: string) => files.has(p));
    fs.unlink.mockImplementation(async (p: string) => void files.delete(p));
  });

  afterAll(() => {
    jest.useRealTimers();
    process.env.TZ = realTz;
  });

  beforeEach(async () => {
    files.clear();
    await AsyncStorage.clear();
  });

  const feed = () => JSON.parse(files.get('/mock/group/dailyVerse.json') as string);

  test('the zone is pinned', () => {
    expect(new Date().getTimezoneOffset()).toBe(-180);
  });

  test('fresh install: calendar verses, the app colour, default text', async () => {
    await syncDailyVerseWidget();
    expect(Object.keys(feed().days)).toHaveLength(60);
    expect(feed()).toMatchSnapshot();
  });

  test('a plan on the widget, a favorite, text settings and dark mode', async () => {
    const ref = dailyVerseFor(new Date());
    await AsyncStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify([{book_id: ref.b, chapter: ref.c, verse_number: ref.v}]),
    );
    await saveTenyHoAnao(addSituation(EMPTY_STATE, 'grief'));
    await setWidgetText({scale: 1.15, font: 'sans', ink: 'dark'});
    await setWidgetFollowDark(true);
    expect(feed()).toMatchSnapshot();
  });
});

describe('search: 30 fixed queries', () => {
  const QUERIES = [
    'fitiavana', 'Jehovah', 'mpiandry', 'fahasoavana', 'Jeso', 'Jesosy', 'Jesoa', 'finoana fanantenana',
    'aminny', 'fitiavna', 'mpamonjy', 'Davida', 'Fanahy Masina', 'fiadanana', 'Isiraely', 'Abrahama',
    'tsy matahotra', 'Andriamanitra', 'fahamarinana', 'vavaka', 'MANDRAKIZAY', 'mañatoño', 'fifaliana',
    'Kristy', 'haleloia', 'ny', 'Betlehema', 'fahafatesana', 'tompo', 'jerosalema',
  ];
  const WHOLE_WORD = ['tompo', 'fitia'];

  type Api = {
    search: (q: string, o?: {matchWholeWord?: boolean}) => Promise<GlobalSearchResults>;
    versesForBook: (bookId: number, q: string, o?: {matchWholeWord?: boolean}) => Promise<BibleVerseResult[]>;
  };
  let api: Api;
  const Harness = () => {
    const {search} = useGlobalSearch();
    const {getVersesForBook} = useBibleSearch();
    api = {search, versesForBook: getVersesForBook};
    return null;
  };
  beforeAll(() => {
    act(() => {
      create(<Harness />);
    });
  });

  const digest = async (query: string, matchWholeWord?: boolean) => {
    let results: GlobalSearchResults = {bible: [], hymns: []};
    let topBookVerses: BibleVerseResult[] = [];
    await act(async () => {
      results = await api.search(query, {matchWholeWord});
      if (results.bible[0]) topBookVerses = await api.versesForBook(results.bible[0].bookId, query, {matchWholeWord});
    });
    return {
      bibleBooks: results.bible.map(b => `${b.bookId}:${b.verseCount}`).join(' '),
      bibleSha: sha(results.bible),
      topBookVerses: topBookVerses.slice(0, 5).map(v => `${v.bookId}:${v.chapter}:${v.verseNumber}`).join(' '),
      topBookVersesSha: sha(topBookVerses),
      hymnCount: results.hymns.length,
      hymnTop: results.hymns.slice(0, 8).map(h => `${h.category}${h.number}:${h.matchCount}`).join(' '),
      hymnSha: sha(results.hymns),
    };
  };

  test('results per query', async () => {
    const out: Record<string, unknown> = {};
    for (const q of QUERIES) out[q] = await digest(q);
    for (const q of WHOLE_WORD) out[`${q} (whole word)`] = await digest(q, true);
    expect(out).toMatchSnapshot();
  }, 120000);
});

describe('verse text as the reader shows it', () => {
  test('every chapter, per book, both spellings of Jesus', async () => {
    const verses = await bibleRows<BibleVerse>(
      'SELECT id, book_id, chapter, verse_number, text, title FROM Verses ORDER BY book_id, chapter, verse_number',
    );
    const byChapter = new Map<string, BibleVerse[]>();
    for (const v of verses) {
      const key = `${v.book_id}:${v.chapter}`;
      byChapter.set(key, [...(byChapter.get(key) ?? []), v]);
    }
    const perBook: Record<number, ReturnType<typeof createHash>> = {};
    for (const [key, chapter] of byChapter) {
      const book = Number(key.split(':')[0]);
      perBook[book] ??= createHash('sha256');
      for (const variant of ['jesosy', 'jesoa'] as const) {
        const transform = (text: string) => transformJesusName(text, variant);
        const display = buildChapterDisplay(chapter, transform);
        const passages = buildPassages(chapter, transform, {}, {breakBefore: null, maxVerses: 12});
        perBook[book].update(JSON.stringify([display, passages.map(p => p.pieces)]));
      }
    }
    expect(verses.length).toMatchSnapshot('verse count');
    expect(
      Object.fromEntries(Object.entries(perBook).map(([b, h]) => [b, h.digest('hex').slice(0, 16)])),
    ).toMatchSnapshot('per-book hash');
    // One chapter in full, readable in the snapshot: Salamo 23 (title + lines).
    const psalm23 = byChapter.get('19:23')!;
    expect(buildChapterDisplay(psalm23, t => t).chapterText).toMatchSnapshot('Salamo 23');
  }, 120000);
});

describe('versification: English refs mapped into MG1865 numbering', () => {
  test('the concordance table the build produced', async () => {
    const rows = await bibleRows<Record<string, number>>(
      'SELECT * FROM CrossReferences ORDER BY from_book, from_chapter, from_verse, to_book, to_chapter, to_verse_start, to_verse_end',
    );
    expect({count: rows.length, sha: sha(rows)}).toMatchSnapshot();
    // Every mapped ref lands on a verse MG1865 has, at both ends.
    const dangling = await bibleRows<{n: number}>(
      `SELECT COUNT(*) AS n FROM CrossReferences c
       WHERE NOT EXISTS (SELECT 1 FROM Verses v WHERE v.book_id = c.from_book AND v.chapter = c.from_chapter AND v.verse_number = c.from_verse)
          OR NOT EXISTS (SELECT 1 FROM Verses v WHERE v.book_id = c.to_book AND v.chapter = c.to_chapter AND v.verse_number = c.to_verse_end)`,
    );
    expect(dangling[0].n).toBe(0);
  }, 120000);
});
