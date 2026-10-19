import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import InAppReview from 'react-native-in-app-review';
import packageJson from '../../package.json';

// Native in-app rating prompt: Play In-App Review on Android,
// SKStoreReviewController on iOS. Both stores decide for themselves whether the
// dialog actually appears — Google throttles per-app quota and iOS caps it at
// three prompts a year — and neither reports the outcome. So this is strictly
// fire-and-forget: never block on it, never branch on it, and never wrap it in
// our own "do you like the app?" UI (Play policy forbids that pre-prompt).
//
// It also only works on a build installed FROM the store. A sideloaded debug or
// release APK gets a silent no-op, so this can't be verified by side-loading.

const ASKED_VERSION_KEY = 'review.askedVersion';
const DAY_MS = 24 * 60 * 60 * 1000;
export const REVIEW_DELAY_DAYS = 3;

// Same semantics as PatchManager.isOnline: isInternetReachable is often null on
// Android (unknown), and treating unknown as offline would suppress the prompt
// on plenty of working connections.
const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return false;
  }
};

// Asks once per app version, so revisiting About doesn't re-prompt and a later
// update still gets one fresh chance.
// The whole path is silent by design, which makes "nothing happened" impossible
// to diagnose. __DEV__ only, so release builds stay quiet.
const trace = (reason: string) => {
  if (__DEV__) {
    console.log(`[appReview] ${reason}`);
  }
};

// Home's NetInfo listener and About can both call in quick succession, before
// the asked flag is written; only one flow may run at a time.
let inFlight = false;

const FIRST_SEEN_KEY = 'review.firstSeen';

// Stamps the first call, then reports whether `days` have passed since.
const usedForAtLeast = async (days: number): Promise<boolean> => {
  const stored = await AsyncStorage.getItem(FIRST_SEEN_KEY);
  if (stored === null) {
    await AsyncStorage.setItem(FIRST_SEEN_KEY, String(Date.now()));
    return false;
  }
  return Date.now() - Number(stored) >= days * DAY_MS;
};

// `minDays` keeps the automatic Home call away from brand-new users; About
// (a deliberate visit) asks without it.
export const maybeRequestReview = async (minDays = 0): Promise<void> => {
  if (inFlight) return;
  inFlight = true;
  try {
    if (minDays > 0 && !(await usedForAtLeast(minDays))) {
      trace(`skipped: installed less than ${minDays} days ago`);
      return;
    }
    const appVersion = String((packageJson as {version?: string}).version ?? '');
    const askedVersion = await AsyncStorage.getItem(ASKED_VERSION_KEY);
    if (askedVersion === appVersion) {
      trace(`skipped: already asked for ${appVersion}`);
      return;
    }

    // Submitting a review needs the network; without it the store dialog either
    // fails or traps the user in a prompt that can't go anywhere.
    if (!(await isOnline())) {
      trace('skipped: offline');
      return;
    }

    if (!InAppReview.isAvailable()) {
      trace('skipped: InAppReview.isAvailable() === false');
      return;
    }

    trace('requesting store review flow...');

    // Mark only after the flow actually launched. A throw here is transient
    // (no Play Services, sideloaded build, store unreachable) and shouldn't
    // burn the single ask we get for this version — reaching About is a
    // deliberate, infrequent visit, so retrying next time costs nothing.
    const launched = await InAppReview.RequestInAppReview();
    trace(`flow returned ${String(launched)}`);
    await AsyncStorage.setItem(ASKED_VERSION_KEY, appVersion);
  } catch (e: any) {
    // A rating prompt is never worth surfacing an error for.
    trace(`threw: ${e?.message ?? e}`);
  } finally {
    inFlight = false;
  }
};
