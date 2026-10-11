import {
  LIFE_SITUATIONS,
  type LifeSituation,
  type SituationId,
  type SituationVerse,
} from '../constants/lifeSituations';
import {dayNumber} from './isoDay';

/**
 * Which "Teny ho anao" verse a day gets. Pure and deterministic: the same
 * state always yields the same schedule, so the 60-day widget feed and the
 * 12-day notification window, built separately, agree day for day.
 *
 * - Live situations take turns, one per day, in the person's own rank order
 *   (array order). Each situation's plan advances only on the days it is
 *   shown, so ranking several never makes one skip verses.
 * - A check-in falls every `checkEvery` days after the start or the last
 *   "still" answer. Short and season plans that go unanswered stop
 *   CHECK_IN_GRACE_DAYS after it and the normal daily verse comes back;
 *   long plans keep going until the person says otherwise.
 */

export type ActiveSituation = {
  id: SituationId;
  startedOn: string; // yyyy-MM-dd, local
  checkedOn?: string; // last "Mbola eo" answer, yyyy-MM-dd
};

export type ScheduledVerse = {situationId: SituationId; ref: SituationVerse};

export const CHECK_IN_GRACE_DAYS = 3;
// Agreed ceiling: more than three verses a day can't be meditated on.
export const MAX_VERSES_PER_DAY = 3;

const BY_ID = new Map(LIFE_SITUATIONS.map(s => [s.id, s]));

export const situationById = (id: SituationId): LifeSituation | undefined => BY_ID.get(id);

const nextCheckInDay = (active: ActiveSituation, situation: LifeSituation): number =>
  dayNumber(active.checkedOn ?? active.startedOn) + situation.checkEvery;

const isLiveOn = (active: ActiveSituation, situation: LifeSituation, day: number): boolean => {
  if (day < dayNumber(active.startedOn)) return false;
  if (situation.kind === 'long') return true;
  return day < nextCheckInDay(active, situation) + CHECK_IN_GRACE_DAYS;
};

export const isLive = (active: ActiveSituation, date: Date): boolean => {
  const situation = situationById(active.id);
  return !!situation && isLiveOn(active, situation, dayNumber(date));
};

/** Situations whose check-in is due on `date` or overdue (and still live). */
export const checkInsDue = (date: Date, actives: ReadonlyArray<ActiveSituation>): ActiveSituation[] => {
  const day = dayNumber(date);
  return actives.filter(active => {
    const situation = situationById(active.id);
    return !!situation && isLiveOn(active, situation, day) && day >= nextCheckInDay(active, situation);
  });
};

/** True when a live situation's check-in falls exactly on `date`. */
export const isCheckInDay = (date: Date, actives: ReadonlyArray<ActiveSituation>): boolean => {
  const day = dayNumber(date);
  return actives.some(active => {
    const situation = situationById(active.id);
    return !!situation && isLiveOn(active, situation, day) && day === nextCheckInDay(active, situation);
  });
};

/**
 * The verses for `days` consecutive days from `from`, up to `perDay` each
 * (empty = no live situation, use the normal daily verse). Replays every day
 * since the earliest start so each plan's position is exact.
 */
export const situationSchedule = (
  actives: ReadonlyArray<ActiveSituation>,
  from: Date,
  days: number,
  perDay = 1,
): ScheduledVerse[][] => {
  const known = actives.flatMap(active => {
    const situation = situationById(active.id);
    return situation ? [{active, situation}] : [];
  });
  const first = dayNumber(from);
  const result: ScheduledVerse[][] = Array.from({length: Math.max(0, days)}, () => []);
  if (known.length === 0 || days <= 0) return result;

  const shown = new Map<SituationId, number>();
  const perDayCap = Math.min(Math.max(1, perDay), MAX_VERSES_PER_DAY);
  let turn = 0;
  const start = Math.min(...known.map(k => dayNumber(k.active.startedOn)));
  for (let day = start; day < first + days; day += 1) {
    const live = known.filter(k => isLiveOn(k.active, k.situation, day));
    if (live.length === 0) continue;
    const picks = Math.min(perDayCap, live.length);
    for (let i = 0; i < picks; i += 1) {
      const {active, situation} = live[(turn + i) % live.length];
      const count = shown.get(active.id) ?? 0;
      shown.set(active.id, count + 1);
      if (day >= first) {
        result[day - first].push({
          situationId: active.id,
          ref: situation.verses[count % situation.verses.length],
        });
      }
    }
    turn += picks;
  }
  return result;
};

export const versesForDate = (
  date: Date,
  actives: ReadonlyArray<ActiveSituation>,
  perDay = 1,
): ScheduledVerse[] => situationSchedule(actives, date, 1, perDay)[0];
