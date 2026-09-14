import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AndroidImportance,
  AndroidStyle,
  RepeatFrequency,
  TriggerType,
} from '@notifee/react-native';
import {bibleDatabaseService} from '../database/DatabaseService';
import {dailyVerseFor, type VerseRef} from '../../constants/dailyVerses';
import {getBibleBookShortName} from '../../utils/bibleBookNames';
import {getStoredPrimaryColor} from '../../utils/primaryColorStorage';
import {PRIMARY_COLOR_OPTIONS} from '../../theme/personalizationPalette';

/**
 * "Ora famakiana tiana" — optional, on-device reminders to read the Bible,
 * each delivered as a real OS notification (not an in-app banner). Fully
 * local: no backend, no push, nothing leaves the device.
 *
 * A user can keep several independent reminder slots — e.g. twice a day, or
 * a daily one plus a weekly one — rather than a single fixed time. "Twice a
 * day" is just two daily slots; there's no separate "N times a day" concept.
 *
 * A slot of kind 'verse' carries the day's verse (see constants/dailyVerses)
 * as the notification body instead of the fixed reminder text; tapping it
 * opens that verse in the reader (see the press handler in App.tsx).
 *
 * Scheduling is deliberately INEXACT (no `alarmManager` option on the
 * trigger) — a few minutes of drift is an acceptable tradeoff for "read
 * around this time", and it avoids Android 12+'s exact-alarm permission
 * dance entirely (see the matching manifest strip in
 * android/app/src/main/AndroidManifest.xml).
 *
 * Permission (notifee.requestPermission) is orchestrated by the screen, not
 * here — this module assumes permission is already granted by the time it's
 * asked to schedule something.
 */

const STORAGE_KEY_SLOTS = 'settings.readingReminder.slots';
const CHANNEL_ID = 'reading-reminder';

export const MAX_REMINDER_SLOTS = 5;

// Id of the default daily-verse slot created by the onboarding opt-in, so
// re-running onboarding can't create a second one.
export const DAILY_VERSE_SLOT_ID = 'daily-verse';

// A repeating trigger has a fixed body, so verse slots are scheduled as
// one-shot triggers for the next N occurrences and topped up on every launch
// by ensureRemindersScheduled.
// ponytail: 14-day window — if the app isn't opened for two weeks the verse
// stops until next launch. Upgrade path: notifee onBackgroundEvent DELIVERED
// → schedule the next one. iOS caps pending notifications at 64.
const VERSE_WINDOW_DAYS = 14;

export type ReminderFrequency = 'daily' | 'weekly';

export type ReminderSlot = {
  id: string;
  enabled: boolean;
  time: string; // "HH:mm", 24h
  frequency: ReminderFrequency;
  // 0 (Sunday) - 6 (Saturday), same convention as Date#getDay(). Required
  // when frequency === 'weekly', unused for 'daily'.
  dayOfWeek?: number;
  // undefined = plain reminder (all pre-existing slots), 'verse' = daily verse.
  kind?: 'verse';
};

const notificationIdFor = (slotId: string) => `reading-reminder-${slotId}`;

export const createSlotId = (): string =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getReminderSlots = async (): Promise<ReminderSlot[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_SLOTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ReminderSlot[]) : [];
  } catch {
    return [];
  }
};

const persistSlots = async (slots: ReminderSlot[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(slots));
  } catch {
    // best-effort persistence, same convention as issueReportQueue.ts
  }
};

// Next local-time occurrence of `time` (today if still upcoming, else
// tomorrow). No date library needed for a once-a-day timestamp.
const nextDailyOccurrence = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date();
  next.setSeconds(0, 0);
  next.setHours(hours, minutes);
  if (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
};

// Next local-time occurrence of `time` on the given day of week (0=Sunday).
const nextWeeklyOccurrence = (time: string, dayOfWeek: number): number => {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date();
  next.setSeconds(0, 0);
  next.setHours(hours, minutes);
  let daysAhead = (dayOfWeek - next.getDay() + 7) % 7;
  if (daysAhead === 0 && next.getTime() <= Date.now()) {
    daysAhead = 7;
  }
  next.setDate(next.getDate() + daysAhead);
  return next.getTime();
};

// Accent for the notification (small icon + app name on Android) follows the
// app's selected primary color. iOS has no notification color.
const notificationAccent = async (): Promise<string> =>
  (await getStoredPrimaryColor()) ?? PRIMARY_COLOR_OPTIONS[0].hex;

const androidBase = (color: string) => ({channelId: CHANNEL_ID, color, smallIcon: 'ic_notification'});

// Section headings (<n>[...]</n>) belong to the reader layout, not the verse.
const plainVerseText = (text: string): string =>
  text
    .replace(/<n>\s*\[.*?\]\s*<\/n>/gis, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const yyyymmdd = (date: Date): string =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

const scheduleVerseSlot = async (slot: ReminderSlot, color: string): Promise<void> => {
  await bibleDatabaseService.initDatabase(); // idempotent — safe before the provider mounts
  const step = slot.frequency === 'weekly' ? 7 : 1;
  const first = new Date(
    slot.frequency === 'weekly'
      ? nextWeeklyOccurrence(slot.time, slot.dayOfWeek ?? 0)
      : nextDailyOccurrence(slot.time),
  );

  for (let i = 0; i < VERSE_WINDOW_DAYS; i += step) {
    // setDate rather than adding ms so a DST change doesn't shift the hour.
    const when = new Date(first);
    when.setDate(first.getDate() + i);
    const ref: VerseRef = dailyVerseFor(when);

    const {rows} = await bibleDatabaseService.executeQuery<{text: string; name: string}>(
      'SELECT v.text, b.name FROM Verses v JOIN Books b ON b.id = v.book_id WHERE v.book_id = ? AND v.chapter = ? AND v.verse_number BETWEEN ? AND ? ORDER BY v.verse_number',
      [ref.b, ref.c, ref.v, ref.to ?? ref.v],
    );
    if (rows.length === 0) continue;

    const body = rows.map(r => plainVerseText(r.text)).join(' ');
    const bookName = rows[0].name;
    const title = `${getBibleBookShortName(bookName, ref.b)} ${ref.c}:${ref.v}${ref.to ? `-${ref.to}` : ''}`;

    await notifee.createTriggerNotification(
      {
        id: `${notificationIdFor(slot.id)}-${yyyymmdd(when)}`,
        title,
        body,
        data: {bookId: ref.b, bookName, chapter: ref.c, verse: ref.v},
        android: {...androidBase(color), style: {type: AndroidStyle.BIGTEXT, text: body}},
      },
      {type: TriggerType.TIMESTAMP, timestamp: when.getTime()},
    );
  }
};

const scheduleSlot = async (slot: ReminderSlot): Promise<void> => {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Ora famakiana', // placeholder — user-owned MG copy
    importance: AndroidImportance.DEFAULT,
  });

  const color = await notificationAccent();
  if (slot.kind === 'verse') {
    await scheduleVerseSlot(slot, color);
    return;
  }

  const timestamp =
    slot.frequency === 'weekly'
      ? nextWeeklyOccurrence(slot.time, slot.dayOfWeek ?? 0)
      : nextDailyOccurrence(slot.time);

  await notifee.createTriggerNotification(
    {
      id: notificationIdFor(slot.id),
      title: 'Ora famakiana Baiboly', // placeholder — user-owned MG copy
      body: "Tonga ny fotoana hamakiana ny Tenin'Andriamanitra", // placeholder
      android: androidBase(color),
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp,
      repeatFrequency:
        slot.frequency === 'weekly' ? RepeatFrequency.WEEKLY : RepeatFrequency.DAILY,
      // No `alarmManager` key — inexact by default, see module doc above.
    },
  );
};

// Cancels by id prefix so it covers both the single repeating id of a plain
// slot and the per-day ids of a verse slot.
const cancelSlot = async (slotId: string): Promise<void> => {
  try {
    const prefix = notificationIdFor(slotId);
    const ids = await notifee.getTriggerNotificationIds();
    await Promise.all(
      ids.filter(id => id.startsWith(prefix)).map(id => notifee.cancelTriggerNotification(id)),
    );
  } catch (error) {
    if (__DEV__) console.warn('[readingReminder] cancel failed:', error);
  }
};

/**
 * Upserts a slot by id (new id → appended, existing id → replaced) and
 * (re)schedules or cancels its native trigger to match `enabled`. Caller is
 * responsible for permission — this assumes it's already granted when
 * `enabled` is true.
 */
export const saveReminderSlot = async (slot: ReminderSlot): Promise<void> => {
  const slots = await getReminderSlots();
  const index = slots.findIndex(s => s.id === slot.id);
  const next = index === -1 ? [...slots, slot] : slots.map(s => (s.id === slot.id ? slot : s));
  await persistSlots(next);

  // Always clear first: an edited verse slot (new time, daily → weekly)
  // would otherwise leave its old per-day triggers pending.
  await cancelSlot(slot.id);
  if (slot.enabled) {
    await scheduleSlot(slot);
  }
};

export const deleteReminderSlot = async (slotId: string): Promise<void> => {
  const slots = await getReminderSlots();
  await persistSlots(slots.filter(s => s.id !== slotId));
  await cancelSlot(slotId);
};

/**
 * Idempotent re-arm, called once on app launch. notifee's own receivers
 * already re-arm each trigger after it fires and after device reboot; this
 * closes the remaining gap where Android force-stop or an aggressive OEM
 * battery manager silently drops a pending alarm with no signal to JS.
 */
export const ensureRemindersScheduled = async (): Promise<void> => {
  try {
    const slots = await getReminderSlots();
    for (const slot of slots) {
      if (slot.enabled) {
        await scheduleSlot(slot);
      }
    }
  } catch (error) {
    if (__DEV__) console.warn('[readingReminder] ensureRemindersScheduled failed:', error);
  }
};
