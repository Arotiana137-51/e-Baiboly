import {NativeModules, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from 'react-native-fs';
import {bibleDatabaseService} from '../database/DatabaseService';
import {reportSchedulingFailure, verseForDate} from '../reminders/readingReminder';
import {getStoredPrimaryColor} from '../../utils/primaryColorStorage';
import {PRIMARY_COLOR_OPTIONS} from '../../theme/personalizationPalette';
import {lookForColor, type ShareCardLook} from '../../utils/shareCard';

/**
 * Home-screen widget feed. Widgets are native UI on both platforms, so JS
 * computes and native displays: this writes `dailyVerse.json` with the verse
 * for each of the next WIDGET_WINDOW_DAYS days, the chosen look and a deep
 * link and date label per day, plus the translation tag; the Android
 * AppWidgetProvider and the iOS WidgetKit extension only read it (see
 * android/.../DailyVerseWidgetProvider.kt and ios/DailyVerseWidget/). Keys are
 * the LOCAL calendar date, yyyy-MM-dd.
 *
 * The look is the share card's vocabulary (utils/shareCard): a flat colour
 * with matching ink, or a photo under a dark scrim. A chosen photo is copied
 * next to the feed as WIDGET_IMAGE_NAME so both widgets can read it; only
 * the file name travels in the JSON because the sandbox path can change
 * between launches.
 *
 * ponytail: 60-day window — a phone that doesn't open the app for two months
 * shows the widget's built-in "open the app" fallback until the next launch.
 */

export const WIDGET_FILE_NAME = 'dailyVerse.json';
export const WIDGET_IMAGE_NAME = 'widgetBackground.jpg';
export const IOS_APP_GROUP = 'group.com.ebaiboly.app';
const WIDGET_WINDOW_DAYS = 60;
const STORAGE_KEY_LOOK = 'settings.widget.look';

// What is persisted: the look minus the temporary picker URI, plus whether a
// copied photo exists.
type StoredLook = {background: string; text: string; accent: string; image?: boolean};

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

const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const widgetDir = async (): Promise<string> =>
  Platform.OS === 'ios' ? await RNFS.pathForGroup(IOS_APP_GROUP) : RNFS.DocumentDirectoryPath;

const readStoredLook = async (): Promise<StoredLook | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_LOOK);
    return raw ? (JSON.parse(raw) as StoredLook) : null;
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

export const syncDailyVerseWidget = async (): Promise<void> => {
  try {
    await bibleDatabaseService.initDatabase(); // idempotent
    const days: Record<string, {ref: string; text: string; url: string; dateLabel: string}> = {};
    const today = new Date();
    for (let i = 0; i < WIDGET_WINDOW_DAYS; i += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const verse = await verseForDate(date);
      if (verse) {
        days[isoDay(date)] = {
          ref: verse.ref,
          text: verse.body,
          url: verseDeepLink(verse),
          dateLabel: dateLabel(date),
        };
      }
    }
    const stored = await readStoredLook();
    const look = stored ?? lookForColor((await getStoredPrimaryColor()) ?? PRIMARY_COLOR_OPTIONS[0].hex);
    const payload = {
      generatedAt: new Date().toISOString(),
      look: {
        background: look.background,
        text: look.text,
        accent: look.accent,
        image: stored?.image ? WIDGET_IMAGE_NAME : null,
      },
      label: 'Sakafom-panahy', // placeholder — user-owned MG copy
      translation: TRANSLATION,
      days,
    };
    await RNFS.writeFile(`${await widgetDir()}/${WIDGET_FILE_NAME}`, JSON.stringify(payload), 'utf8');
    // Absent where there is no native widget module (jest, unsupported platform).
    await NativeModules.DailyVerseWidget?.refresh?.();
  } catch (error) {
    reportSchedulingFailure('widgetSync', error);
  }
};
