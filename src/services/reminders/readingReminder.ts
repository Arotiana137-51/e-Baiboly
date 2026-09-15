import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AlarmType,
  AndroidBadgeIconType,
  AndroidImportance,
  AndroidStyle,
  AndroidVisibility,
  RepeatFrequency,
  TriggerType,
  type NotificationIOS,
} from '@notifee/react-native';
import {bibleDatabaseService} from '../database/DatabaseService';
import {dailyVerseFor, type VerseRef} from '../../constants/dailyVerses';
import {getBibleBookShortName} from '../../utils/bibleBookNames';
import {getStoredPrimaryColor} from '../../utils/primaryColorStorage';
import {PRIMARY_COLOR_OPTIONS} from '../../theme/personalizationPalette';
import {enqueueIssueReport} from '../reporting/issueReportQueue';

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
 * Scheduling is deliberately INEXACT: AlarmManager's setAndAllowWhileIdle
 * (a few minutes of drift is fine for "read around this time") — it needs no
 * exact-alarm permission, so the manifest strip in
 * android/app/src/main/AndroidManifest.xml stays, yet unlike notifee's
 * default WorkManager path it still fires from Doze after a night idle.
 *
 * Permission (notifee.requestPermission) is orchestrated by the screen, not
 * here — this module assumes permission is already granted by the time it's
 * asked to schedule something.
 */

const STORAGE_KEY_SLOTS = 'settings.readingReminder.slots';
const CHANNEL_ID = 'reading-reminder';
// Android channel settings are immutable once created, so the user's
// "quiet vs prominent" choice for the verse maps to two channels.
const VERSE_CHANNEL_QUIET_ID = 'daily-verse-quiet';
const VERSE_CHANNEL_PROMINENT_ID = 'daily-verse';

export const MAX_REMINDER_SLOTS = 5;

// Id of the default daily-verse slot created by the onboarding opt-in, so
// re-running onboarding can't create a second one.
export const DAILY_VERSE_SLOT_ID = 'daily-verse';

// A repeating trigger has a fixed body, so verse slots are scheduled as
// one-shot triggers for the next N occurrences and topped up on every launch
// by ensureRemindersScheduled.
// ponytail: 12-day window — if the app isn't opened for two weeks the verse
// stops until next launch. Upgrade path: notifee onBackgroundEvent DELIVERED
// → schedule the next one. 12 keeps 5 slots under iOS's cap of 64 pending.
const VERSE_WINDOW_DAYS = 12;

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
  // Verse slots only. The user's explicit authorization for the verse to pop
  // up with sound and show its text on the lock screen; undefined = quiet.
  prominent?: boolean;
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

// pressAction is what makes a tap open the app on Android — without it
// notifee only emits the PRESS event. badgeIconType SMALL puts the tinted
// small icon (the "app-colour icon") in the launcher's long-press popup.
const androidBase = (channelId: string, color: string) => ({
  channelId,
  color,
  smallIcon: 'ic_notification', // kept through shrinking by res/raw/keep.xml
  badgeIconType: AndroidBadgeIconType.SMALL,
  pressAction: {id: 'default'},
});

// iOS has no channels: sound and interruption level travel with each
// notification. 'passive' = listed on the lock screen / Notification Center
// without sound or lighting the screen.
const iosFor = (prominent: boolean): NotificationIOS =>
  prominent
    ? {
        sound: 'default',
        interruptionLevel: 'active',
        foregroundPresentationOptions: {banner: true, list: true, sound: true, badge: false},
      }
    : {
        interruptionLevel: 'passive',
        foregroundPresentationOptions: {banner: false, list: true, sound: false, badge: false},
      };

// Inexact alarm that may still fire in Doze; no exact-alarm permission needed.
const ALARM = {alarmManager: {type: AlarmType.SET_AND_ALLOW_WHILE_IDLE}};

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

    const prominent = slot.prominent === true;
    await notifee.createTriggerNotification(
      {
        id: `${notificationIdFor(slot.id)}-${yyyymmdd(when)}`,
        title,
        body,
        data: {bookId: ref.b, bookName, chapter: ref.c, verse: ref.v},
        android: {
          ...androidBase(prominent ? VERSE_CHANNEL_PROMINENT_ID : VERSE_CHANNEL_QUIET_ID, color),
          visibility: prominent ? AndroidVisibility.PUBLIC : AndroidVisibility.PRIVATE,
          style: {type: AndroidStyle.BIGTEXT, text: body},
        },
        ios: {...iosFor(prominent), threadId: 'daily-verse'},
      },
      {type: TriggerType.TIMESTAMP, timestamp: when.getTime(), ...ALARM},
    );
  }
};

// Channel names are placeholder MG copy — user-owned.
const ensureChannels = async (): Promise<void> => {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Ora famakiana',
    importance: AndroidImportance.DEFAULT,
  });
  await notifee.createChannel({
    id: VERSE_CHANNEL_QUIET_ID,
    name: 'Sakafom-panahy',
    importance: AndroidImportance.LOW,
    visibility: AndroidVisibility.PRIVATE,
  });
  await notifee.createChannel({
    id: VERSE_CHANNEL_PROMINENT_ID,
    name: 'Sakafom-panahy (mipoitra)',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
    badge: true,
  });
};

const scheduleSlot = async (slot: ReminderSlot): Promise<void> => {
  await ensureChannels();

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
      android: androidBase(CHANNEL_ID, color),
      ios: iosFor(true), // an explicit "remind me" request
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp,
      repeatFrequency:
        slot.frequency === 'weekly' ? RepeatFrequency.WEEKLY : RepeatFrequency.DAILY,
      ...ALARM,
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
    reportSchedulingFailure('ensureRemindersScheduled', error);
  }
};

/**
 * Scheduling must never crash the app, but a failure here means a user
 * silently stops getting notifications, so it goes into the same issue
 * queue the crash reporter uses (flushed on reconnect) instead of vanishing.
 */
export const reportSchedulingFailure = (where: string, error: unknown): void => {
  if (__DEV__) console.warn(`[readingReminder] ${where} failed:`, error);
  const err = error instanceof Error ? error : new Error(String(error));
  enqueueIssueReport({
    id: `crash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    type: 'crash',
    reference: `readingReminder.${where}`,
    text: err.message,
    comment: err.stack ?? '',
  }).catch(() => {
    // best-effort only
  });
};
