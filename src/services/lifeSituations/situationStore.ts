import AsyncStorage from '@react-native-async-storage/async-storage';
import type {SituationId} from '../../constants/lifeSituations';
import {isLive, situationById, type ActiveSituation} from '../../utils/lifeSituations';
import {isoDay} from '../../utils/isoDay';

/**
 * On-device state of "Teny ho anao". This is about someone's private life
 * (grief, addiction, money…), so it never leaves the phone: no sync, and
 * failures are NOT sent to the issue queue (reportSchedulingFailure) — a
 * report would carry the context. The widget and notifications only ever
 * show the verse itself, never the situation's name.
 *
 * Plain storage only; callers re-sync the widget and reminders after a write
 * (see hooks/useTenyHoAnao), which keeps this module free of an import cycle
 * with readingReminder.
 */

export type TenyHoAnaoState = {
  // Rank order: the person's own, first = weighs on them most.
  situations: ActiveSituation[];
  onWidget: boolean;
  inReminders: boolean;
};

const STORAGE_KEY = 'settings.tenyHoAnao';

export const EMPTY_STATE: TenyHoAnaoState = {situations: [], onWidget: true, inReminders: true};

const warn = (where: string, error: unknown) => {
  if (__DEV__) console.warn(`[tenyHoAnao] ${where} failed:`, error);
};

const isActiveSituation = (value: unknown): value is ActiveSituation => {
  if (typeof value !== 'object' || value === null) return false;
  const {id, startedOn} = value as Record<string, unknown>;
  return typeof id === 'string' && !!situationById(id as SituationId) && typeof startedOn === 'string';
};

/**
 * The stored state, minus short/season plans that already ran out unanswered
 * (they have handed back to the normal daily verse).
 */
export const loadTenyHoAnao = async (today = new Date()): Promise<TenyHoAnaoState> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<Record<keyof TenyHoAnaoState, unknown>>;
    const situations = Array.isArray(parsed.situations)
      ? parsed.situations.filter(isActiveSituation).filter(s => isLive(s, today))
      : [];
    return {
      situations,
      onWidget: parsed.onWidget !== false,
      inReminders: parsed.inReminders !== false,
    };
  } catch (error) {
    warn('load', error);
    return EMPTY_STATE;
  }
};

export const saveTenyHoAnao = async (state: TenyHoAnaoState): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    warn('save', error);
  }
};

export const clearTenyHoAnao = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    warn('clear', error);
  }
};

// Pure state transitions, used by the screen's hook.

export const addSituation = (state: TenyHoAnaoState, id: SituationId, today = new Date()): TenyHoAnaoState =>
  state.situations.some(s => s.id === id)
    ? state
    : {...state, situations: [...state.situations, {id, startedOn: isoDay(today)}]};

export const removeSituation = (state: TenyHoAnaoState, id: SituationId): TenyHoAnaoState => ({
  ...state,
  situations: state.situations.filter(s => s.id !== id),
});

export const moveSituation = (state: TenyHoAnaoState, id: SituationId, delta: -1 | 1): TenyHoAnaoState => {
  const from = state.situations.findIndex(s => s.id === id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= state.situations.length) return state;
  const situations = [...state.situations];
  [situations[from], situations[to]] = [situations[to], situations[from]];
  return {...state, situations};
};

// "Mbola eo": the plan goes on and the next check-in moves forward.
export const confirmStillIn = (state: TenyHoAnaoState, id: SituationId, today = new Date()): TenyHoAnaoState => ({
  ...state,
  situations: state.situations.map(s => (s.id === id ? {...s, checkedOn: isoDay(today)} : s)),
});
