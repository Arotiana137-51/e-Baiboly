import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ensureRemindersScheduled} from '../services/reminders/readingReminder';
import {StyleSheet, View} from 'react-native';
import {
  getStoredPrimaryColor,
  setStoredPrimaryColor,
  isValidHexColor,
} from '../utils/primaryColorStorage';

interface ThemeColors {
  backgroundPrimary: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  readerBackground: string;
  readerText: string;
  textPrimary: string;
  textSecondary: string;
  textWatermark: string;
  divider: string;
  accentBlue: string;
  accentGold: string;
  glow: string;
  navBackground: string;
  verseNumber: string;
  markerHighlight: string;
};

export type Theme = {
  isDark: boolean;
  colors: ThemeColors;
};

type ThemeContextValue = {
  theme: Theme;
  isDarkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
  toggleDarkMode: () => void;
  isReady: boolean;
  enableLowEndMode: () => void;
  disableLowEndMode: () => void;
  isLowEndMode: boolean;
  primaryColor: string | null;
  setPrimaryColor: (hex: string | null) => void;
};

const STORAGE_KEY_DARK_MODE = 'settings.darkMode';
const STORAGE_KEY_THEME_MODE = 'settings.themeMode';
const STORAGE_KEY_LOW_END_MODE = 'settings.lowEndMode';

const darkColors: ThemeColors = {
  backgroundPrimary: '#000000',
  backgroundSecondary: '#1C1C1E',
  backgroundTertiary: '#2C2C2E',
  readerBackground: '#0B0B0C',
  readerText: '#B3B3B3',
  textPrimary: '#F2F2F7',
  textSecondary: '#8E8E93',
  textWatermark: '#7A7A80',
  divider: '#3A3A3C',
  accentBlue: '#007991',
  accentGold: '#FFD60A',
  glow: '#25A18E',
  navBackground: '#004E64',
  verseNumber: '#007991',
  markerHighlight: 'rgba(255, 193, 7, 0.42)',
};

const lightColors: ThemeColors = {
  backgroundPrimary: '#FBF3E6',
  backgroundSecondary: '#F2E6D5',
  backgroundTertiary: '#FBF3E6',
  readerBackground: '#F6EBD9',
  readerText: '#2B2116',
  textPrimary: '#2B2116',
  textSecondary: '#6B5A44',
  textWatermark: '#7C6B56',
  divider: '#E2D1BB',
  accentBlue: '#007991',
  accentGold: '#FFD60A',
  glow: '#25A18E',
  navBackground: '#004E64',
  verseNumber: '#007991',
  markerHighlight: 'rgba(255, 213, 79, 0.55)',
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLowEndMode, setIsLowEndMode] = useState(false);
  const [primaryColor, setPrimaryColorState] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const storedThemeMode = await AsyncStorage.getItem(STORAGE_KEY_THEME_MODE);
        if (storedThemeMode) {
          if (storedThemeMode === 'dark') {
            setIsDarkMode(true);
          }
        } else {
          const legacyDarkMode = await AsyncStorage.getItem(STORAGE_KEY_DARK_MODE);
          if (legacyDarkMode === 'true') {
            setIsDarkMode(true);
          }
        }

        const lowEndMode = await AsyncStorage.getItem(STORAGE_KEY_LOW_END_MODE);
        if (lowEndMode === 'true') {
          setIsLowEndMode(true);
        }

        const storedPrimary = await getStoredPrimaryColor();
        if (storedPrimary) {
          setPrimaryColorState(storedPrimary);
        }
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setPrimaryColor = useCallback((hex: string | null) => {
    if (hex !== null && !isValidHexColor(hex)) return;
    setPrimaryColorState(hex);
    setStoredPrimaryColor(hex).then(ensureRemindersScheduled); // re-tint pending notifications
  }, []);

  const persist = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_DARK_MODE, enabled ? 'true' : 'false');
      await AsyncStorage.setItem(STORAGE_KEY_THEME_MODE, enabled ? 'dark' : 'light');
    } catch {
      // ignore persistence errors
    }
  }, []);

  const persistLowEnd = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_LOW_END_MODE, enabled ? 'true' : 'false');
    } catch {
      // ignore persistence errors
    }
  }, []);

  const setDarkMode = useCallback(
    (enabled: boolean) => {
      setIsDarkMode(enabled);
      persist(enabled);
    },
    [persist]
  );

  const toggleDarkMode = useCallback(() => {
    setDarkMode(!isDarkMode);
  }, [isDarkMode, setDarkMode]);

  const enableLowEndMode = useCallback(() => {
    setIsLowEndMode(true);
    persistLowEnd(true);
  }, [persistLowEnd]);

  const disableLowEndMode = useCallback(() => {
    setIsLowEndMode(false);
    persistLowEnd(false);
  }, [persistLowEnd]);

  const theme: Theme = useMemo(() => {
    const base = isDarkMode ? darkColors : lightColors;
    if (!primaryColor) {
      return {isDark: isDarkMode, colors: base};
    }
    return {
      isDark: isDarkMode,
      colors: {
        ...base,
        accentBlue: primaryColor,
        navBackground: primaryColor,
        verseNumber: primaryColor,
      },
    };
  }, [isDarkMode, primaryColor]);

  const value: ThemeContextValue = useMemo(
    () => ({
      theme,
      isDarkMode,
      setDarkMode,
      toggleDarkMode,
      isReady,
      enableLowEndMode,
      disableLowEndMode,
      isLowEndMode,
      primaryColor,
      setPrimaryColor,
    }),
    [theme, isDarkMode, setDarkMode, toggleDarkMode, isReady, enableLowEndMode, disableLowEndMode, isLowEndMode, primaryColor, setPrimaryColor]
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {isDarkMode ? (
          <View pointerEvents="none" style={styles.blueLightFilterOverlay} />
        ) : null}
      </View>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};

export const useLowEndMode = () => {
  const { isLowEndMode, enableLowEndMode, disableLowEndMode } = useTheme();
  return { isLowEndMode, enableLowEndMode, disableLowEndMode };
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  blueLightFilterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 200, 120, 0.05)',
  },
});
