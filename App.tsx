import React, {useEffect, useState} from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {DatabaseProvider, useDatabase} from './src/contexts/DatabaseContext';
import {ActivityIndicator, View, Text, StyleSheet} from 'react-native';
import RootNavigator, {navigationRef} from './src/navigation/RootNavigator';
import {ThemeProvider, useTheme} from './src/contexts/ThemeContext';
import {JesusNameProvider, useJesusName} from './src/contexts/JesusNameContext';
import {CultModeProvider} from './src/contexts/CultModeContext';
import {TutorialProvider} from './src/contexts/TutorialContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEY_PRIVACY_POLICY_ACCEPTED} from './src/screens/PrivacyPolicyScreen';
import {isOnboardingDone} from './src/contexts/TutorialContext';
import {ErrorBoundary} from './src/components/ErrorBoundary';
import {
  installGlobalErrorHandler,
  drainFatalErrorToQueue,
} from './src/services/reporting/crashReporter';
import {ensureRemindersScheduled} from './src/services/reminders/readingReminder';
import notifee, {EventType, type Notification} from '@notifee/react-native';

// Capture uncaught JS errors (async, timers, event handlers) before RN's
// default handler runs, so production crashes carry a real message/stack.
installGlobalErrorHandler();

// Force the complete onboarding flow (color selection → basic navigation
// tutorial → Fotoam-pivavahana tutorial) on every launch. Dev-only; must stay
// false in release so returning users land on Home, not the color picker.
const FORCE_ONBOARDING_FLOW = false;

// A daily-verse notification carries its verse in `data`; tapping it opens
// that verse in the reader. Plain reminders have no data, so this is a no-op
// for them.
const openVerseFromNotification = (notification?: Notification) => {
  const data = notification?.data;
  if (!data?.bookId || !navigationRef.isReady()) return;
  navigationRef.navigate('Home', {
    mode: 'bible',
    selectedBook: {id: Number(data.bookId), name: String(data.bookName)},
    selectedChapter: Number(data.chapter),
    selectedVerse: Number(data.verse),
  });
};

// Splash screen component
const SplashScreen = () => (
  <View style={styles.splashContainer}>
    <ActivityIndicator size="large" color="#0000ff" />
    <Text style={styles.loadingText}>Loading Bible App...</Text>
  </View>
);

// Main App component
const AppContent = () => {
  const {isInitialized} = useDatabase();
  const {isReady} = useTheme();
  const {isReady: isJesusNameReady} = useJesusName();
  const [privacyPolicyChecked, setPrivacyPolicyChecked] = useState(false);
  const [privacyPolicyAccepted, setPrivacyPolicyAccepted] = useState(false);
  // Whether onboarding already ran on THIS app version. false = first install
  // or first launch after a version bump → replay the color/tutorial flow.
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    // Move any crash captured on the previous run into the upload queue. The
    // existing flush (NetInfo reconnect / app foreground in MainScreen) then
    // ships it, so the real error/stack behind a production JavascriptException
    // finally becomes visible. Fire-and-forget; never throws.
    drainFatalErrorToQueue();
    // Re-arm any enabled reading-reminder slots — closes the gap where a
    // force-stop or OEM battery manager silently drops a pending native
    // trigger. Fire-and-forget; never throws.
    ensureRemindersScheduled();
  }, []);

  useEffect(
    () =>
      notifee.onForegroundEvent(({type, detail}) => {
        if (type === EventType.PRESS) openVerseFromNotification(detail.notification);
      }),
    [],
  );

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [stored, obDone] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_PRIVACY_POLICY_ACCEPTED),
          isOnboardingDone(),
        ]);
        if (isMounted) {
          setPrivacyPolicyAccepted(stored === 'true');
          setOnboardingDone(obDone);
        }
      } catch {
        if (isMounted) {
          setPrivacyPolicyAccepted(false);
          setOnboardingDone(false);
        }
      } finally {
        if (isMounted) {
          setPrivacyPolicyChecked(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const providersReady = isReady && isJesusNameReady && isInitialized;

  if (!providersReady || !privacyPolicyChecked || onboardingDone === null) {
    return <SplashScreen />;
  }

  if (FORCE_ONBOARDING_FLOW) {
    return <RootNavigator initialRouteName="Personalization" forceFirstRun />;
  }

  // Privacy gate comes first (legal). Once accepted, replay the onboarding flow
  // on first install and after each version bump; otherwise land on Home so the
  // color picker never appears on an ordinary launch.
  if (!privacyPolicyAccepted) {
    return (
      <RootNavigator
        initialRouteName="PrivacyPolicy"
        privacyPolicyMandatory
      />
    );
  }

  if (!onboardingDone) {
    return <RootNavigator initialRouteName="Personalization" forceFirstRun />;
  }

  return <RootNavigator initialRouteName="Home" />;
};

// Main App component with providers
const App = () => {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{flex: 1}}>
        <SafeAreaProvider>
          <ThemeProvider>
            <JesusNameProvider>
              <DatabaseProvider>
                <CultModeProvider>
                  <TutorialProvider>
                    <NavigationContainer
                      ref={navigationRef}
                      onReady={() => {
                        // Cold start from a notification tap.
                        notifee
                          .getInitialNotification()
                          .then(initial => openVerseFromNotification(initial?.notification))
                          .catch(() => {});
                      }}>
                      <AppContent />
                    </NavigationContainer>
                  </TutorialProvider>
                </CultModeProvider>
              </DatabaseProvider>
            </JesusNameProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});

export default App;
