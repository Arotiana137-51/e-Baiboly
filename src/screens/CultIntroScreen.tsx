import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../contexts/ThemeContext';
import {useTutorial} from '../contexts/TutorialContext';
import {TutorialIcon} from '../components/TutorialIcons';
import {CULT_TUTORIAL_ID} from '../tutorials/registry';
import type {RootStackParamList} from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Interstitial between the general onboarding tutorial and the Fotoam-
// pivavahana one (chained from MainScreen once onboarding finishes/skips).
// Mental-overload avoidance: don't march straight from a 12-step walkthrough
// into a second one — pitch the feature in a sentence and let the user opt in
// now or later. "Later" isn't a dead end: the Toro-lalana quest log (HelpScreen)
// always has it queued up, so declining here loses nothing.
const CultIntroScreen = () => {
  const {theme, primaryColor} = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const {start} = useTutorial();
  const accent = primaryColor ?? theme.colors.navBackground;

  const goHome = () => navigation.popTo('Home');

  const startCultTutorial = () => {
    goHome();
    // Let Home mount before the overlay measures its targets — same settle
    // delay HelpScreen's quest-log launch uses.
    setTimeout(() => start(CULT_TUTORIAL_ID), 350);
  };

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.container, {backgroundColor: theme.colors.backgroundPrimary}]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <TutorialIcon
              name="church"
              color={accent}
              backgroundColor={theme.colors.backgroundPrimary}
            />
          </View>

          <Text style={[styles.title, {color: theme.colors.textPrimary}]}>
            Fotoam-pivavahana
          </Text>
          {/* PLACEHOLDER MG copy — needs the app's own wording, not mine. */}
          <Text style={[styles.pitch, {color: theme.colors.textSecondary}]}>
            Azonao omanina mialoha ny lisitry ny hira sy ny andinin-tsoratra masina harahina
            mandritra ny fotoam-pivavahana, ka tsy mila mitady intsony
            rehefa mivavaka ianareo. 
          </Text>
          <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]}>
            Te hianatra ny fomba fampiasa azy ve ianao izao?
          </Text>

          <Pressable
            onPress={startCultTutorial}
            style={[styles.primaryButton, {backgroundColor: accent}]}
            accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Eny, ampianaro ahy</Text>
          </Pressable>

          <Pressable
            onPress={goHome}
            style={[styles.secondaryButton, {borderColor: accent}]}
            accessibilityRole="button">
            <Text style={[styles.secondaryButtonText, {color: accent}]}>Aleo amin'ny manaraka</Text>
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
  iconWrap: {
    alignSelf: 'center',
    marginBottom: 8,
    transform: [{scale: 2.2}],
  },
  title: {fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 16},
  pitch: {fontSize: 15, textAlign: 'center', marginTop: 14, lineHeight: 21},
  subtitle: {fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 18, marginBottom: 28},
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

export default CultIntroScreen;
