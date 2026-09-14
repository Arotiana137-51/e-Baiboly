import React from 'react';
import {createNavigationContainerRef} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {t} from '../i18n/strings';
import {useTheme} from '../contexts/ThemeContext';
import MainScreen from '../screens/MainScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import HistoryScreen from '../screens/HistoryScreen';
import GlobalSearchScreen from '../screens/GlobalSearchScreen';
import VerseListScreen from '../screens/VerseListScreen';
import MiscScreen from '../screens/MiscScreen';
import FanekemDetailsScreen from '../screens/FanekemDetailsScreen';
import AboutScreen from '../screens/AboutScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import PersonalizationScreen from '../screens/PersonalizationScreen';
import OnboardingGateScreen from '../screens/OnboardingGateScreen';
import CultIntroScreen from '../screens/CultIntroScreen';
import CultModeScreen from '../screens/CultModeScreen';
import NotesScreen from '../screens/NotesScreen';
import HelpScreen from '../screens/HelpScreen';
import ReadingReminderScreen from '../screens/ReadingReminderScreen';

export type RootStackParamList = {
  Home:
    | {
        mode?: 'bible' | 'hymnal';
        selectedBook?: { id: number; name: string };
        selectedChapter?: number;
        selectedVerse?: number;
        selectedHymnId?: string;
      }
    | undefined;
  Favorites: { mode: 'bible' | 'hymnal' };
  History: { mode: 'bible' | 'hymnal' };
  Notes: undefined;
  GlobalSearch: undefined;
  VerseList: { bookId: number; bookName: string; query: string; matchWholeWord?: boolean };
  Misc: undefined;
  FanekemDetails: {title: string; content: string};
  About: undefined;
  PrivacyPolicy: {mandatory?: boolean} | undefined;
  Personalization: {firstRun?: boolean} | undefined;
  OnboardingGate: undefined;
  CultIntro: undefined;
  CultMode: undefined;
  Help: undefined;
  ReadingReminder: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Lets code outside the navigator tree (the notification press handler in
// App.tsx) navigate.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type RootNavigatorProps = {
  initialRouteName?: keyof RootStackParamList;
  privacyPolicyMandatory?: boolean;
  // TEMP(testing): start Personalization in first-run mode so it resets to Home
  // on selection and auto-starts the tutorial chain.
  forceFirstRun?: boolean;
};

const RootNavigator = ({
  initialRouteName,
  privacyPolicyMandatory,
  forceFirstRun,
}: RootNavigatorProps) => {
  const {theme} = useTheme();

  const headerOptions = {
    headerStyle: {backgroundColor: theme.colors.navBackground},
    headerTintColor: '#FFFFFF',
    headerTitleStyle: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 0.15,
    },
    headerBackTitleVisible: false,
    headerShadowVisible: true,
    statusBarColor: theme.colors.navBackground,
    statusBarStyle: 'light',
  } as const;

  return (
    <Stack.Navigator initialRouteName={initialRouteName}>
      <Stack.Screen
        name="Home"
        component={MainScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{title: t('menu.favorites'), ...headerOptions}}
      />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{title: t('menu.history'), ...headerOptions}}
      />
      <Stack.Screen
        name="Notes"
        component={NotesScreen}
        options={{title: t('notes.title'), ...headerOptions}}
      />
      <Stack.Screen
        name="GlobalSearch"
        component={GlobalSearchScreen}
        options={{title: t('menu.search'), ...headerOptions}}
      />
      <Stack.Screen
        name="VerseList"
        component={VerseListScreen}
        options={{title: t('verseList.title'), ...headerOptions}}
      />
      <Stack.Screen
        name="Misc"
        component={MiscScreen}
        options={{title: t('menu.misc'), ...headerOptions}}
      />
      <Stack.Screen
        name="FanekemDetails"
        component={FanekemDetailsScreen}
        options={({route}) => ({
          title: route.params.title,
          ...headerOptions,
        })}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{title: t('menu.about'), ...headerOptions}}
      />
      <Stack.Screen
        name="Personalization"
        component={PersonalizationScreen}
        initialParams={forceFirstRun ? {firstRun: true} : undefined}
        options={{title: t('personalization.title'), ...headerOptions}}
      />
      <Stack.Screen
        name="OnboardingGate"
        component={OnboardingGateScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="CultIntro"
        component={CultIntroScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="CultMode"
        component={CultModeScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{title: 'Toro-lalana', ...headerOptions}}
      />
      <Stack.Screen
        name="ReadingReminder"
        component={ReadingReminderScreen}
        options={{title: 'Ora famakiana tiana', ...headerOptions}}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        initialParams={
          privacyPolicyMandatory
            ? {
                mandatory: true,
              }
            : undefined
        }
        options={{title: t('about.privacyPolicy'), ...headerOptions}}
      />
    </Stack.Navigator>
  );
};

export default RootNavigator;
