/**
 * A phrase quoted from memory, against the real bundled Bible: words joined
 * or split differently, another possessive, a word remembered wrong. The
 * strict search finds none of these; the loose last try should.
 */
import React from 'react';
import {act, create} from 'react-test-renderer';
import {useBibleSearch, type BibleSearchResult, type BibleVerseResult} from '../src/hooks/useBibleSearch';
import {looseCoverage, makeLooseFtsQuery, wordForms} from '../src/utils/looseVerseMatch';

// Answers from the dev database through node's sqlite3, as golden.test does.
jest.mock('../src/services/database/DatabaseService', () => {
  const sqlite3 = require('sqlite3');
  const nodePath = require('path');
  const open: Record<string, unknown> = {};
  const service = (file: string) => {
    const db = () =>
      (open[file] ??= new sqlite3.Database(
        nodePath.join(__dirname, '../assets/data/dev', file),
        sqlite3.OPEN_READONLY,
      )) as {
        all: (
          sql: string,
          params: unknown[],
          cb: (e: Error | null, rows: unknown[]) => void,
        ) => void;
      };
    const executeQuery = (sql: string, params: unknown[] = []) =>
      new Promise((resolve, reject) =>
        db().all(sql, params, (e, rows) => (e ? reject(e) : resolve({ rows }))),
      );
    return {
      initDatabase: async () => undefined,
      executeQuery,
      executeQuerySilent: executeQuery,
    };
  };
  return {
    bibleDatabaseService: service('BibleMG65.db'),
    hymnsDatabaseService: service('Hymns.db'),
    __closeAll: () =>
      Object.values(open).forEach(db => (db as { close: () => void }).close()),
  };
});

type Api = ReturnType<typeof useBibleSearch>;
let api: Api;
const Harness = () => {
  api = useBibleSearch();
  return null;
};

beforeAll(() => {
  act(() => {
    create(<Harness />);
  });
});

afterAll(() => {
  require('../src/services/database/DatabaseService').__closeAll();
});

const search = async (query: string, matchWholeWord?: boolean) => {
  let results: BibleSearchResult[] = [];
  await act(async () => {
    results = await api.searchBible(query, {matchWholeWord});
  });
  return results;
};

const versesIn = async (bookId: number, query: string) => {
  let results: BibleVerseResult[] = [];
  await act(async () => {
    results = await api.getVersesForBook(bookId, query);
  });
  return results;
};

const top = (r: BibleSearchResult[]) =>
  r[0] ? `${r[0].bookName} ${r[0].matchedChapter}:${r[0].matchedVerseNumber}` : 'none';

describe('loose phrase search', () => {
  it('finds I Korintiana 15:10 from "fa ny fahasoavanao no naha toy izao ahy"', async () => {
    const query = 'fa ny fahasoavanao no naha toy izao ahy';
    const results = await search(query);
    expect(top(results)).toBe('I Korintiana 15:10');

    const verses = await versesIn(46, query);
    expect(verses.map(v => `${v.chapter}:${v.verseNumber}`)).toContain('15:10');
  });

  it('finds it from the modern wording too, "nahatonga ahy ho toy izao"', async () => {
    expect(top(await search("ny fahasoavan'Andriamanitra no nahatonga ahy ho toy izao"))).toBe(
      'I Korintiana 15:10',
    );
  });

  it('leaves a phrase that matches word for word to the strict search', async () => {
    const strict = await search("fa ny fahasoavan'Andriamanitra no nahatoy izao ahy");
    expect(top(strict)).toBe('I Korintiana 15:10');
    expect(strict).toHaveLength(1);
  });

  it('does not go loose for a whole-word search', async () => {
    expect(await search('fa ny fahasoavanao no naha toy izao ahy', true)).toEqual([]);
  });

  it('offers nothing for words that are not a remembered verse', async () => {
    expect(await search('xylofaona telefaonina solosaina')).toEqual([]);
  });
});

describe('looseVerseMatch', () => {
  it('strips a possessive ending down to the stem', () => {
    expect(wordForms('fahasoavanao')).toEqual(['fahasoavanao', 'fahasoava']);
    expect(wordForms('ahy')).toEqual(['ahy']);
  });

  it('counts neighbours the verse writes as one word', () => {
    expect(looseCoverage('naha toy izao', 'nahatoy izao ahy')).toBe(1);
  });

  it('counts a word found at the end of a prefixed verse word', () => {
    expect(looseCoverage('toy izao', 'nahatoy izao')).toBe(1);
    expect(looseCoverage('ahy', 'ahiahy')).toBe(1);
  });

  it('needs a phrase of at least three words', () => {
    expect(makeLooseFtsQuery('fahasoavana ahy')).toBeNull();
    expect(makeLooseFtsQuery('fa ny fahasoavanao')).toContain('fahasoava*');
  });
});
