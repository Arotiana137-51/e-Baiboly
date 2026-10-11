import {useCallback, useEffect, useRef, useState} from 'react';
import type {SituationId} from '../constants/lifeSituations';
import {ensureRemindersScheduled} from '../services/reminders/readingReminder';
import {syncDailyVerseWidget} from '../services/widget/dailyVerseWidget';
import {
  EMPTY_STATE,
  addSituation,
  clearTenyHoAnao,
  confirmStillIn,
  loadTenyHoAnao,
  moveSituation,
  removeSituation,
  saveTenyHoAnao,
  type TenyHoAnaoState,
} from '../services/lifeSituations/situationStore';
import {checkInsDue, type ActiveSituation} from '../utils/lifeSituations';

// Widget feed and verse notifications are precomputed, so every change is
// pushed to both. Fire-and-forget: each one already swallows its errors.
const resync = () => {
  syncDailyVerseWidget();
  ensureRemindersScheduled();
};

/** State and actions behind the "Teny ho anao" screen. */
export const useTenyHoAnao = () => {
  const [state, setState] = useState<TenyHoAnaoState>(EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);
  // Latest state for back-to-back taps that land before a re-render.
  const stateRef = useRef(state);

  useEffect(() => {
    let cancelled = false;
    loadTenyHoAnao().then(stored => {
      if (cancelled) return;
      stateRef.current = stored;
      setState(stored);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback(async (next: TenyHoAnaoState) => {
    stateRef.current = next;
    setState(next);
    await saveTenyHoAnao(next);
    resync();
  }, []);

  const add = useCallback((id: SituationId) => apply(addSituation(stateRef.current, id)), [apply]);
  const remove = useCallback((id: SituationId) => apply(removeSituation(stateRef.current, id)), [apply]);
  const move = useCallback(
    (id: SituationId, delta: -1 | 1) => apply(moveSituation(stateRef.current, id, delta)),
    [apply],
  );
  const stillIn = useCallback((id: SituationId) => apply(confirmStillIn(stateRef.current, id)), [apply]);
  const setOnWidget = useCallback(
    (onWidget: boolean) => apply({...stateRef.current, onWidget}),
    [apply],
  );
  const setInReminders = useCallback(
    (inReminders: boolean) => apply({...stateRef.current, inReminders}),
    [apply],
  );

  const clearAll = useCallback(async () => {
    stateRef.current = EMPTY_STATE;
    setState(EMPTY_STATE);
    await clearTenyHoAnao();
    resync();
  }, []);

  const due: ActiveSituation[] = checkInsDue(new Date(), state.situations);

  return {state, loaded, due, add, remove, move, stillIn, setOnWidget, setInReminders, clearAll};
};
