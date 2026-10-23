/**
 * The published OTA patches (docs/patches, served by GitHub Pages) as the app
 * reads them. In the field a slip is silent: PatchManager stops the chain at
 * the first patch parsePatchFile refuses, so nothing after it ever applies,
 * and a device at or above `latest` never looks.
 */
import fs from 'fs';
import path from 'path';
import {
  isValidPatchIndex,
  parsePatchFile,
  type PatchTarget,
} from '../src/services/database/patchSchema';

type Row = Record<string, unknown>;

const PATCH_FLOORS: Record<PatchTarget, number> = require('../scripts/utils/patchFloors');

const patchDir = (target: PatchTarget) =>
  path.join(__dirname, '../docs/patches', target);
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));

const dbRow = (file: string, sql: string, params: unknown[]): Promise<Row> => {
  const sqlite3 = require('sqlite3');
  const db = new sqlite3.Database(
    path.join(__dirname, '../assets/data/dev', file),
    sqlite3.OPEN_READONLY,
  );
  return new Promise((resolve, reject) =>
    db.get(sql, params, (e: Error | null, row: Row) => {
      db.close();
      return e ? reject(e) : resolve(row);
    }),
  );
};

// How each target's rows are found in its bundled database, and which
// columns a patch writes.
const TARGETS = {
  bible: {
    db: 'BibleMG65.db',
    rows: (patch: Row) => patch.verses as Row[],
    key: (r: Row) => `${r.book_id}:${r.chapter}:${r.verse_number}`,
    select:
      'SELECT text, title FROM Verses WHERE book_id = ? AND chapter = ? AND verse_number = ?',
    params: (r: Row) => [r.book_id, r.chapter, r.verse_number],
    fields: (r: Row) => ({ text: r.text, title: r.title ?? null }),
  },
  hymns: {
    db: 'Hymns.db',
    rows: (patch: Row) => patch.hymnVerses as Row[],
    key: (r: Row) => `${r.hymn_id}:${r.verse_number}:${r.is_chorus}`,
    select:
      'SELECT text, heading FROM HymnVerses WHERE hymn_id = ? AND verse_number = ? AND is_chorus = ?',
    params: (r: Row) => [r.hymn_id, r.verse_number, r.is_chorus],
    fields: (r: Row) => ({ text: r.text, heading: r.heading ?? null }),
  },
};

describe.each(['bible', 'hymns'] as const)('%s', target => {
  const index = readJson(path.join(patchDir(target), 'index.json'));
  const patch = (version: number) =>
    readJson(path.join(patchDir(target), `${version}.json`));

  test('the index is one PatchManager accepts, and latest is the newest patch', () => {
    expect(isValidPatchIndex(index)).toBe(true);
    expect(index.latest).toBe(Math.max(...index.patches));
  });

  test('every listed patch parses, and every published file is listed', () => {
    for (const version of index.patches) {
      expect(parsePatchFile(patch(version), target, version)).not.toBeNull();
    }
    const files = fs
      .readdirSync(patchDir(target))
      .filter(f => f !== 'index.json')
      .map(f => Number(path.basename(f, '.json')));
    expect(files.sort()).toEqual([...index.patches].sort());
  });

  // A device patched up to `latest` must read what a fresh install reads.
  // Patches below the floor were built for DBs older than the last change no
  // patch can carry: the devices that take them re-extract with the next APK.
  test('the patches still in use leave the rows the bundled database has', async () => {
    const t = TARGETS[target];
    const floor = Math.max(index.minBaseline, PATCH_FLOORS[target]);
    const final = new Map<string, Row>();
    for (const version of [...index.patches].sort((a, b) => a - b)) {
      if (version < floor) continue;
      for (const row of t.rows(patch(version))) final.set(t.key(row), row);
    }
    for (const [key, row] of final) {
      const bundled = await dbRow(t.db, t.select, t.params(row));
      expect({
        key,
        ...(bundled ? t.fields(bundled) : { missing: true }),
      }).toEqual({
        key,
        ...t.fields(row),
      });
    }
  });
});
