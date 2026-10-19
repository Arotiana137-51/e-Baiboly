import path from 'path';
import {
  FEELINGS,
  LIFE_SITUATIONS,
  SITUATION_THEME,
  SITUATION_THEMES,
  type SituationId,
} from '../src/constants/lifeSituations';
import type {VerseRef} from '../src/constants/dailyVerses';
import {
  CHECK_IN_GRACE_DAYS,
  checkInsDue,
  isCheckInDay,
  isLive,
  planPosition,
  situationSchedule,
  versesForDate,
  type ActiveSituation,
} from '../src/utils/lifeSituations';
import {
  EMPTY_STATE,
  addSituation,
  confirmStillIn,
  moveSituation,
  rebaseState,
  removeSituation,
} from '../src/services/lifeSituations/situationStore';

const key = (r: VerseRef) => `${r.b}:${r.c}:${r.v}${r.to ? `-${r.to}` : ''}`;
const byId = (id: SituationId) => LIFE_SITUATIONS.find(s => s.id === id)!;
const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 9);
};
const plusDays = (iso: string, n: number) => {
  const date = day(iso);
  date.setDate(date.getDate() + n);
  return date;
};

// Plans for people who are hurting: no correction verse (see the content
// rules in constants/lifeSituations.ts).
const COMFORT_ONLY: SituationId[] = [
  'fear', 'guidance', 'thanks', 'grief', 'discouraged', 'doubt', 'work', 'illness', 'lonely',
  'children', 'betrayed', 'waiting', 'insecurity', 'studies', 'ageing', 'disaster', 'faraway',
  'shame', 'injustice', 'divorce', 'babyloss', 'journey', 'newtask',
  'prison', 'disability', 'heartbreak', 'caregiver', 'insomnia', 'pregnancy', 'addictedrelative',
];

describe('lifeSituations content', () => {
  it('has the 43 agreed plans with their shapes', () => {
    expect(LIFE_SITUATIONS).toHaveLength(43);
    expect(new Set(LIFE_SITUATIONS.map(s => s.id)).size).toBe(43);
    for (const s of LIFE_SITUATIONS) {
      if (s.kind === 'long') {
        expect(s.days).toBeUndefined();
        expect(s.checkEvery).toBe(14);
        expect(s.verses.length).toBeGreaterThanOrEqual(28);
      } else {
        expect(s.verses.length).toBeGreaterThanOrEqual(s.days!);
        expect(s.checkEvery).toBeLessThanOrEqual(s.days!);
      }
      expect(new Set(s.verses.map(key)).size).toBe(s.verses.length);
    }
  });

  it('groups every plan under a theme that is shown, and lists the plans of a feeling once', () => {
    for (const {theme} of SITUATION_THEMES) {
      expect(LIFE_SITUATIONS.filter(s => SITUATION_THEME[s.id] === theme).length).toBeGreaterThan(0);
    }
    for (const feeling of FEELINGS) {
      expect(new Set(feeling.situations).size).toBe(feeling.situations.length);
    }
  });

  it('keeps correction verses out of the comfort plans', () => {
    for (const id of COMFORT_ONLY) {
      expect(byId(id).verses.filter(v => v.correction)).toEqual([]);
    }
  });

  // Same check as dailyVerses.test.ts, against the DB the app bundles.
  // A verse has to read on its own on a small widget: at most 250 characters
  // (the longest of the first 13 plans was 249).
  it('every ref resolves, carries no Psalm heading and fits the widget', async () => {
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database(
      path.join(__dirname, '../assets/data/dev/BibleMG65.db'),
      sqlite3.OPEN_READONLY,
    );
    const rows = (r: VerseRef) =>
      new Promise<string[]>((resolve, reject) =>
        db.all(
          'SELECT text FROM Verses WHERE book_id = ? AND chapter = ? AND verse_number BETWEEN ? AND ?',
          [r.b, r.c, r.v, r.to ?? r.v],
          (err: Error | null, found: {text: string}[]) =>
            err ? reject(err) : resolve(found.map(row => row.text)),
        ),
      );
    const bad: string[] = [];
    for (const s of LIFE_SITUATIONS) {
      for (const v of s.verses) {
        const texts = await rows(v);
        const headed = /mpiventy hira|Tonon-kira|Miktama|Maskila|Fihirana fiakarana|nataon'i Davida|Salamon'i/i;
        const text = texts.join(' ');
        if (texts.length !== (v.to ?? v.v) - v.v + 1 || headed.test(text) || text.length > 250) {
          bad.push(`${s.id} ${key(v)}`);
        }
      }
    }
    db.close();
    expect(bad).toEqual([]);
  });
});

describe('lifeSituations schedule', () => {
  const grief: ActiveSituation = {id: 'grief', startedOn: '2026-10-01'};
  const work: ActiveSituation = {id: 'work', startedOn: '2026-10-01'};

  it('is empty without a situation, so the calendar verse is used', () => {
    expect(versesForDate(day('2026-10-05'), [])).toEqual([]);
    expect(situationSchedule([], day('2026-10-05'), 3)).toEqual([[], [], []]);
  });

  it('walks a single plan day by day from its start', () => {
    const verses = situationSchedule([grief], day('2026-10-01'), 3).map(d => d[0].ref);
    expect(verses).toEqual(byId('grief').verses.slice(0, 3));
    expect(versesForDate(day('2026-09-30'), [grief])).toEqual([]); // before the start
  });

  it('rotates ranked situations and advances each plan only when shown', () => {
    const days = situationSchedule([grief, work], day('2026-10-01'), 4).map(d => d[0]);
    expect(days.map(d => d.situationId)).toEqual(['grief', 'work', 'grief', 'work']);
    expect(days.map(d => d.ref)).toEqual([
      byId('grief').verses[0],
      byId('work').verses[0],
      byId('grief').verses[1],
      byId('work').verses[1],
    ]);
    // Same answer whether computed alone or inside a longer window.
    expect(versesForDate(day('2026-10-03'), [grief, work])).toEqual([days[2]]);
  });

  it('uses no plan verse on a check-in day, so none is skipped', () => {
    const days = situationSchedule([grief], day('2026-10-01'), 9);
    expect(days[7]).toEqual([]); // the widget asks instead
    expect(days[8][0].ref).toBe(byId('grief').verses[7]);
  });

  it('keeps a plan in order while another one ends', () => {
    const workRefs = situationSchedule([grief, work], day('2026-10-01'), 20)
      .flat()
      .filter(v => v.situationId === 'work')
      .map(v => v.ref);
    expect(workRefs).toEqual(byId('work').verses.slice(0, workRefs.length));
  });

  it('freezes positions before a change, so removing one plan never moves another', () => {
    const today = day('2026-10-06');
    const shownWork = situationSchedule([grief, work], day('2026-10-01'), 5)
      .flat()
      .filter(v => v.situationId === 'work').length;
    const rebased = rebaseState({...EMPTY_STATE, situations: [grief, work]}, today);
    const state = removeSituation(rebased, 'grief');
    expect(state.since).toBe('2026-10-06');
    expect(versesForDate(today, state.situations, state.since)[0].ref).toBe(
      byId('work').verses[shownWork],
    );
    // A plan that has ended is dropped at the next change.
    const later = rebaseState({...EMPTY_STATE, situations: [grief, work]}, day('2026-10-12'));
    expect(later.situations.map(s => s.id)).toEqual(['work']);
  });

  it('asks every checkEvery days and stops a season plan left unanswered', () => {
    const every = byId('grief').checkEvery; // 7
    expect(isCheckInDay(plusDays('2026-10-01', every), [grief])).toBe(true);
    expect(isCheckInDay(plusDays('2026-10-01', every - 1), [grief])).toBe(false);
    expect(checkInsDue(plusDays('2026-10-01', every + 1), [grief])).toEqual([grief]);
    expect(isLive(grief, plusDays('2026-10-01', every + CHECK_IN_GRACE_DAYS - 1))).toBe(true);
    expect(isLive(grief, plusDays('2026-10-01', every + CHECK_IN_GRACE_DAYS))).toBe(false);
    expect(versesForDate(plusDays('2026-10-01', every + CHECK_IN_GRACE_DAYS), [grief])).toEqual([]);
  });

  it('keeps a long plan going without an answer', () => {
    expect(isLive(work, plusDays('2026-10-01', 200))).toBe(true);
    expect(checkInsDue(plusDays('2026-10-01', 15), [work])).toEqual([work]);
  });

  it('counts the verses a plan has shown, today included', () => {
    expect(planPosition('grief', [grief], day('2026-10-03'))).toEqual({shown: 3, days: byId('grief').days});
    // Two plans take turns, so each moves at half speed.
    expect(planPosition('grief', [grief, work], day('2026-10-04')).shown).toBe(2);
    expect(planPosition('work', [grief, work], day('2026-10-04'))).toEqual({shown: 2, days: undefined});
    expect(planPosition('grief', [grief], day('2026-09-30')).shown).toBe(0);
  });

  it('"Mbola eo" moves the next check-in forward', () => {
    const answered = confirmStillIn({...EMPTY_STATE, situations: [grief]}, 'grief', day('2026-10-08'));
    const [still] = answered.situations;
    expect(still.checkedOn).toBe('2026-10-08');
    expect(checkInsDue(day('2026-10-09'), [still])).toEqual([]);
    expect(isCheckInDay(day('2026-10-15'), [still])).toBe(true);
    expect(isLive(still, day('2026-10-12'))).toBe(true);
  });
});

describe('situationStore transitions', () => {
  it('adds once, ranks, and removes', () => {
    let state = addSituation(EMPTY_STATE, 'grief', day('2026-10-01'));
    state = addSituation(state, 'work', day('2026-10-02'));
    state = addSituation(state, 'grief', day('2026-10-03')); // already there
    expect(state.situations).toEqual([
      {id: 'grief', startedOn: '2026-10-01'},
      {id: 'work', startedOn: '2026-10-02'},
    ]);
    state = moveSituation(state, 'work', -1);
    expect(state.situations.map(s => s.id)).toEqual(['work', 'grief']);
    expect(moveSituation(state, 'work', -1)).toBe(state); // already first
    expect(removeSituation(state, 'work').situations.map(s => s.id)).toEqual(['grief']);
  });
});
