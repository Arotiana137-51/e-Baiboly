import AsyncStorage from '@react-native-async-storage/async-storage';
import {Linking, NativeModules, Platform} from 'react-native';
import {isOnline} from './appReview';

// Android only: Google Play says whether an update is waiting for this phone
// (AppUpdateModule, Play In-App Updates), and the app offers to open the
// store page, where the update goes the usual way. iOS updates apps by itself
// and has no such call. Like the review prompt, it only answers on a copy
// installed from Play: a sideloaded build never sees an update.

const ANSWERED_KEY = 'appUpdate.answered';
const DAY_MS = 24 * 60 * 60 * 1000;
export const ASK_AGAIN_DAYS = 3;
const STORE_ID = 'com.ebaiboly.app';

export type UpdateAnswer = {versionCode: number; at: number};

// Once answered (later, or off to the store without updating), the same
// version isn't offered again for a few days; a newer one is offered at once.
export const shouldOffer = (
  available: number | null,
  answered: UpdateAnswer | null,
  now: number,
): boolean =>
  available !== null &&
  !(answered && answered.versionCode === available && now - answered.at < ASK_AGAIN_DAYS * DAY_MS);

const checkPlay = async (): Promise<number | null> => {
  try {
    if (!(await isOnline())) return null;
    const available: number | null = (await NativeModules.AppUpdate?.availableVersion?.()) ?? null;
    if (available === null) return null;
    const raw = await AsyncStorage.getItem(ANSWERED_KEY);
    return shouldOffer(available, raw ? JSON.parse(raw) : null, Date.now()) ? available : null;
  } catch {
    // An update prompt is never worth an error.
    return null;
  }
};

let inFlight: Promise<number | null> | null = null;

/** The versionCode to offer, or null: none waiting, offline, iOS, or asked lately. */
export const updateToOffer = (): Promise<number | null> => {
  if (Platform.OS !== 'android') return Promise.resolve(null);
  // NetInfo often fires twice at start-up: the second caller gets the same
  // answer, not a null it would read as "no update".
  if (!inFlight) {
    inFlight = checkPlay().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
};

export const rememberUpdateAnswer = (versionCode: number) =>
  AsyncStorage.setItem(ANSWERED_KEY, JSON.stringify({versionCode, at: Date.now()} satisfies UpdateAnswer)).catch(
    () => {},
  );

// The Play Store app, or the web page where it isn't installed.
export const openStorePage = () =>
  Linking.openURL(`market://details?id=${STORE_ID}`).catch(() =>
    Linking.openURL(`https://play.google.com/store/apps/details?id=${STORE_ID}`),
  );
