import path from 'path';
import {
  CHRISTMAS,
  DAILY_VERSES,
  HOLY_WEEK,
  dailyVerseFor,
  easterSunday,
  type VerseRef,
} from '../src/constants/dailyVerses';

const key = (r: VerseRef) => `${r.b}:${r.c}:${r.v}${r.to ? `-${r.to}` : ''}`;
const all = [...DAILY_VERSES, ...HOLY_WEEK, ...CHRISTMAS];

describe('dailyVerses', () => {
  it('has a full year of distinct refs plus the seasonal pools', () => {
    expect(DAILY_VERSES).toHaveLength(365);
    expect(HOLY_WEEK).toHaveLength(9);
    expect(CHRISTMAS).toHaveLength(3);
    expect(new Set(all.map(key)).size).toBe(all.length);
  });

  it('computes Easter Sunday', () => {
    expect(easterSunday(2025).toISOString()).toBe('2025-04-20T00:00:00.000Z');
    expect(easterSunday(2026).toISOString()).toBe('2026-04-05T00:00:00.000Z');
    expect(easterSunday(2027).toISOString()).toBe('2027-03-28T00:00:00.000Z');
  });

  it('overrides Holy Week and Christmas, otherwise indexes by day of year', () => {
    expect(dailyVerseFor(new Date(2026, 2, 29))).toBe(HOLY_WEEK[0]); // Palm Sunday
    expect(dailyVerseFor(new Date(2026, 3, 5))).toBe(HOLY_WEEK[7]); // Easter Sunday
    expect(dailyVerseFor(new Date(2026, 3, 6))).toBe(HOLY_WEEK[8]); // Easter Monday
    expect(dailyVerseFor(new Date(2026, 3, 7))).toBe(DAILY_VERSES[96]); // 7 April = day 97
    expect(dailyVerseFor(new Date(2026, 11, 24))).toBe(CHRISTMAS[0]);
    expect(dailyVerseFor(new Date(2026, 11, 25))).toBe(CHRISTMAS[1]);
    expect(dailyVerseFor(new Date(2026, 0, 1))).toBe(DAILY_VERSES[0]);
    expect(dailyVerseFor(new Date(2028, 11, 31))).toBe(DAILY_VERSES[0]); // day 366 wraps
  });

  // A typo'd chapter or verse would ship an empty notification, so every ref
  // is checked against the source DB the app bundles.
  it('every ref resolves in the bundled Bible DB', async () => {
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database(
      path.join(__dirname, '../assets/data/BibleMG65.db'),
      sqlite3.OPEN_READONLY,
    );
    const count = (r: VerseRef) =>
      new Promise<number>((resolve, reject) =>
        db.get(
          'SELECT COUNT(*) AS n FROM Verses WHERE book_id = ? AND chapter = ? AND verse_number BETWEEN ? AND ?',
          [r.b, r.c, r.v, r.to ?? r.v],
          (err: Error | null, row: {n: number}) => (err ? reject(err) : resolve(row.n)),
        ),
      );
    const missing: string[] = [];
    for (const r of all) {
      if ((await count(r)) !== (r.to ?? r.v) - r.v + 1) missing.push(key(r));
    }
    db.close();
    expect(missing).toEqual([]);
  });
});
