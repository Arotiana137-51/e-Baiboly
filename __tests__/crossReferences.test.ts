import path from 'path';

// The concordance rows are built from OpenBible.info's English-numbered refs
// and converted to MG numbering (scripts/buildBibleDatabase.js), so they are
// checked against the DB the app bundles.
describe('cross references', () => {
  const sqlite3 = require('sqlite3');
  let db: {
    all: (sql: string, params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => void;
    close: () => void;
  };
  const all = <T,>(sql: string, params: unknown[] = []) =>
    new Promise<T[]>((resolve, reject) =>
      db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows as T[]))),
    );

  beforeAll(() => {
    db = new sqlite3.Database(
      path.join(__dirname, '../assets/data/dev/BibleMG65.db'),
      sqlite3.OPEN_READONLY,
    );
  });
  afterAll(() => db.close());

  it('every ref starts and lands on a verse that exists', async () => {
    const [{total}] = await all<{total: number}>('SELECT COUNT(*) AS total FROM CrossReferences');
    expect(total).toBeGreaterThan(300000);

    // MG verse numbers have no gaps, so an existing last verse means the whole
    // range exists.
    const broken = await all<{from_book: number}>(
      `SELECT cr.from_book FROM CrossReferences cr
       WHERE cr.to_verse_start < 1 OR cr.to_verse_start > cr.to_verse_end
          OR NOT EXISTS (SELECT 1 FROM Verses v WHERE v.book_id = cr.from_book
                          AND v.chapter = cr.from_chapter AND v.verse_number = cr.from_verse)
          OR NOT EXISTS (SELECT 1 FROM Verses v WHERE v.book_id = cr.to_book
                          AND v.chapter = cr.to_chapter AND v.verse_number = cr.to_verse_end)`,
    );
    expect(broken).toEqual([]);
  });

  it('uses MG numbering where it differs from the English one', async () => {
    const targets = (book: number, chapter: number, verse: number, toBook: number) =>
      all<{c: number; s: number; e: number}>(
        `SELECT to_chapter AS c, to_verse_start AS s, to_verse_end AS e FROM CrossReferences
         WHERE from_book = ? AND from_chapter = ? AND from_verse = ? AND to_book = ?`,
        [book, chapter, verse, toBook],
      );

    // English Joel 2:28-32 is MG Joel 3:1-5, English Micah 5:2 is MG 5:1.
    expect(await targets(44, 2, 17, 29)).toContainEqual({c: 3, s: 1, e: 5});
    expect(await targets(40, 2, 6, 33)).toContainEqual({c: 5, s: 1, e: 1});
    // ...and the other way round, from the verse the MG reader shows.
    expect(await targets(29, 3, 1, 44)).toContainEqual({c: 2, s: 16, e: 21});
  });
});
