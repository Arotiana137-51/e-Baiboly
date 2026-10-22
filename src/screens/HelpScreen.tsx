import React, {useCallback, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../contexts/ThemeContext';
import {TutorialIcon} from '../components/TutorialIcons';
import {MenuIcon} from '../components/MenuIcons';
import {useTutorial, type TutorialStatus} from '../contexts/TutorialContext';
import {TUTORIALS} from '../tutorials/registry';
import type {RootStackParamList} from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Quest log: every tutorial rendered from the TUTORIALS registry as a card with
// a done/available badge. Tapping a card returns Home and starts that tutorial
// (the overlay lives on MainScreen). Adding a mini-tutorial to the registry
// makes it appear here automatically — no change to this screen.
const HelpScreen = () => {
  const {theme, primaryColor} = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const {start, getStatus} = useTutorial();
  const [statuses, setStatuses] = useState<Record<string, TutorialStatus>>({});

  const accent = primaryColor ?? theme.colors.navBackground;

  // Refresh badges each time the screen is focused (e.g. after finishing one).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all(TUTORIALS.map(tu => getStatus(tu.id).then(s => [tu.id, s] as const))).then(
        entries => {
          if (active) setStatuses(Object.fromEntries(entries));
        },
      );
      return () => {
        active = false;
      };
    }, [getStatus]),
  );

  const launch = (id: string) => {
    const tu = TUTORIALS.find(t => t.id === id);
    const route = tu?.launchRoute ?? 'Home';
    navigation.navigate(route);
    // Let the target screen mount before the overlay measures its targets.
    setTimeout(() => start(id), 350);
  };

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.container, {backgroundColor: theme.colors.backgroundPrimary}]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]}>
          Fidio ny fampianarana tianao hoverina.
        </Text>

        {[...TUTORIALS]
          .sort((a, b) => a.order - b.order)
          .map(tu => {
            const done = statuses[tu.id] === 'done';
            return (
              <Pressable
                key={tu.id}
                onPress={() => launch(tu.id)}
                style={({pressed}) => [
                  styles.card,
                  {
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderColor: theme.colors.divider,
                  },
                  pressed && {opacity: 0.85},
                ]}>
                <View style={styles.icon}>
                  <TutorialIcon
                    name={tu.icon}
                    color={accent}
                    backgroundColor={theme.colors.backgroundSecondary}
                  />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, {color: theme.colors.textPrimary}]}>
                    {tu.title}
                  </Text>
                  <Text style={[styles.badge, {color: done ? accent : theme.colors.textSecondary}]}>
                    {done ? '● Vita' : '○ Mbola tsy natao'}
                  </Text>
                </View>
                <Text style={[styles.chevron, {color: accent}]}>›</Text>
              </Pressable>
            );
          })}

        {/* Not a coach-mark tutorial: the widget is added on the home screen,
            outside the app, so this card opens the steps to read instead. */}
        <Pressable
          onPress={() => navigation.navigate('WidgetGuide')}
          style={({pressed}) => [
            styles.card,
            {
              backgroundColor: theme.colors.backgroundSecondary,
              borderColor: theme.colors.divider,
            },
            pressed && {opacity: 0.85},
          ]}>
          <View style={styles.icon}>
            <MenuIcon name="bubble" color={accent} />
          </View>
          <View style={styles.cardBody}>
            {/* PLACEHOLDER MG copy — needs the app's own wording, not mine. */}
            <Text style={[styles.cardTitle, {color: theme.colors.textPrimary}]}>
              Hametraka ny widget
            </Text>
          </View>
          <Text style={[styles.chevron, {color: accent}]}>›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  scroll: {padding: 16, paddingBottom: 32},
  subtitle: {fontSize: 14, marginBottom: 16},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  icon: {marginRight: 14},
  cardBody: {flex: 1},
  cardTitle: {fontSize: 17, fontWeight: '700', marginBottom: 4},
  badge: {fontSize: 13, fontWeight: '600'},
  chevron: {fontSize: 28, fontWeight: '300', marginLeft: 8},
});

export default HelpScreen;
