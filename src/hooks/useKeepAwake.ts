import {useEffect} from 'react';
import {NativeModules} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useIsFocused} from '@react-navigation/native';

const STORAGE_KEY = '@keep_screen_on';

// Absent = on, so existing installs get book-like behaviour without a migration.
export const getKeepScreenOn = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(STORAGE_KEY)) !== 'false';

export const setKeepScreenOn = (on: boolean): Promise<void> =>
  AsyncStorage.setItem(STORAGE_KEY, on ? 'true' : 'false');

/**
 * Holds the screen awake while the calling screen is focused and the
 * preference is on, like a physical book left open. The preference is re-read
 * on every focus so a flip on the About screen applies as soon as the user
 * pops back, with no context to thread through. No AppState handling needed:
 * Android's window flag only counts while the Activity is visible and iOS's
 * idle timer only concerns the foreground app. Missing native module (Jest,
 * stale dev binary) degrades to a no-op.
 */
export const useKeepAwake = (): void => {
  const focused = useIsFocused();

  useEffect(() => {
    const {KeepAwake} = NativeModules;
    if (!focused || !KeepAwake?.setEnabled) return;
    let cancelled = false;
    getKeepScreenOn().then(on => {
      if (!cancelled && on) KeepAwake.setEnabled(true);
    });
    return () => {
      cancelled = true;
      KeepAwake.setEnabled(false);
    };
  }, [focused]);
};
