/**
 * First lines typed from memory, with the slips people make: a real word for
 * another ("ity" for "inty"), a dropped hyphen or apostrophe, a moved space, a
 * changed letter. Each must still bring up the hymn meant, near the top,
 * through the real dev hymn database.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { useHymnSearch, type HymnSearchResult } from '../src/hooks/useHymnSearch';

jest.mock('../src/services/database/DatabaseService', () => {
  const sqlite3 = require('sqlite3');
  const nodePath = require('path');
  let db: { all: Function; close: () => void } | null = null;
  const executeQuery = (sql: string, params: unknown[] = []) =>
    new Promise((resolve, reject) => {
      db ??= new sqlite3.Database(
        nodePath.join(__dirname, '../assets/data/dev/Hymns.db'),
        sqlite3.OPEN_READONLY,
      );
      db!.all(sql, params, (e: Error | null, rows: unknown[]) => (e ? reject(e) : resolve({ rows })));
    });
  return {
    hymnsDatabaseService: { initDatabase: async () => undefined, executeQuery, executeQuerySilent: executeQuery },
    __close: () => db?.close(),
  };
});

afterAll(() => {
  require('../src/services/database/DatabaseService').__close();
});

let search: (q: string) => Promise<HymnSearchResult[]>;
const Harness = () => {
  search = useHymnSearch().searchHymns;
  return null;
};
// Inside act: the hook sets its loading state around each search.
const searchHymns = async (q: string) => {
  let results: HymnSearchResult[] = [];
  await act(async () => {
    results = await search(q);
  });
  return results;
};
beforeAll(() => {
  act(() => {
    create(<Harness />);
  });
});

// [typed, hymn meant, worst place it may come]. "ity aho jeso" really is the
// start of FFPM 419's line too, so that exact match keeps first place.
const CASES: [string, string, number][] = [
  ['ity aho jeso', 'ff_33', 2],
  ['ity aho jesoa', 'ff_33', 1],
  ['inty aho jeso', 'ff_33', 1],
  ["o mandrosoa ry mpanaraton'i jeso", 'ffpm_303', 1],
  ['o mandrosoa ry mpanarato ni jeso', 'ffpm_303', 1],
  ['tsy vitam-po onena', 'ff_16', 1],
  ['tsy vitampo onena', 'ff_16', 1],
  ['tsy vita mpo onena', 'ff_16', 1],
  ['tsy vitampo onina', 'ff_16', 1],
  ['mihaino ry siona', 'ffpm_37', 2],
  ['miorina mafy tsara', 'ffpm_295', 1],
  ['ry raiko fenoantra', 'ffpm_420', 1],
];

test.each(CASES)('"%s" brings up %s', async (typed, meant, worst) => {
  const ids = (await searchHymns(typed)).map(r => r.id);
  const place = ids.indexOf(meant) + 1;
  expect(place).toBeGreaterThan(0);
  expect(place).toBeLessThanOrEqual(worst);
});

test('a slip never floods the results', async () => {
  // Strict match FFPM 419, then at most 10 near hymns.
  expect((await searchHymns('ity aho jeso')).length).toBeLessThanOrEqual(11);
});
