import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEY_JESUS_NAME, transformJesusName, type JesusNameVariant} from '../utils/jesusName';
import {ensureRemindersScheduled} from '../services/reminders/readingReminder';
import {syncDailyVerseWidget} from '../services/widget/dailyVerseWidget';

export type {JesusNameVariant};

type JesusNameContextValue = {
  variant: JesusNameVariant;
  setVariant: (variant: JesusNameVariant) => void;
  isReady: boolean;
  transformText: (text: string) => string;
};

const JesusNameContext = createContext<JesusNameContextValue | null>(null);

export const JesusNameProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [variant, setVariantState] = useState<JesusNameVariant>('jesosy');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_JESUS_NAME);
        if (stored === 'jesoa' || stored === 'jesosy') {
          setVariantState(stored);
        }
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: JesusNameVariant) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_JESUS_NAME, next);
    } catch {
      // ignore persistence errors
    }
    // Pending daily-verse notifications and the widget feed hold resolved text.
    ensureRemindersScheduled();
    syncDailyVerseWidget();
  }, []);

  const setVariant = useCallback(
    (next: JesusNameVariant) => {
      setVariantState(next);
      persist(next);
    },
    [persist]
  );

  const transformText = useCallback(
    (text: string) => transformJesusName(text, variant),
    [variant]
  );

  const value: JesusNameContextValue = useMemo(
    () => ({
      variant,
      setVariant,
      isReady,
      transformText,
    }),
    [variant, setVariant, isReady, transformText]
  );

  return <JesusNameContext.Provider value={value}>{children}</JesusNameContext.Provider>;
};

export const useJesusName = () => {
  const ctx = useContext(JesusNameContext);
  if (!ctx) {
    throw new Error('useJesusName must be used within JesusNameProvider');
  }
  return ctx;
};

export const __test__transformJesusName = transformJesusName;
