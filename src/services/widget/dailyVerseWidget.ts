import {NativeModules, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from 'react-native-fs';
import {bibleDatabaseService} from '../database/DatabaseService';
import {reportSchedulingFailure, verseForDate} from '../reminders/readingReminder';
import {getStoredPrimaryColor} from '../../utils/primaryColorStorage';
import {findPrimaryColorOption, PRIMARY_COLOR_OPTIONS} from '../../theme/personalizationPalette';
import {lookForColor, nightLook, type ShareCardLook} from '../../utils/shareCard';
import {isoDay} from '../../utils/isoDay';
import {isCheckInDay, planPosition, situationSchedule, type ActiveSituation} from '../../utils/lifeSituations';
import {loadTenyHoAnao} from '../lifeSituations/situationStore';

/**
 * Home-screen widget feed. Widgets are native UI on both platforms, so JS
 * computes and native displays: this writes `dailyVerse.json` with the verse
 * for each of the next WIDGET_WINDOW_DAYS days, the chosen look and a deep
 * link per day; the Android
 * AppWidgetProvider and the iOS WidgetKit extension only read it (see
 * android/.../DailyVerseWidgetProvider.kt and ios/DailyVerseWidget/). Keys are
 * the LOCAL calendar date, yyyy-MM-dd.
 *
 * The look is the share card's vocabulary (utils/shareCard): a flat colour
 * with matching ink, or a photo under a dark scrim. With "follow dark mode"
 * on, `lookDark` carries its night version and native swaps the two with the
 * phone's dark mode. A day of a Teny ho anao plan carries its own `label`,
 * shown instead of the feed's. A chosen photo is copied
 * next to the feed as WIDGET_IMAGE_NAME so both widgets can read it; only
 * the file name travels in the JSON because the sandbox path can change
 * between launches.
 *
 * NOTE: 60-day window — a phone that doesn't open the app for two months
 * shows the widget's built-in "open the app" fallback until the next launch.
 */

export const WIDGET_FILE_NAME = 'dailyVerse.json';
export const WIDGET_IMAGE_NAME = 'widgetBackground.jpg';
export const IOS_APP_GROUP = 'group.com.ebaiboly.app';
const WIDGET_WINDOW_DAYS = 60;
const STORAGE_KEY_LOOK = 'settings.widget.look';
const STORAGE_KEY_FOLLOW_DARK = 'settings.widget.followDark';

// What is persisted: the look minus the temporary picker URI, plus whether a
// copied photo exists.
type StoredLook = {background: string; text: string; accent: string; image?: boolean};

// Opens the "Teny ho anao" screen, where the check-in is answered.
export const TENY_HO_ANAO_URL = 'ebaiboly://teny-ho-anao';

// Check-in card shown instead of the verse on a check-in day. Deliberately
// generic: whoever glances at the home screen must not learn the situation.
// Placeholder MG copy — user-owned.
const CHECK_IN_CARD = {
  ref: 'Teny ho anao',
  text: 'Mbola mety aminao ve ireo teny ireo? Tsindrio eto raha hamaly.',
};

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
    const days: Record<string, {ref: string; text: string; url: string; label?: string}> = {};
    const today = new Date();
    const tenyHoAnao = await loadTenyHoAnao();
    const situations = tenyHoAnao.onWidget ? tenyHoAnao.situations : [];
    const schedule = situationSchedule(situations, today, WIDGET_WINDOW_DAYS, tenyHoAnao.since);
    for (let i = 0; i < WIDGET_WINDOW_DAYS; i += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      if (isCheckInDay(date, situations)) {
        days[isoDay(date)] = {...CHECK_IN_CARD, url: TENY_HO_ANAO_URL};
        continue;
      }
      const planned = schedule[i][0];
      const verse = await verseForDate(date, planned?.ref);
      if (verse) {
        days[isoDay(date)] = {
          ref: verse.ref,
          text: verse.body,
          url: verseDeepLink(verse),
          ...(planned ? {label: planLabel(planned.situationId, situations, date, tenyHoAnao.since)} : {}),
        };
      }
    }
    const stored = await readStoredLook();
    const look = stored ?? lookForColor((await getStoredPrimaryColor()) ?? PRIMARY_COLOR_OPTIONS[0].hex);
    // A photo keeps its dark scrim day and night.
    const night = !stored?.image && (await getWidgetFollowDark()) ? nightLook(look) : null;
    const payload = {
      generatedAt: new Date().toISOString(),
      look: {
        background: look.background,
        text: look.text,
        accent: look.accent,
        image: stored?.image ? WIDGET_IMAGE_NAME : null,
      },
      lookDark: night && {background: night.background, text: night.text, accent: night.accent, image: null},
      // No title over the verse: the widget plainly shows a Bible verse. Only
      // a plan day has a label (its own). Kept as "", the iOS widget needs the key.
      label: '',
      days,
    };
    await RNFS.writeFile(`${await widgetDir()}/${WIDGET_FILE_NAME}`, JSON.stringify(payload), 'utf8');
    // Absent where there is no native widget module (jest, unsupported platform).
    await NativeModules.DailyVerseWidget?.refresh?.();
  } catch (error) {
    reportSchedulingFailure('widgetSync', error);
  }
};
