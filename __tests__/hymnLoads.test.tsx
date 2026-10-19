/**
 * Opening a hymn reads its verses once. MainScreen had two effects that both
 * loaded the current hymn's verses on every hymn change, so each change ran
 * the query twice and re-rendered the whole screen twice more.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';

// Without native insets the real provider renders nothing under Jest.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const calls: Array<{ sql: string; params: unknown[] }> = [];

// Real data from the dev databases, so the app boots as on a phone.
jest.mock('../src/services/database/DatabaseService', () => {
  const sqlite3 = require('sqlite3');
  const nodePath = require('path');
  const open: Record<string, any> = {};
  const service = (file: string) => {
    const db = () =>
      (open[file] ??= new sqlite3.Database(
        nodePath.join(__dirname, '../assets/data/dev', file),
        sqlite3.OPEN_READONLY,
      ));
    const executeQuery = (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return new Promise((resolve, reject) =>
        db().all(sql, params, (e: Error | null, rows: unknown[]) =>
          e ? reject(e) : resolve({ rows }),
        ),
      );
    };
    return {
      initDatabase: async () => undefined,
      executeQuery,
      executeQuerySilent: executeQuery,
      getOnDiskUserVersion: async () => 99999999,
    };
  };
  return {
    bibleDatabaseService: service('BibleMG65.db'),
    hymnsDatabaseService: service('Hymns.db'),
    __closeAll: () => Object.values(open).forEach(db => db.close()),
  };
});

let tree: ReactTestRenderer;

afterAll(() => {
  act(() => tree.unmount());
  require('../src/services/database/DatabaseService').__closeAll();
});

const settle = async (rounds = 20) => {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  }
};

test('the last-read hymn is read once at launch', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  await AsyncStorage.multiSet([
    ['privacy_policy_accepted_v1', 'true'],
    ['@onboarding_done', 'true'],
    ['last_read_mode', 'hymnal'],
    ['last_read_hymn', 'ffpm_1'],
  ]);
  await act(async () => {
    tree = create(<App />);
  });
  await settle();
  // It booted into the reader, on the stored hymn.
  expect(
    tree.root.findAllByProps({ children: 'FFPM 1' }).length,
  ).toBeGreaterThan(0);
  const hymnVerseReads = calls.filter(
    c =>
      c.sql.includes('FROM HymnVerses WHERE hymn_id') &&
      c.params[0] === 'ffpm_1',
  );
  expect(hymnVerseReads).toHaveLength(1);
}, 60000);
