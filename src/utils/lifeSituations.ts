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
 *   "still" answer. That day the widget asks instead of showing a verse, so
 *   no plan verse is used. Short and season plans that go unanswered stop
 *   CHECK_IN_GRACE_DAYS after it and the normal daily verse comes back;
 *   long plans keep going until the person says otherwise.
 * - Positions come from replaying the days since `since`, starting from each
 *   situation's `shown`. Any change to the list (add, remove, reorder,
 *   answer) first freezes those positions at today (rebaseSituations), so
 *   the change never rewrites the past and no plan skips or repeats.
 */

export type ActiveSituation = {
  id: SituationId;
  startedOn: string; // yyyy-MM-dd, local
  checkedOn?: string; // last "Mbola eo" answer, yyyy-MM-dd
  shown?: number; // plan verses shown before the state's `since`
};

export type ScheduledVerse = {situationId: SituationId; ref: SituationVerse};

export const CHECK_IN_GRACE_DAYS = 3;

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
 * Replays the days from `since` (default: the earliest start) up to `end`
 * (a day number, exclusive), calling `onDay` with each day's verse. Returns
 * every situation's position reached at `end`.
 */
const walk = (
  actives: ReadonlyArray<ActiveSituation>,
  since: string | undefined,
  end: number,
  onDay?: (day: number, verse: ScheduledVerse) => void,
): Map<SituationId, number> => {
  const known = actives.flatMap(active => {
    const situation = situationById(active.id);
    return situation ? [{active, situation}] : [];
  });
  const shown = new Map(known.map(k => [k.active.id, k.active.shown ?? 0]));
  if (known.length === 0) return shown;
  let turn = 0;
  const start = since ? dayNumber(since) : Math.min(...known.map(k => dayNumber(k.active.startedOn)));
  for (let day = start; day < end; day += 1) {
    const live = known.filter(k => isLiveOn(k.active, k.situation, day));
    if (live.length === 0) continue;
    if (live.some(k => day === nextCheckInDay(k.active, k.situation))) continue;
    const {active, situation} = live[turn % live.length];
    const count = shown.get(active.id) ?? 0;
    shown.set(active.id, count + 1);
    onDay?.(day, {situationId: active.id, ref: situation.verses[count % situation.verses.length]});
    turn += 1;
  }
  return shown;
};

/**
 * The verse for each of `days` consecutive days from `from` (empty = no plan
 * verse that day: none live, or a check-in day; use the daily calendar).
 */
export const situationSchedule = (
  actives: ReadonlyArray<ActiveSituation>,
  from: Date,
  days: number,
  since?: string,
): ScheduledVerse[][] => {
  const first = dayNumber(from);
  const result: ScheduledVerse[][] = Array.from({length: Math.max(0, days)}, () => []);
  walk(actives, since, first + days, (day, verse) => {
    if (day >= first) result[day - first].push(verse);
  });
  return result;
};

export const versesForDate = (
  date: Date,
  actives: ReadonlyArray<ActiveSituation>,
  since?: string,
): ScheduledVerse[] => situationSchedule(actives, date, 1, since)[0];

/**
 * Freezes each plan's position at `today` and drops the plans that have
 * ended, so a change made today (add, remove, reorder, answer) leaves every
 * earlier day as it was. The caller stores `today` as the new `since`.
 */
export const rebaseSituations = (
  actives: ReadonlyArray<ActiveSituation>,
  since: string | undefined,
  today: Date,
): ActiveSituation[] => {
  const shown = walk(actives, since, dayNumber(today));
  return actives
    .filter(active => isLive(active, today))
    .map(active => ({...active, shown: shown.get(active.id) ?? 0}));
};

/**
 * How far a plan has got by the end of `today`: verses shown so far, and the
 * plan length (undefined for long plans, which have none).
 */
export const planPosition = (
  id: SituationId,
  actives: ReadonlyArray<ActiveSituation>,
  today: Date,
  since?: string,
): {shown: number; days?: number} => {
  const days = situationById(id)?.days;
  const shown = walk(actives, since, dayNumber(today) + 1).get(id) ?? 0;
  return {shown: days ? Math.min(shown, days) : shown, days};
};
