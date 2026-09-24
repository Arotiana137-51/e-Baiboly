import AsyncStorage from '@react-native-async-storage/async-storage';

export type JesusNameVariant = 'jesosy' | 'jesoa';

export const STORAGE_KEY_JESUS_NAME = 'settings.jesusName';

export const transformJesusName = (text: string, variant: JesusNameVariant) => {
  if (!text) {
    return text;
  }

  // Replace any casing variant of Jesosy/Jesoa, but avoid replacing inside other words.
  // Use ASCII word boundaries; this should work for Malagasy text around these words.
  const regex = /\b(Jesosy|Jesoa)\b/gi;
  const replacement = variant === 'jesoa' ? 'Jesoa' : 'Jesosy';
  return text.replace(regex, replacement);
};

// For code outside React (widget feed, notifications); same default as the provider.
export const getStoredJesusNameVariant = async (): Promise<JesusNameVariant> => {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY_JESUS_NAME)) === 'jesoa' ? 'jesoa' : 'jesosy';
  } catch {
    return 'jesosy';
  }
};
