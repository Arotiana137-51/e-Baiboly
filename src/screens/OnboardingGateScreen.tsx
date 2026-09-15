import React, {useEffect, useState} from 'react';
import {BackHandler, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {AuthorizationStatus} from '@notifee/react-native';
import {useTheme} from '../contexts/ThemeContext';
import {markTutorialDone} from '../contexts/TutorialContext';
import {ONBOARDING_ID, CULT_TUTORIAL_ID} from '../tutorials/registry';
import {
  DAILY_VERSE_SLOT_ID,
  reportSchedulingFailure,
  saveReminderSlot,
} from '../services/reminders/readingReminder';
import type {RootStackParamList} from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Set once the daily-verse opt-in has been answered, so the replay of this
// screen on every version bump doesn't ask again.
const STORAGE_KEY_DAILY_VERSE_PROMPTED = 'settings.dailyVerse.prompted';

// First-run steps between color selection (Personalization) and Home:
// 1. Daily-verse opt-in — the one place notification permission is requested
//    up front, so the daily verse is on by default for users who say yes.
//    ReadingReminderScreen keeps its own soft-ask as the fallback for anyone
//    who declined here and enables a slot later.
//    The verse defaults to prominent (popup + sound); the opt-in text says so
//    and the choice can be changed on the slot in ReadingReminderScreen.
// 2. Whether the user already knows the app, before running the tutorial
//    succession (onboarding → Fotoam-pivavahana, chained in MainScreen).
const OnboardingGateScreen = () => {
  const {theme, primaryColor} = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const accent = primaryColor ?? theme.colors.navBackground;
  const [step, setStep] = useState<'verse' | 'tutorial' | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_DAILY_VERSE_PROMPTED)
      .then(v => setStep(v ? 'tutorial' : 'verse'))
      .catch(() => setStep('verse'));
  }, []);

  const markPrompted = () =>
    AsyncStorage.setItem(STORAGE_KEY_DAILY_VERSE_PROMPTED, 'true').catch(() => {});

  const finishVerseStep = async (optIn: boolean) => {
    try {
      if (optIn) {
        const settings = await notifee.requestPermission();
        if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) {
          await saveReminderSlot({
            id: DAILY_VERSE_SLOT_ID,
            kind: 'verse',
            enabled: true,
            time: '07:00',
            frequency: 'daily',
            prominent: true,
          });
        }
      }
    } catch (error) {
      reportSchedulingFailure('onboarding.optIn', error);
    }
    await markPrompted();
    setStep('tutorial');
  };

  const goHome = () => navigation.reset({index: 0, routes: [{name: 'Home'}]});

  const skipTutorial = () => {
    // Skip the whole succession, not just the main tutorial — onboarding →
    // cult chains automatically once started (see MainScreen), so both must
    // be stamped done up front.
    markTutorialDone(ONBOARDING_ID);
    markTutorialDone(CULT_TUTORIAL_ID);
    goHome();
  };

  if (step === null) {
    return (
      <SafeAreaView
        edges={['bottom']}
        style={[styles.container, {backgroundColor: theme.colors.backgroundPrimary}]}
      />
    );
  }

  // Placeholder MG copy on every step — user-owned.
  const copy = {
    verse: {
      title: "Sakafom-panahy isan'andro",
      subtitle:
        "« Tsy mofo ihany no hiveloman'ny olona, fa ny teny rehetra izay aloaky ny vavan'Andriamanitra. » (Matio 4:4)\n\n" +
        "Misakafo in-2 na in-3 isan'andro ny vatanao, ary ny Fanahy? " +
        "Andinin'tsoratra masina iray isa-maraina amin'ny 7 ora, mba hampahery anao. " +
        "Azonao ovaina ao amin'ny \"Ora famakiana tiana\" ny ora sy ny feo.",
      primary: 'Eny, tiako',
      secondary: 'Tsia, misaotra',
      onPrimary: () => finishVerseStep(true),
      onSecondary: () => finishVerseStep(false),
    },
    tutorial: {
      title: 'Efa mahay mampiasa ny appli ve ianao?',
      subtitle: 'Azonao ialana ny fampianarana.',
      primary: 'Ampiasa avy hatrany',
      secondary: 'Tsia, asehoy ahy',
      onPrimary: skipTutorial,
      onSecondary: goHome,
    },
  }[step];

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.container, {backgroundColor: theme.colors.backgroundPrimary}]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <Text style={[styles.title, {color: theme.colors.textPrimary}]}>{copy.title}</Text>
          <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]}>{copy.subtitle}</Text>

          <Pressable
            onPress={copy.onPrimary}
            style={[styles.primaryButton, {backgroundColor: accent}]}
            accessibilityRole="button">
            <Text style={styles.primaryButtonText}>{copy.primary}</Text>
          </Pressable>

          <Pressable
            onPress={copy.onSecondary}
            style={[styles.secondaryButton, {borderColor: accent}]}
            accessibilityRole="button">
            <Text style={[styles.secondaryButtonText, {color: accent}]}>{copy.secondary}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 32,
  },
  content: {width: '100%', maxWidth: 480, alignSelf: 'center'},
  title: {fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 24},
  subtitle: {fontSize: 15, textAlign: 'center', marginTop: 10, marginBottom: 28},
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  primaryButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '700'},
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {fontSize: 16, fontWeight: '700'},
});

export default OnboardingGateScreen;
