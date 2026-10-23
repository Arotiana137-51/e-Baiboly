import AsyncStorage from '@react-native-async-storage/async-storage';

// The reader's text size, the A+ / A- of the menu: set on Home, also followed
// by screens with long reading text (the dictionary entries).
export const FONT_SCALE_KEY = 'font_scale';
export const USER_FONT_SCALE_MIN = 0.8;
export const USER_FONT_SCALE_MAX = 1.6;

export const loadFontScale = async (): Promise<number> => {
  try {
    const stored = parseFloat((await AsyncStorage.getItem(FONT_SCALE_KEY)) ?? '');
    return stored >= USER_FONT_SCALE_MIN && stored <= USER_FONT_SCALE_MAX ? stored : 1;
  } catch {
    return 1;
  }
};
