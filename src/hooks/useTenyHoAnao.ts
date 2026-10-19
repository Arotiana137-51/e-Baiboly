import {useCallback, useEffect, useRef, useState} from 'react';
import type {SituationId} from '../constants/lifeSituations';
import {ensureRemindersScheduled} from '../services/reminders/readingReminder';
import {syncDailyVerseWidget} from '../services/widget/dailyVerseWidget';
import {
  EMPTY_STATE,
  addSituation,
  confirmStillIn,
  loadTenyHoAnao,
  moveSituation,
  rebaseState,
  removeSituation,
  saveTenyHoAnao,
  type TenyHoAnaoState,
} from '../services/lifeSituations/situationStore';
import {checkInsDue, isLive} from '../utils/lifeSituations';

// Widget feed and verse notifications are precomputed, so every change is
// pushed to both. One rebuild at a time: taps during a run fold into one more
// run, so an older rebuild never lands after a newer one. Each step already
// swallows its own errors.
let resyncing = false;
let resyncAgain = false;
const resync = async () => {
  if (resyncing) {
    resyncAgain = true;
    return;
  }
  resyncing = true;
  try {
    do {
      resyncAgain = false;
      await syncDailyVerseWidget();
      await ensureRemindersScheduled();
    } while (resyncAgain);
  } finally {
    resyncing = false;
  }
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

  // A change to the list starts from positions frozen at today, so it never
  // makes the other plans skip or repeat a verse.
  const change = useCallback(
    (fn: (base: TenyHoAnaoState) => TenyHoAnaoState) => apply(fn(rebaseState(stateRef.current))),
    [apply],
  );

  const remove = useCallback((id: SituationId) => change(s => removeSituation(s, id)), [change]);
  const move = useCallback(
    (id: SituationId, delta: -1 | 1) => change(s => moveSituation(s, id, delta)),
    [change],
  );
  const stillIn = useCallback((id: SituationId) => change(s => confirmStillIn(s, id)), [change]);
  const setOnWidget = useCallback(
    (onWidget: boolean) => apply({...stateRef.current, onWidget}),
    [apply],
  );
  const setInReminders = useCallback(
    (inReminders: boolean) => apply({...stateRef.current, inReminders}),
    [apply],
  );

  // Step-by-step editing works on a copy, saved in one go at the end. It
  // starts from the frozen current state, and a situation unticked then
  // ticked again comes back as it was, so situations kept keep their start
  // date and their place in their plan.
  const [draft, setDraft] = useState<TenyHoAnaoState | null>(null);
  const draftBase = useRef<TenyHoAnaoState | null>(null);
  const startEditing = useCallback(() => {
    draftBase.current = rebaseState(stateRef.current);
    setDraft(draftBase.current);
  }, []);
  const cancelEditing = useCallback(() => setDraft(null), []);
  // Back to the default choice, the general calendar ("Fampaherezana tsotra").
  const clearDraft = useCallback(() => setDraft(d => d && {...d, situations: []}), []);
  const toggleDraft = useCallback(
    (id: SituationId) =>
      setDraft(d => {
        if (!d) return d;
        if (d.situations.some(s => s.id === id)) return removeSituation(d, id);
        const kept = draftBase.current?.situations.find(s => s.id === id);
        return kept ? {...d, situations: [...d.situations, kept]} : addSituation(d, id);
      }),
    [],
  );
  const moveDraft = useCallback(
    (id: SituationId, delta: -1 | 1) => setDraft(d => d && moveSituation(d, id, delta)),
    [],
  );
  const commitDraft = useCallback(async () => {
    if (!draft) return;
    setDraft(null);
    await apply(draft);
  }, [draft, apply]);

  const clearAll = useCallback(() => apply(EMPTY_STATE), [apply]);

  // Ended plans stay in storage until the next change; the screen only
  // shows the live ones.
  const today = new Date();
  const live = state.situations.filter(s => isLive(s, today));

  return {
    state: live.length === state.situations.length ? state : {...state, situations: live},
    loaded,
    due: checkInsDue(today, live),
    remove,
    move,
    stillIn,
    setOnWidget,
    setInReminders,
    clearAll,
    draft,
    startEditing,
    cancelEditing,
    clearDraft,
    toggleDraft,
    moveDraft,
    commitDraft,
  };
};
