import {NativeModules, Platform} from 'react-native';
import * as RNFS from 'react-native-fs';
import {bibleDatabaseService} from '../database/DatabaseService';
import {reportSchedulingFailure, verseForDate} from '../reminders/readingReminder';
import {getStoredPrimaryColor} from '../../utils/primaryColorStorage';
import {PRIMARY_COLOR_OPTIONS} from '../../theme/personalizationPalette';

/**
 * Home-screen widget feed. Widgets are native UI on both platforms, so JS
 * computes and native displays: this writes `dailyVerse.json` with the verse
 * for each of the next WIDGET_WINDOW_DAYS days, the app's accent colour and a
 * deep link and date label per day, plus the translation tag; the Android
 * AppWidgetProvider and the iOS WidgetKit
 * extension only read it (see android/.../DailyVerseWidgetProvider.kt and
 * ios/DailyVerseWidget/). Keys are the LOCAL calendar date, yyyy-MM-dd.
 *
 * ponytail: 60-day window — a phone that doesn't open the app for two months
 * shows the widget's built-in "open the app" fallback until the next launch.
 */

export const WIDGET_FILE_NAME = 'dailyVerse.json';
export const IOS_APP_GROUP = 'group.com.ebaiboly.app';
const WIDGET_WINDOW_DAYS = 60;

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

const widgetFilePath = async (): Promise<string> => {
  const dir =
    Platform.OS === 'ios' ? await RNFS.pathForGroup(IOS_APP_GROUP) : RNFS.DocumentDirectoryPath;
  return `${dir}/${WIDGET_FILE_NAME}`;
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
    const payload = {
      generatedAt: new Date().toISOString(),
      accent: (await getStoredPrimaryColor()) ?? PRIMARY_COLOR_OPTIONS[0].hex,
      label: 'Sakafom-panahy', // placeholder — user-owned MG copy
      translation: TRANSLATION,
      days,
    };
    await RNFS.writeFile(await widgetFilePath(), JSON.stringify(payload), 'utf8');
    // Absent where there is no native widget module (jest, unsupported platform).
    await NativeModules.DailyVerseWidget?.refresh?.();
  } catch (error) {
    reportSchedulingFailure('widgetSync', error);
  }
};
