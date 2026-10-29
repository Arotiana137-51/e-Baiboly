/**
 * The OTA patch appliers run for real on copies of the bundled databases:
 * Node's synchronous SQLite stands in for react-native-quick-sqlite's
 * execute. Patches go through parsePatchFile first, as PatchManager does.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  bibleDatabaseService,
  hymnsDatabaseService,
} from '../src/services/database/DatabaseService';
import {parsePatchFile, type PatchTarget} from '../src/services/database/patchSchema';
import {normalizeForFtsContent} from '../src/utils/searchNormalize';

const {DatabaseSync} = require('node:sqlite');
const buildDb = require('../scripts/utils/buildDb');

type Row = Record<string, unknown>;
type Db = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    all: (...p: unknown[]) => Row[];
    get: (...p: unknown[]) => Row | undefined;
    run: (...p: unknown[]) => {changes: number | bigint; lastInsertRowid: number | bigint};
    columns: () => unknown[];
  };
  close: () => void;
};

const DB_FILES: Record<PatchTarget, string> = {bible: 'BibleMG65.db', hymns: 'Hymns.db'};
const SERVICES = {bible: bibleDatabaseService, hymns: hymnsDatabaseService};
const opened: Db[] = [];

// A scratch copy of the bundled DB, opened as the app opens it and handed to
// the service in quick-sqlite's shape.
const useCopy = (target: PatchTarget): Db => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ota-')), DB_FILES[target]);
  fs.copyFileSync(path.join(__dirname, '../assets/data/dev', DB_FILES[target]), file);
  const db: Db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  opened.push(db);
  (SERVICES[target] as unknown as {db: unknown}).db = {
    execute: (sql: string, params: unknown[] = []) => {
      const st = db.prepare(sql);
      if (st.columns().length > 0) {
        const rows = st.all(...params);
        return {rows: {_array: rows, length: rows.length}, rowsAffected: 0};
      }
      const r = st.run(...params);
      return {rowsAffected: Number(r.changes), insertId: Number(r.lastInsertRowid)};
    },
  };
  return db;
};

afterAll(() => opened.forEach(db => db.close()));

const apply = async (target: PatchTarget, raw: Row) => {
  const patch = parsePatchFile(raw, target, raw.version as number);
  if (!patch) throw new Error('parsePatchFile refused the patch');
  if (patch.appliesTo === 'bible') await bibleDatabaseService.applyBiblePatch(patch);
  else await hymnsDatabaseService.applyHymnsPatch(patch);
};

const ids = (db: Db, table: string, word: string) =>
  db.prepare(`SELECT rowid AS id FROM ${table} WHERE ${table} MATCH ?`).all(word).map(r => r.id);

const userVersion = (db: Db) => db.prepare('PRAGMA user_version').get()?.user_version;

const verseRow = <T extends {text: string}>(v: T) => ({...v, text_plain: normalizeForFtsContent(v.text)});

test('the app recomputes the indexed text exactly as the build did', () => {
  for (const [target, sql] of [
    ['bible', 'SELECT text FROM Verses'],
    ['hymns', 'SELECT text FROM HymnVerses'],
  ] as const) {
    const db: Db = new DatabaseSync(path.join(__dirname, '../assets/data/dev', DB_FILES[target]), {
      readOnly: true,
    });
    const drift = db
      .prepare(sql)
      .all()
      .map(r => String(r.text))
      .filter(text => normalizeForFtsContent(text) !== buildDb.normalizeForFtsContent(text));
    db.close();
    expect(drift).toEqual([]);
  }
});

describe('bible', () => {
  test('a changed verse is reindexed and a new verse is added', async () => {
    const db = useCopy('bible');
    const old = db
      .prepare('SELECT id, text FROM Verses WHERE book_id = 43 AND chapter = 3 AND verse_number = 16')
      .get() as {id: number; text: string};
    const words = normalizeForFtsContent(old.text).split(' ');
    // A word the verse holds once, swapped for one no verse has.
    const gone = words.slice(1).find(w => w.length > 4 && words.filter(x => x === w).length === 1)!;
    const text = words.map(w => (w === gone ? 'zzvaovao' : w)).join(' ');
    expect(ids(db, 'VersesFts', gone)).toContain(old.id);

    await apply('bible', {
      version: 20990101,
      appliesTo: 'bible',
      books: [],
      verses: [
        verseRow({book_id: 43, chapter: 3, verse_number: 16, text, title: null}),
        // A wrong text_plain in the file: the phone indexes the text itself.
        {book_id: 43, chapter: 3, verse_number: 99, text: 'Andininy zzvaovaovao', title: null, text_plain: 'tsyampiasaina'},
      ],
    });

    expect(db.prepare('SELECT text FROM Verses WHERE id = ?').get(old.id)?.text).toBe(text);
    expect(ids(db, 'VersesFts', 'zzvaovao')).toEqual([old.id]);
    expect(ids(db, 'VersesFts', gone)).not.toContain(old.id);
    expect(ids(db, 'VersesFts', words[0])).toContain(old.id);
    const added = db
      .prepare('SELECT id FROM Verses WHERE book_id = 43 AND chapter = 3 AND verse_number = 99')
      .get()?.id;
    expect(ids(db, 'VersesFts', 'zzvaovaovao')).toEqual([added]);
    expect(ids(db, 'VersesFts', 'tsyampiasaina')).toEqual([]);
    expect(userVersion(db)).toBe(20990101);
  });

  test('a books row keeps the book verses', async () => {
    const db = useCopy('bible');
    const count = () => db.prepare('SELECT COUNT(*) AS n FROM Verses WHERE book_id = 1').get()?.n;
    const before = count();
    const book = db.prepare('SELECT * FROM Books WHERE id = 1').get();
    await apply('bible', {version: 20990102, appliesTo: 'bible', verses: [], books: [book]});
    expect(count()).toBe(before);
  });
});

describe('hymns', () => {
  test('a title change keeps the stanzas, a chorus and a new stanza apply', async () => {
    const db = useCopy('hymns');
    const stanzas = (id: string) =>
      db.prepare('SELECT COUNT(*) AS n FROM HymnVerses WHERE hymn_id = ?').get(id)?.n as number;
    const hymn = db.prepare("SELECT * FROM Hymns WHERE id = 'ffpm_312'").get() as Row;
    const before = stanzas('ffpm_312');
    const chorus = db
      .prepare('SELECT hymn_id, text FROM HymnVerses WHERE verse_number = 0 LIMIT 1')
      .get() as {hymn_id: string; text: string};
    const title = 'Zztitle vaovao';

    await apply('hymns', {
      version: 20990101,
      appliesTo: 'hymns',
      hymns: [
        {
          ...hymn,
          title,
          title_plain: normalizeForFtsContent(title),
          authors_plain: '',
        },
      ],
      hymnVerses: [
        verseRow({hymn_id: chorus.hymn_id, verse_number: 0, heading: null, text: `${chorus.text} zzfiverenana`, is_chorus: 1}),
        verseRow({hymn_id: 'ffpm_312', verse_number: before + 1, heading: null, text: 'Andininy zzfaharoa', is_chorus: 0}),
      ],
    });

    expect(stanzas('ffpm_312')).toBe(before + 1);
    expect(db.prepare('SELECT hymn_id FROM HymnsFts WHERE HymnsFts MATCH ?').all('zztitle')).toEqual([
      {hymn_id: 'ffpm_312'},
    ]);
    expect(ids(db, 'HymnVersesFts', 'zzfiverenana')).toHaveLength(1);
    expect(ids(db, 'HymnVersesFts', 'zzfaharoa')).toHaveLength(1);
    expect(userVersion(db)).toBe(20990101);
  });
});

describe.each(['bible', 'hymns'] as const)('published %s patches', target => {
  const dir = path.join(__dirname, '../docs/patches', target);
  const {patches} = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));

  test.each(patches as number[])('%i applies', async version => {
    const db = useCopy(target);
    await apply(target, JSON.parse(fs.readFileSync(path.join(dir, `${version}.json`), 'utf8')));
    expect(userVersion(db)).toBe(version);
  });
});
