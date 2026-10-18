import {NativeModules, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from 'react-native-fs';
import {bibleDatabaseService} from '../database/DatabaseService';
import {reportSchedulingFailure, verseForDate} from '../reminders/readingReminder';
import {getStoredPrimaryColor} from '../../utils/primaryColorStorage';
import {findPrimaryColorOption, PRIMARY_COLOR_OPTIONS} from '../../theme/personalizationPalette';
import {lookForColor, nightLook, widgetInk, type ShareCardLook, type WidgetInk} from '../../utils/shareCard';
import {isoDay} from '../../utils/isoDay';
import {isCheckInDay, planPosition, situationSchedule, type ActiveSituation} from '../../utils/lifeSituations';
import {dailyVerseFor, type VerseRef} from '../../constants/dailyVerses';
import type {BibleVerse} from '../../hooks/useBibleData';
import {FAVORITES_KEY} from '../../constants/favorites';
import {loadTenyHoAnao} from '../lifeSituations/situationStore';

/**
 * Home-screen widget feed. Widgets are native UI on both platforms, so JS
 * computes and native displays: this writes `dailyVerse.json` with the verse
 * for each of the next WIDGET_WINDOW_DAYS days, the chosen look and text
 * settings, and per day a deep link, a date label, the mode shown next to the
 * translation tag and whether the verse is a favorite; the Android
 * AppWidgetProvider and the iOS WidgetKit extension only read it (see
 * android/.../DailyVerseWidgetProvider.kt and ios/DailyVerseWidget/). Keys are
 * the LOCAL calendar date, yyyy-MM-dd.
 *
 * The look is the share card's vocabulary (utils/shareCard): a flat colour
 * with matching ink, or a photo under a veil, with the text contrast the
 * person chose (widgetInk). With "follow dark mode" on, `lookDark` carries
 * its night version and native swaps the two with the phone's dark mode. A
 * chosen photo is copied next to the feed as WIDGET_IMAGE_NAME so both widgets
 * can read it; only the file name travels in the JSON because the sandbox
 * path can change between launches.
 *
 * The widget's heart writes the wanted state of a verse into
 * WIDGET_FAVORITES_NAME, next to the feed; the app folds it into its
 * favorites (takeWidgetHearts) and the next feed carries the new `fav`.
 *
 * NOTE: 60-day window — a phone that doesn't open the app for two months
 * shows the widget's built-in "open the app" fallback until the next launch.
 */

export const WIDGET_FILE_NAME = 'dailyVerse.json';
export const WIDGET_IMAGE_NAME = 'widgetBackground.jpg';
export const WIDGET_FAVORITES_NAME = 'widgetFavorites.json';
export const IOS_APP_GROUP = 'group.com.ebaiboly.app';
const WIDGET_WINDOW_DAYS = 60;
const STORAGE_KEY_LOOK = 'settings.widget.look';
const STORAGE_KEY_FOLLOW_DARK = 'settings.widget.followDark';
const STORAGE_KEY_TEXT = 'settings.widget.text';

// What is persisted: the look minus the temporary picker URI, plus whether a
// copied photo exists.
type StoredLook = {background: string; text: string; accent: string; image?: boolean};

export type WidgetFont = 'serif' | 'sans' | 'italic';
export type WidgetText = {scale: number; font: WidgetFont; ink: WidgetInk};
export const WIDGET_TEXT_SCALES = [0.85, 1, 1.15, 1.3];
export const DEFAULT_WIDGET_TEXT: WidgetText = {scale: 1, font: 'serif', ink: 'auto'};

// Opens the "Teny ho anao" screen, where the check-in is answered.
export const TENY_HO_ANAO_URL = 'ebaiboly://teny-ho-anao';
// The heart on an iPhone without interactive widgets (iOS 15-16):
// ebaiboly://favorite?key=19:23:1&name=Salamo&on=1 (see App.tsx).
export const FAVORITE_URL = 'ebaiboly://favorite';

// Check-in card shown instead of the verse on a check-in day. Deliberately
// generic: whoever glances at the home screen must not learn the situation.
// Placeholder MG copy — user-owned.
const CHECK_IN_CARD = {
  ref: 'Teny ho anao',
  text: 'Mbola mety aminao ve ireo teny ireo? Tsindrio eto raha hamaly.',
};

// The mode shown next to the translation tag on a calendar day.
// Placeholder MG copy — user-owned.
const CALENDAR_LABEL = 'Fampaherezana';

// A plan day's label, so the person knows the verse is from their plan.
// Never the situation's name, for the same reason as the check-in card.
// Placeholder MG copy — user-owned.
const planLabel = (
  id: ActiveSituation['id'],
  situations: ReadonlyArray<ActiveSituation>,
  date: Date,
  since?: string,
): string => {
  const {shown, days} = planPosition(id, situations, date, since);
  return days ? `Teny ho anao · ${shown}/${days}` : 'Teny ho anao';
};

export const verseDeepLink = (v: {bookId: number; bookName: string; chapter: number; verse: number}) =>
  `ebaiboly://verse?book=${v.bookId}&chapter=${v.chapter}&verse=${v.verse}&name=${encodeURIComponent(v.bookName)}`;

// Placeholder MG copy — user-owned. Same day abbreviations as the reminder
// screen; months are the standard Malagasy names, abbreviated.
const DAY_SHORT = ['Alh', 'Alt', 'Tal', 'Alr', 'Alk', 'Zom', 'Sab'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mey', 'Jon', 'Jol', 'Aog', 'Sep', 'Okt', 'Nov', 'Des'];
const TRANSLATION = 'MG1865';

// "Tal 15 Sep" — shown in the widget's date badge.
const dateLabel = (date: Date): string =>
  `${DAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;

// "19:23:1" or "20:3:5-6": how the widget and the app name a verse for the heart.
export const verseKey = (ref: VerseRef): string => `${ref.b}:${ref.c}:${ref.v}${ref.to ? `-${ref.to}` : ''}`;

export const parseVerseKey = (key: string): VerseRef | null => {
  const m = /^(\d+):(\d+):(\d+)(?:-(\d+))?$/.exec(key);
  if (!m) return null;
  return {b: Number(m[1]), c: Number(m[2]), v: Number(m[3]), ...(m[4] ? {to: Number(m[4])} : {})};
};

const widgetDir = async (): Promise<string> =>
  Platform.OS === 'ios' ? await RNFS.pathForGroup(IOS_APP_GROUP) : RNFS.DocumentDirectoryPath;

// A palette colour is saved with the ink of its day; recomputing it keeps an
// older choice in step with lookForColor (white on dark, black on light).
const withCurrentInk = (stored: StoredLook): StoredLook =>
  !stored.image && findPrimaryColorOption(stored.background) ? {...stored, ...lookForColor(stored.background)} : stored;

const readStoredLook = async (): Promise<StoredLook | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_LOOK);
    return raw ? withCurrentInk(JSON.parse(raw) as StoredLook) : null;
  } catch {
    return null;
  }
};

/**
 * The widget's look as the picker understands it. No stored choice = the
 * app's own primary colour with matching ink, so the widget follows
 * "Safidio ny loko" until the user picks something else.
 */
export const getWidgetLook = async (): Promise<ShareCardLook> => {
  const stored = await readStoredLook();
  if (!stored) {
    return lookForColor((await getStoredPrimaryColor()) ?? PRIMARY_COLOR_OPTIONS[0].hex);
  }
  const {image, ...look} = stored;
  return image ? {...look, imageUri: `file://${await widgetDir()}/${WIDGET_IMAGE_NAME}`} : look;
};

/** Whether the widget switches to a night look with the phone's dark mode. Off by default. */
export const getWidgetFollowDark = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY_FOLLOW_DARK)) === 'true';
  } catch {
    return false;
  }
};

export const setWidgetFollowDark = async (on: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_FOLLOW_DARK, on ? 'true' : 'false');
  } catch (error) {
    reportSchedulingFailure('setWidgetFollowDark', error);
  }
  await syncDailyVerseWidget();
};

/** Size, typeface and contrast of the widget's text. */
export const getWidgetText = async (): Promise<WidgetText> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_TEXT);
    return raw ? {...DEFAULT_WIDGET_TEXT, ...(JSON.parse(raw) as Partial<WidgetText>)} : DEFAULT_WIDGET_TEXT;
  } catch {
    return DEFAULT_WIDGET_TEXT;
  }
};

export const setWidgetText = async (text: WidgetText): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_TEXT, JSON.stringify(text));
  } catch (error) {
    reportSchedulingFailure('setWidgetText', error);
  }
  await syncDailyVerseWidget();
};

/** Persists a look (copying a freshly picked photo next to the feed) and re-syncs the widget. */
export const setWidgetLook = async (look: ShareCardLook): Promise<void> => {
  try {
    const dest = `${await widgetDir()}/${WIDGET_IMAGE_NAME}`;
    const image = !!look.imageUri;
    if (image && look.imageUri !== `file://${dest}`) {
      if (await RNFS.exists(dest)) await RNFS.unlink(dest);
      await RNFS.copyFile(look.imageUri!, dest);
    }
    const stored: StoredLook = {background: look.background, text: look.text, accent: look.accent, image};
    await AsyncStorage.setItem(STORAGE_KEY_LOOK, JSON.stringify(stored));
  } catch (error) {
    reportSchedulingFailure('setWidgetLook', error);
  }
  await syncDailyVerseWidget();
};

// Verses kept as favorites, as "book:chapter:verse".
const favoriteVerses = async (): Promise<Set<string>> => {
  try {
    const list = JSON.parse((await AsyncStorage.getItem(FAVORITES_KEY)) ?? '[]') as BibleVerse[];
    return new Set(list.map(f => `${f.book_id}:${f.chapter}:${f.verse_number}`));
  } catch {
    return new Set();
  }
};

const versesIn = (ref: VerseRef): number[] =>
  Array.from({length: (ref.to ?? ref.v) - ref.v + 1}, (_, i) => ref.v + i);

const heartsPath = async () => `${await widgetDir()}/${WIDGET_FAVORITES_NAME}`;

const readHearts = async (): Promise<Record<string, boolean>> => {
  const path = await heartsPath();
  if (!(await RNFS.exists(path))) return {};
  return JSON.parse(await RNFS.readFile(path, 'utf8')) as Record<string, boolean>;
};

// Lets the favorites provider fold in a heart the app itself recorded (the
// iOS 15-16 link) without waiting for the app to come back to the front.
const heartListeners = new Set<() => void>();
export const onWidgetHearts = (listener: () => void): (() => void) => {
  heartListeners.add(listener);
  return () => {
    heartListeners.delete(listener);
  };
};

/** Records a heart the way the widget does (the iOS 15-16 link lands here). */
export const recordWidgetHeart = async (key: string, on: boolean): Promise<void> => {
  try {
    const hearts = await readHearts();
    await RNFS.writeFile(await heartsPath(), JSON.stringify({...hearts, [key]: on}), 'utf8');
  } catch (error) {
    reportSchedulingFailure('recordWidgetHeart', error);
  }
  heartListeners.forEach(listener => listener());
};

export type WidgetHeart = {on: boolean; verses: Array<BibleVerse & {bookName: string}>};

/**
 * Hearts tapped on the widget since the app last looked, read once and
 * cleared, with each verse resolved against the bundled Bible so the
 * favorites list stores what the reader would.
 */
export const takeWidgetHearts = async (): Promise<WidgetHeart[]> => {
  try {
    const hearts = await readHearts();
    const keys = Object.keys(hearts);
    if (keys.length === 0) return [];
    await RNFS.unlink(await heartsPath());
    await bibleDatabaseService.initDatabase();
    const out: WidgetHeart[] = [];
    for (const key of keys) {
      const ref = parseVerseKey(key);
      if (!ref) continue;
      const {rows} = await bibleDatabaseService.executeQuery<BibleVerse & {bookName: string}>(
        'SELECT v.id, v.book_id, v.chapter, v.verse_number, v.text, v.title, b.name AS bookName FROM Verses v JOIN Books b ON b.id = v.book_id WHERE v.book_id = ? AND v.chapter = ? AND v.verse_number BETWEEN ? AND ? ORDER BY v.verse_number',
        [ref.b, ref.c, ref.v, ref.to ?? ref.v],
      );
      out.push({on: hearts[key], verses: rows});
    }
    return out;
  } catch (error) {
    reportSchedulingFailure('takeWidgetHearts', error);
    return [];
  }
};

type FeedDay = {
  ref: string;
  text: string;
  url: string;
  dateLabel: string;
  label: string;
  // The verse, for the heart (absent on a check-in day).
  key?: string;
  fav?: boolean;
  favUrl?: string;
};

const writeFeed = async (): Promise<void> => {
  await bibleDatabaseService.initDatabase(); // idempotent
  const days: Record<string, FeedDay> = {};
  const today = new Date();
  const tenyHoAnao = await loadTenyHoAnao();
  const situations = tenyHoAnao.onWidget ? tenyHoAnao.situations : [];
  const schedule = situationSchedule(situations, today, WIDGET_WINDOW_DAYS, tenyHoAnao.since);
  const favorites = await favoriteVerses();
  for (let i = 0; i < WIDGET_WINDOW_DAYS; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    if (isCheckInDay(date, situations)) {
      days[isoDay(date)] = {...CHECK_IN_CARD, url: TENY_HO_ANAO_URL, dateLabel: dateLabel(date), label: ''};
      continue;
    }
    const planned = schedule[i][0];
    const ref = planned?.ref ?? dailyVerseFor(date);
    const verse = await verseForDate(date, ref);
    if (verse) {
      const key = verseKey(ref);
      days[isoDay(date)] = {
        ref: verse.ref,
        text: verse.body,
        url: verseDeepLink(verse),
        dateLabel: dateLabel(date),
        label: planned ? planLabel(planned.situationId, situations, date, tenyHoAnao.since) : CALENDAR_LABEL,
        key,
        fav: versesIn(ref).every(v => favorites.has(`${ref.b}:${ref.c}:${v}`)),
        favUrl: `${FAVORITE_URL}?key=${key}&name=${encodeURIComponent(verse.bookName)}`,
      };
    }
  }
  const stored = await readStoredLook();
  const base = stored ?? lookForColor((await getStoredPrimaryColor()) ?? PRIMARY_COLOR_OPTIONS[0].hex);
  const text = await getWidgetText();
  const look = widgetInk(stored?.image ? {...base, imageUri: WIDGET_IMAGE_NAME} : base, text.ink);
  // A photo keeps its veil day and night.
  const night = !stored?.image && (await getWidgetFollowDark()) ? nightLook(base) : null;
  const payload = {
    generatedAt: new Date().toISOString(),
    look: {
      background: look.background,
      text: look.text,
      accent: look.accent,
      image: stored?.image ? WIDGET_IMAGE_NAME : null,
      veil: look.veil ?? null,
    },
    lookDark: night && {background: night.background, text: night.text, accent: night.accent, image: null},
    text: {scale: text.scale, font: text.font},
    translation: TRANSLATION,
    // Kept as "", the iOS widget needs the key; each day carries its own.
    label: '',
    days,
  };
  await RNFS.writeFile(`${await widgetDir()}/${WIDGET_FILE_NAME}`, JSON.stringify(payload), 'utf8');
  // Absent where there is no native widget module (jest, unsupported platform).
  await NativeModules.DailyVerseWidget?.refresh?.();
};

// One rebuild at a time: calls during a run fold into one more run, so an
// older feed (say, a heart not yet counted) never lands after a newer one.
let syncing = false;
let syncAgain = false;

export const syncDailyVerseWidget = async (): Promise<void> => {
  if (syncing) {
    syncAgain = true;
    return;
  }
  syncing = true;
  try {
    do {
      syncAgain = false;
      await writeFeed();
    } while (syncAgain);
  } catch (error) {
    reportSchedulingFailure('widgetSync', error);
  } finally {
    syncing = false;
  }
};
