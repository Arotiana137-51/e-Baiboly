import {useEffect, useState} from 'react';
import {dailyVerseFor, type VerseRef} from '../constants/dailyVerses';
import {bibleDatabaseService} from '../services/database/DatabaseService';
import {verseForDate, type DailyVerse} from '../services/reminders/readingReminder';
import type {TenyHoAnaoState} from '../services/lifeSituations/situationStore';
import {isCheckInDay, situationSchedule} from '../utils/lifeSituations';

// The verse the widget shows today, picked the way syncDailyVerseWidget does:
// the next plan verse, or the calendar verse when there is no plan (or the
// plans are kept off the widget). Null on a check-in day, when the widget
// asks instead of showing a verse.
export const todaysWidgetRef = (state: TenyHoAnaoState, today = new Date()): VerseRef | null => {
  const situations = state.onWidget ? state.situations : [];
  if (isCheckInDay(today, situations)) return null;
  return situationSchedule(situations, today, 1, state.since)[0][0]?.ref ?? dailyVerseFor(today);
};

// A verse's MG text and reference, read from the bundled Bible.
export const useVerse = (ref: VerseRef | null): DailyVerse | null => {
  const [verse, setVerse] = useState<DailyVerse | null>(null);
  const key = ref ? `${ref.b}:${ref.c}:${ref.v}-${ref.to ?? ref.v}` : '';

  useEffect(() => {
    // Cleared first, so another ref never shows the previous verse meanwhile.
    setVerse(null);
    if (!ref) return;
    let live = true;
    bibleDatabaseService
      .initDatabase()
      .then(() => verseForDate(new Date(), ref))
      .then(found => live && setVerse(found))
      .catch(() => live && setVerse(null));
    return () => {
      live = false;
    };
    // The ref object is rebuilt on each render; its key is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return verse;
};
