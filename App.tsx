import React, {useEffect, useState} from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {DatabaseProvider, useDatabase} from './src/contexts/DatabaseContext';
import {ActivityIndicator, View, Text, StyleSheet, Linking} from 'react-native';
import RootNavigator, {navigationRef} from './src/navigation/RootNavigator';
import {ThemeProvider, useTheme} from './src/contexts/ThemeContext';
import {JesusNameProvider, useJesusName} from './src/contexts/JesusNameContext';
import {CultModeProvider} from './src/contexts/CultModeContext';
import {TutorialProvider} from './src/contexts/TutorialContext';
import {FavoritesProvider} from './src/hooks/useFavorites';
import {HymnFavoritesProvider} from './src/hooks/useHymnFavorites';
import {BibleHistoryProvider} from './src/hooks/useBibleHistory';
import {HymnHistoryProvider} from './src/hooks/useHymnHistory';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEY_PRIVACY_POLICY_ACCEPTED} from './src/screens/PrivacyPolicyScreen';
import {isOnboardingDone} from './src/contexts/TutorialContext';
import {ErrorBoundary} from './src/components/ErrorBoundary';
import {
  installGlobalErrorHandler,
  drainFatalErrorToQueue,
} from './src/services/reporting/crashReporter';
import {ensureRemindersScheduled} from './src/services/reminders/readingReminder';
import {syncDailyVerseWidget} from './src/services/widget/dailyVerseWidget';
import notifee, {EventType, type Notification} from '@notifee/react-native';

// Capture uncaught JS errors (async, timers, event handlers) before RN's
// default handler runs, so production crashes carry a real message/stack.
installGlobalErrorHandler();

// Force the complete onboarding flow (color selection → basic navigation
// tutorial → Fotoam-pivavahana tutorial) on every launch. Dev-only; must stay
// false in release so returning users land on Home, not the color picker.
const FORCE_ONBOARDING_FLOW = false;

// Opens the reader on a verse. Reached from a daily-verse notification tap
// (verse in `data`) and from the home-screen widget (ebaiboly://verse deep
// link); plain reminders carry no verse, so they just open the app.
const openVerse = (target: {bookId: unknown; bookName: unknown; chapter: unknown; verse: unknown}) => {
  if (!target.bookId || !navigationRef.isReady()) return;
  navigationRef.navigate('Home', {
    mode: 'bible',
    selectedBook: {id: Number(target.bookId), name: String(target.bookName)},
    selectedChapter: Number(target.chapter),
    selectedVerse: Number(target.verse),
  });
};

const openVerseFromNotification = (notification?: Notification) => {
  const data = notification?.data;
  if (data) openVerse({bookId: data.bookId, bookName: data.bookName, chapter: data.chapter, verse: data.verse});
};

// ebaiboly://verse?book=19&chapter=23&verse=1&name=Salamo (see
// services/widget/dailyVerseWidget.ts). Hand-parsed: RN's URL lacks searchParams.
const openVerseFromUrl = (url: string | null) => {
  // The widget's Loko shortcut: straight to the look screen, which closes
  // the app again on "Vita" so the user lands back on the widget.
  if (url?.startsWith('ebaiboly://widget-look')) {
    if (navigationRef.isReady()) navigationRef.navigate('WidgetLook', {fromWidget: true});
    return;
  }
  if (!url?.startsWith('ebaiboly://verse')) return;
  const params: Record<string, string> = {};
  for (const pair of (url.split('?')[1] ?? '').split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key) params[key] = decodeURIComponent(value);
  }
  openVerse({bookId: params.book, bookName: params.name, chapter: params.chapter, verse: params.verse});
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
    // Refresh the home-screen widget's verse feed. Fire-and-forget; never throws.
    syncDailyVerseWidget();
  }, []);

  useEffect(() => {
    const unsubscribeNotifee = notifee.onForegroundEvent(({type, detail}) => {
      if (type === EventType.PRESS) openVerseFromNotification(detail.notification);
    });
    const urlSubscription = Linking.addEventListener('url', ({url}) => openVerseFromUrl(url));
    return () => {
      unsubscribeNotifee();
      urlSubscription.remove();
    };
  }, []);

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
                    <FavoritesProvider>
                      <HymnFavoritesProvider>
                        <BibleHistoryProvider>
                          <HymnHistoryProvider>
                            <NavigationContainer
                              ref={navigationRef}
                              onReady={() => {
                                // Cold start from a notification or widget tap.
                                notifee
                                  .getInitialNotification()
                                  .then(initial => openVerseFromNotification(initial?.notification))
                                  .catch(() => {});
                                Linking.getInitialURL().then(openVerseFromUrl).catch(() => {});
                              }}>
                              <AppContent />
                            </NavigationContainer>
                          </HymnHistoryProvider>
                        </BibleHistoryProvider>
                      </HymnFavoritesProvider>
                    </FavoritesProvider>
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
